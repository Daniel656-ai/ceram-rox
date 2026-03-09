import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeICS(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const ABSENCE_LABELS: Record<string, string> = {
  urlaub: "Urlaub",
  krankheit: "Krankheit",
  weiterbildung: "Weiterbildung",
  sonstiges: "Sonstiges",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token from sync_settings
    const { data: setting } = await supabase
      .from("sync_settings")
      .select("setting_value")
      .eq("setting_key", "ics_feed_token")
      .single();

    if (!setting || (setting.setting_value as any)?.token !== token) {
      return new Response("Invalid token", { status: 403, headers: corsHeaders });
    }

    // Fetch absences with profile info
    let query = supabase.from("user_absences").select("*").order("start_at");
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data: absences, error } = await query;
    if (error) throw error;

    // Fetch profiles for names
    const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name");
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`]));

    // Build ICS
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CeramROX//Abwesenheitsplaner//DE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:CeramROX Abwesenheiten`,
    ];

    for (const a of absences || []) {
      const name = profileMap.get(a.user_id) || "Unbekannt";
      const typeLabel = ABSENCE_LABELS[a.absence_type] || a.absence_type;
      const summary = `${name} - ${typeLabel}`;
      const uid = `${a.id}@ceramrox`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTART:${formatICSDate(new Date(a.start_at))}`);
      lines.push(`DTEND:${formatICSDate(new Date(a.end_at))}`);
      lines.push(`SUMMARY:${escapeICS(summary)}`);
      if (a.comment) lines.push(`DESCRIPTION:${escapeICS(a.comment)}`);
      lines.push(`CATEGORIES:${typeLabel}`);
      lines.push(`DTSTAMP:${formatICSDate(new Date(a.created_at))}`);
      lines.push(`LAST-MODIFIED:${formatICSDate(new Date(a.updated_at))}`);
      lines.push("TRANSP:OPAQUE");
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="absences.ics"',
      },
    });
  } catch (err) {
    console.error("ICS feed error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
