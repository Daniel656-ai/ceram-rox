import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is a master
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nicht autorisiert");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Nicht autorisiert");

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (callerRole?.role !== "master") throw new Error("Keine Berechtigung");

    const { action, ...params } = await req.json();

    if (action === "create") {
      const { email, password, firstName, lastName, role, shortCode } = params;
      if (!email || !password) throw new Error("E-Mail und Passwort erforderlich");
      if (!shortCode || shortCode.length !== 3) throw new Error("Kurzzeichen muss genau 3 Zeichen lang sein");

      // Check uniqueness of short_code
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("short_code", shortCode.toUpperCase())
        .maybeSingle();
      if (existing) throw new Error("Dieses Kurzzeichen ist bereits vergeben");

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName || "",
          last_name: lastName || "",
        },
      });
      if (createError) throw createError;

      // Set short_code on profile
      if (newUser.user) {
        await supabaseAdmin
          .from("profiles")
          .update({ short_code: shortCode.toUpperCase() })
          .eq("user_id", newUser.user.id);
      }

      // Update role if not default
      if (role && role !== "auftraggeber" && newUser.user) {
        await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "delete") {
      const { userId } = params;
      if (!userId) throw new Error("User-ID erforderlich");
      if (userId === caller.id) throw new Error("Eigenen Account nicht löschbar");

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "update") {
      const { userId, firstName, lastName, shortCode } = params;
      if (!userId) throw new Error("User-ID erforderlich");
      if (shortCode !== undefined) {
        if (!shortCode || shortCode.length !== 3) throw new Error("Kurzzeichen muss genau 3 Zeichen lang sein");
        // Check uniqueness
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id, user_id")
          .eq("short_code", shortCode.toUpperCase())
          .maybeSingle();
        if (existing && existing.user_id !== userId) throw new Error("Dieses Kurzzeichen ist bereits vergeben");
      }

      const updateData: Record<string, string> = { first_name: firstName, last_name: lastName };
      if (shortCode) updateData.short_code = shortCode.toUpperCase();

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("user_id", userId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error("Unbekannte Aktion");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
