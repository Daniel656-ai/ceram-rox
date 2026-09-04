// Fertigungsfreigabe: strukturierte Erkennung aus PDF-Text.
// Nutzt das Lovable AI Gateway mit Tool-Calling, damit die Antwort strikt dem
// Feldkatalog von ROX entspricht (keine Freitext-Blobs).
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
    description: "Liefert die strukturiert erkannten Daten einer Fertigungsfreigabe.",
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
- Datumsangaben als TT.MM.JJJJ oder JJJJ-MM-TT so übernehmen wie im Dokument.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileName, pages } = await req.json();
    const text = (Array.isArray(pages) ? pages : [])
      .map((p: string, i: number) => `--- Seite ${i + 1} ---\n${p}`)
      .join("\n\n")
      .slice(0, 120000);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY fehlt");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Dokument: ${fileName ?? "unbekannt"}\n\n${text}` },
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

    return new Response(JSON.stringify({ fields, testParameters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
