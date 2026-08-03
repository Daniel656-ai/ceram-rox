// Edge function: ai-form-import
// Analysiert ein hochgeladenes Formular (PDF / PNG / JPG / Excel-Textraster)
// und liefert eine strukturierte ROX-Formularbeschreibung inkl. Feldzuordnung
// zu vorhandenen globalen Feldern zurück.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "google/gemini-3.6-flash";

interface GlobalFieldRef {
  id: string;
  binding_path: string;
  display_name: string;
  data_type: string;
  unit?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY nicht konfiguriert" }, 500);

    const body = await req.json().catch(() => ({}));
    const fileName = typeof body?.file_name === "string" ? body.file_name : "Formular";
    const fileData = typeof body?.file_data === "string" ? body.file_data : null; // data URL (pdf/image)
    const mimeType = typeof body?.mime_type === "string" ? body.mime_type : "";
    const sheetText = typeof body?.sheet_text === "string" ? body.sheet_text : null; // Excel/CSV Raster
    const globalFields: GlobalFieldRef[] = Array.isArray(body?.global_fields) ? body.global_fields : [];
    const learned: Array<{ label: string; binding_path: string }> = Array.isArray(body?.learned_mappings)
      ? body.learned_mappings
      : [];

    if (!fileData && !sheetText) {
      return json({ error: "file_data (PDF/Bild) oder sheet_text (Excel) erforderlich" }, 400);
    }

    const catalog = globalFields
      .map((f) => `${f.binding_path} | ${f.display_name} | ${f.data_type}${f.unit ? ` | ${f.unit}` : ""}`)
      .join("\n")
      .slice(0, 60000);

    const learnedText = learned
      .map((l) => `"${l.label}" -> ${l.binding_path}`)
      .join("\n")
      .slice(0, 12000);

    const system = [
      "Du bist ein Analysesystem für technische Labor- und Produktionsformulare (Deutsch).",
      "Analysiere das übergebene Formular und erzeuge eine strukturierte Beschreibung.",
      "Erkenne: Überschriften, Abschnitte/Gruppen, Tabellen (= Wiederholbereiche), Eingabefelder,",
      "Einheiten, Pflichtfelder, Auswahllisten, Bild-/Unterschriftsfelder und Rahmen/Panels.",
      "Ordne jedes erkannte Feld – wenn möglich – einem vorhandenen globalen Feld zu (binding_path aus dem Katalog).",
      "Schlage nur dann ein NEUES globales Feld vor, wenn keine passende Entsprechung existiert.",
      "Antworte AUSSCHLIESSLICH mit JSON gemäß Schema, ohne Markdown-Codeblock.",
      "",
      "JSON-Schema:",
      `{
  "form_name": string,
  "sections": [
    { "title": string, "description": string|null, "columns": 1|2|3,
      "repeater": boolean,
      "fields": [
        { "label": string,
          "field_key": string,           // snake_case, technisch
          "field_type": "text"|"longtext"|"number"|"decimal"|"percent"|"date"|"time"|"datetime"|"boolean"|"select"|"multiselect"|"file"|"image"|"handwriting",
          "unit": string|null,
          "required": boolean,
          "select_options": string[],
          "match_binding_path": string|null,   // exakter binding_path aus dem Katalog oder null
          "match_confidence": number,          // 0..1
          "suggest_new_global": boolean,
          "suggested_object_key": string|null, // z.B. "order", "extrusion"
          "notes": string|null }
      ] }
  ]
}`,
      "",
      "Katalog vorhandener globaler Felder (binding_path | Bezeichnung | Typ | Einheit):",
      catalog || "(leer)",
      learnedText ? `\nBereits bestätigte Zuordnungen (Lernwissen, bevorzugt verwenden):\n${learnedText}` : "",
    ].join("\n");

    const userContent: any[] = [
      { type: "text", text: `Dateiname: ${fileName}. Analysiere dieses Formular und liefere das JSON.` },
    ];
    if (sheetText) {
      userContent.push({ type: "text", text: `Tabelleninhalt (Excel/CSV):\n${sheetText.slice(0, 100000)}` });
    }
    if (fileData) {
      if (mimeType.startsWith("image/")) {
        userContent.push({ type: "image_url", image_url: { url: fileData } });
      } else {
        userContent.push({
          type: "file",
          file: { filename: fileName, file_data: fileData },
        });
      }
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("AI gateway error", resp.status, errBody);
      if (resp.status === 429) return json({ error: "Zu viele Anfragen. Bitte kurz warten." }, 429);
      if (resp.status === 402) return json({ error: "AI-Credits aufgebraucht." }, 402);
      return json({ error: "Analyse fehlgeschlagen", details: errBody }, resp.status);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch (_e) {
      console.error("JSON parse failed", raw?.slice?.(0, 500));
      return json({ error: "Die KI-Antwort konnte nicht gelesen werden." }, 502);
    }

    return json({ analysis: parsed }, 200);
  } catch (e) {
    console.error("ai-form-import error", e);
    return json({ error: (e as Error).message ?? "Unbekannter Fehler" }, 500);
  }
});

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) return t.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "");
  return t;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
