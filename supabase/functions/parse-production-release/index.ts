// Fertigungsfreigabe: strukturierte Erkennung aus PDF-Text UND visuellen Merkmalen.
// Nutzt das Lovable AI Gateway mit Tool-Calling, damit die Antwort strikt dem
// Feldkatalog von ROX entspricht (keine Freitext-Blobs).
//
// Quellenunabhängig: der Aufrufer (PDF-Upload heute, Outlook-Anhang später)
// liefert immer dieselbe Struktur.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIELD_KEYS = [
  "project_name", "customer_name", "end_customer", "sales_owner", "cost_center_code",
  "recipe", "product_type", "article_number", "drawing_approval", "delivery_date",
  "completion_date", "delivery_address", "delivery_terms", "packaging", "freight_costs",
  "piece_count", "elements_total", "normal_modules", "test_modules", "spare_elements",
  "sample_elements", "module_material", "accessories", "module_costs", "accessory_costs",
  "costs_per_module", "module_numbering", "test_elements_per_module", "module_flow",
  "length_mm", "length_tolerance", "cross_section_mm", "cross_section_tolerance",
  "inner_wall_thickness_mm", "inner_wall_tolerance", "target_geometry", "cell_configuration",
  "v2o5_percent", "sorting_criteria", "test_conditions_remarks", "qa_qc_requirements", "remarks",
];

const SECTIONS = ["nox_bench", "sox_bench", "nox_micro", "sox_micro", "other"];
const PARAMS = [
  "target_k", "flowrate", "no_concentration", "alpha",
  "so2_concentration", "h2o", "o2", "temperature", "av",
];

const fieldProps: Record<string, unknown> = {};
for (const k of FIELD_KEYS) fieldProps[k] = { type: "string", description: `Wert für ${k}, leer lassen wenn nicht im Dokument` };

const tool = {
  type: "function",
  function: {
    name: "submit_production_release",
    description: "Liefert die strukturiert erkannten Daten einer Fertigungsfreigabe inkl. Revisionsmerkmalen.",
    parameters: {
      type: "object",
      properties: {
        fields: { type: "object", properties: fieldProps, additionalProperties: false },
        testParameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              section: { type: "string", enum: SECTIONS },
              parameter_key: { type: "string", enum: PARAMS },
              value_text: { type: "string" },
              unit: { type: "string" },
            },
            required: ["section", "parameter_key", "value_text"],
            additionalProperties: false,
          },
        },
        document: {
          type: "object",
          description: "Dokumentkennungen zur Identifikation von Neuanlage vs. Revision.",
          properties: {
            release_number: { type: "string", description: "Fertigungsfreigabenummer / Dokumentnummer, z.B. 0075-6107" },
            revision_number: { type: "string", description: "Revisions-/Änderungsnummer als Zahl, z.B. 2" },
            revision_date: { type: "string", description: "Änderungsdatum wie im Dokument" },
            order_number: { type: "string" },
            project_number: { type: "string" },
            customer_number: { type: "string" },
            drawing_number: { type: "string" },
            is_revision: { type: "boolean", description: "true, wenn das Dokument als Revision/Änderung gekennzeichnet ist" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          additionalProperties: false,
        },
        changes: {
          type: "array",
          description:
            "Erkannte Änderungen gegenüber dem bisherigen Stand. NUR Änderungen aufnehmen, die im Dokument belegt sind (durchgestrichen, rot, oder abweichend zum übergebenen bisherigen Stand).",
          items: {
            type: "object",
            properties: {
              field_key: { type: "string", description: "Feldschlüssel aus dem Katalog, oder leer wenn unklar" },
              field_hint: { type: "string", description: "Bezeichnung im Dokument, wenn field_key unklar ist" },
              old_value: { type: "string" },
              new_value: { type: "string" },
              detection: { type: "string", enum: ["strikethrough", "red", "combined", "text", "unknown"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              page: { type: "number" },
              note: { type: "string", description: "Warum unsicher (nur bei confidence medium/low)" },
            },
            required: ["detection", "confidence"],
            additionalProperties: false,
          },
        },
      },
      required: ["fields", "testParameters"],
      additionalProperties: false,
    },
  },
};

const SYSTEM = `Du extrahierst Daten aus Produktions-/Fertigungsfreigabe-Dokumenten (deutsch und englisch).
Regeln:
- Übernimm ausschließlich Werte, die im Text tatsächlich vorkommen. Nichts erfinden.
- Leere oder nicht vorhandene Felder weglassen.
- Zahlen ohne Tausenderpunkte, Dezimaltrennzeichen wie im Dokument.
- Toleranzen ("±2", "+2/-2") gehören in die zugehörigen *_tolerance Felder, der Nennwert in das Zahlenfeld.
- Geometrie: L = length_mm, D = cross_section_mm, ti = inner_wall_thickness_mm, Zellkonfiguration z.B. "75x75" -> cell_configuration, V2O5 -> v2o5_percent.
- Das Beiblatt (meist Seite 2) enthält Prüfbedingungen für NOx/SOx im Bench und im Micro-Reaktor.
  Ordne jeden Wert dem richtigen Abschnitt (section) und Parameter (parameter_key) zu.
- Datumsangaben als TT.MM.JJJJ oder JJJJ-MM-TT so übernehmen wie im Dokument.

REVISIONEN:
- Im Text sind visuelle Merkmale markiert: [DURCHGESTRICHEN:alterWert] und [ROT:neuerWert].
- Zusätzlich bekommst du eine Liste räumlich zugeordneter Paare (alter/neuer Wert) und ggf. den
  bisher in ROX gespeicherten Stand.
- Ein durchgestrichener Wert ist IMMER der alte Wert; der räumlich zugeordnete nicht durchgestrichene
  bzw. rote Wert ist der neue Wert.
- Ein rot dargestellter Wert ohne Durchstreichung ist der neue Wert; der bisher gespeicherte Wert ist der alte.
- In "fields" gehört immer der NEUE, gültige Wert.
- confidence "high" nur, wenn Feldzuordnung, alter und neuer Wert eindeutig sind.
- Wenn unklar ist, welches Feld betroffen ist oder welcher Wert gilt: confidence "low" oder "medium"
  setzen und den Wert NICHT in "fields" schreiben. Niemals raten.
- Erkenne Fertigungsfreigabenummer, Revisionsnummer und Änderungsdatum, sofern vorhanden.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const fileName: string = body?.fileName ?? "unbekannt";
    const pages: string[] = Array.isArray(body?.pages) ? body.pages : [];
    const pairs: unknown[] = Array.isArray(body?.pairs) ? body.pairs : [];
    const images: string[] = Array.isArray(body?.images) ? body.images : [];
    const existing = body?.existing ?? null;

    const text = pages
      .map((p: string, i: number) => `--- Seite ${i + 1} ---\n${p}`)
      .join("\n\n")
      .slice(0, 120000);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY fehlt");

    const parts: Record<string, unknown>[] = [];
    let prompt = `Dokument: ${fileName}\n\n${text}`;
    if (pairs.length) {
      prompt += `\n\n--- Visuell erkannte Änderungspaare (alt -> neu, mit Kontext) ---\n${
        JSON.stringify(pairs).slice(0, 20000)
      }`;
    }
    if (existing) {
      prompt += `\n\n--- Bisher in ROX gespeicherter Stand dieser Fertigungsfreigabe ---\n${
        JSON.stringify(existing).slice(0, 20000)
      }\nVergleiche damit und melde nur tatsächliche Abweichungen als "changes".`;
    }
    if (images.length) {
      prompt += `\n\nEinige Seiten enthielten keinen auslesbaren Text. Lies diese Seiten als Bild (OCR) aus.`;
    }
    parts.push({ type: "text", text: prompt });
    for (const img of images.slice(0, 4)) {
      parts.push({ type: "image_url", image_url: { url: img } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: parts },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_production_release" } },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${await res.text()}`);

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.fields ?? {})) {
      if (v !== null && v !== undefined && String(v).trim() !== "") fields[k] = String(v).trim();
    }
    const testParameters = (parsed.testParameters ?? []).filter(
      (t: { value_text?: string }) => t?.value_text && String(t.value_text).trim() !== "",
    );
    const changes = (parsed.changes ?? []).filter(
      (c: { old_value?: string; new_value?: string }) =>
        (c?.old_value && String(c.old_value).trim() !== "") ||
        (c?.new_value && String(c.new_value).trim() !== ""),
    );

    return new Response(
      JSON.stringify({ fields, testParameters, document: parsed.document ?? {}, changes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
