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

/** Kurzform einer beliebigen Ausnahme für Log und Diagnosefeld. */
function describe(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === "string") return e.slice(0, 500);
  try {
    return JSON.stringify(e).slice(0, 500);
  } catch {
    return String(e);
  }
}

/**
 * Strukturierte Fehlerantwort – nie ein roher Stacktrace an das Frontend,
 * aber immer ein Fehlercode plus knappe Diagnose, damit der Fehler nicht
 * als generischer 500er verschluckt wird.
 */
function fail(status: number, code: string, message: string, technical?: unknown) {
  const detail = technical === undefined ? undefined : describe(technical);
  console.error(`[parse-production-release] ${code} (${status}): ${detail ?? message}`);
  return new Response(
    JSON.stringify({ success: false, error_code: code, message, detail, status }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Obergrenze für den KI-Aufruf; danach lieber ein klarer Timeout als ein toter Worker. */
const AI_TIMEOUT_MS = 110_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Ungültiger Aufruf des Importdienstes.");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    return fail(400, "INVALID_PAYLOAD", "Die Importdaten konnten nicht gelesen werden.", e);
  }

  const fileName: string = typeof body?.fileName === "string" ? body.fileName : "unbekannt";
  const pages: string[] = Array.isArray(body?.pages) ? (body.pages as string[]).map(String) : [];
  const pairs: unknown[] = Array.isArray(body?.pairs) ? body.pairs : [];
  const images: string[] = Array.isArray(body?.images) ? (body.images as string[]).map(String) : [];
  const existing = body?.existing ?? null;
  const pageNumbers: number[] = Array.isArray(body?.pageNumbers)
    ? (body.pageNumbers as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
  const totalPages: number = Number(body?.totalPages) || pages.length;
  // Blockverarbeitung: ein Block ohne erkennbare Daten ist kein Fehler,
  // solange andere Blöcke desselben Dokuments Daten liefern.
  const partial = body?.partial === true;

  console.log(
    `[parse-production-release] Start: datei="${fileName}" seiten=${pages.length} ` +
      `seitenNr=${pageNumbers.join(",") || "-"} vonGesamt=${totalPages} zeichen=${pages.join("").length} paare=${pairs.length} bilder=${images.length} ` +
      `bildKB=${Math.round(images.join("").length / 1024)} revisionVergleich=${existing ? "ja" : "nein"}`,
  );

  const text = pages
    .map((p: string, i: number) => `--- Seite ${pageNumbers[i] ?? i + 1} von ${totalPages} ---\n${p}`)
    .join("\n\n")
    .slice(0, 120000);

  const rawTextLength = pages.join("").replace(/\s/g, "").length;
  if (!rawTextLength && !images.length) {
    if (partial) {
      return new Response(
        JSON.stringify({ success: true, fields: {}, testParameters: [], document: {}, changes: [], empty: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return fail(
      400,
      "PDF_EMPTY",
      "Aus dieser Datei konnten weder Text noch Seitenbilder gelesen werden. Bitte prüfen, ob es sich um eine gültige Fertigungsfreigabe handelt.",
    );
  }

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return fail(500, "CONFIG_MISSING", "Die Dokumenterkennung ist derzeit nicht verfügbar.");
  }

  try {
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

    const payload = JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: parts },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "submit_production_release" } },
    });

    // Ein Wiederholungsversuch bei vorübergehenden Serverfehlern, jeweils mit
    // hartem Timeout – sonst stirbt der Worker ohne verwertbare Antwort.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      try {
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: payload,
          signal: ctrl.signal,
        });
      } catch (e) {
        const aborted = e instanceof Error && e.name === "AbortError";
        console.error(
          `[parse-production-release] AI Gateway Versuch ${attempt + 1} fehlgeschlagen nach ` +
            `${Date.now() - started} ms: ${describe(e)}`,
        );
        if (attempt === 1) {
          return aborted
            ? fail(
              504,
              "AI_TIMEOUT",
              "Die Dokumenterkennung hat zu lange gedauert. Bitte das PDF erneut importieren oder auf die relevanten Seiten kürzen.",
              e,
            )
            : fail(502, "AI_UNAVAILABLE", "Die Dokumenterkennung ist derzeit nicht erreichbar.", e);
        }
        await new Promise((r) => setTimeout(r, 800));
        continue;
      } finally {
        clearTimeout(timer);
      }
      console.log(
        `[parse-production-release] AI Gateway ${res.status} nach ${Date.now() - started} ms (Versuch ${attempt + 1})`,
      );
      if (res.status < 500) break;
      await new Promise((r) => setTimeout(r, 800));
    }
    if (!res) return fail(502, "AI_UNAVAILABLE", "Die Dokumenterkennung ist derzeit nicht erreichbar.");

    if (res.status === 429) {
      return fail(429, "RATE_LIMITED", "Zu viele Importe in kurzer Zeit. Bitte in einer Minute erneut versuchen.");
    }
    if (res.status === 402) {
      return fail(402, "PAYMENT_REQUIRED", "Das Kontingent für die Dokumenterkennung ist aufgebraucht.");
    }
    if (!res.ok) {
      return fail(502, "AI_ERROR", "Die Fertigungsfreigabe konnte nicht ausgewertet werden.", `${res.status}: ${await res.text()}`);
    }

    let json: Record<string, unknown>;
    try {
      json = await res.json();
    } catch (e) {
      return fail(502, "AI_BAD_RESPONSE", "Die Antwort der Dokumenterkennung war unlesbar.", e);
    }
    // deno-lint-ignore no-explicit-any
    const call = (json as any)?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return fail(422, "NO_DATA_RECOGNIZED", "In diesem Dokument wurden keine Fertigungsfreigabedaten erkannt.", json);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (e) {
      return fail(422, "PDF_PARSE_ERROR", "Die Fertigungsfreigabe konnte nicht gelesen werden.", e);
    }

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries((parsed.fields ?? {}) as Record<string, unknown>)) {
      if (v !== null && v !== undefined && String(v).trim() !== "") fields[k] = String(v).trim();
    }
    const testParameters = ((parsed.testParameters ?? []) as { value_text?: string }[]).filter(
      (t) => t?.value_text && String(t.value_text).trim() !== "",
    );
    const changes = ((parsed.changes ?? []) as { old_value?: string; new_value?: string }[]).filter(
      (c) =>
        (c?.old_value && String(c.old_value).trim() !== "") ||
        (c?.new_value && String(c.new_value).trim() !== ""),
    );

    const doc = (parsed.document ?? {}) as Record<string, unknown>;
    const docHasIdentifiers = ["release_number", "revision_number", "order_number", "project_number", "drawing_number"]
      .some((k) => doc[k] !== undefined && String(doc[k] ?? "").trim() !== "");

    if (!Object.keys(fields).length && !testParameters.length && !changes.length && !docHasIdentifiers) {
      if (partial) {
        console.log(`[parse-production-release] Block ohne Daten (Seiten ${pageNumbers.join(",")}) – kein Fehler.`);
        return new Response(
          JSON.stringify({ success: true, fields: {}, testParameters: [], document: {}, changes: [], empty: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return fail(
        422,
        "NO_DATA_RECOGNIZED",
        "In diesem Dokument wurden keine Fertigungsfreigabedaten erkannt.",
        { fileName },
      );
    }

    return new Response(
      JSON.stringify({ success: true, fields, testParameters, document: parsed.document ?? {}, changes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return fail(500, "UNEXPECTED_ERROR", "Beim Import ist ein unerwarteter Fehler aufgetreten.", e);
  }
});
