/**
 * Aufbau des modularen Ergebnisberichts (rein).
 *
 * Erzeugt aus dem aktuell geöffneten Auftrag, den Ergebniszeilen und dem
 * redaktionellen Entwurf eine einheitliche Berichtsstruktur, die von der
 * Vorschau UND vom PDF-Export identisch verwendet wird.
 *
 * Regeln:
 * - Ergebnisse ausschließlich mit `is_official === true` (über
 *   `buildOrderResultStructure`), Messwert 0 ist gültig.
 * - Fehlende Werte bleiben leer, nichts wird ergänzt oder aus anderen
 *   Aufträgen übernommen.
 * - Statische Elemente über `docT(lang)`; Standardtexte in der passenden
 *   Sprachfassung; auftragsspezifische Texte unverändert.
 */
import { docLocale, docT } from "@/lib/customerDocumentation/i18n";
import { detectAnalysisKey } from "@/lib/customerDocumentation/serviceChapters";
import { buildOrderResultStructure } from "@/lib/orderResultsStructure";
import type { RawMeasurementRow } from "@/lib/orderResultsAggregation";
import { isEmptySpecValue, parseSpecValue, specLabelOf, specColLabel } from "@/lib/specValues";
import { visibleModules, type ModuleKey, type OrderReportDraft, type ReportLanguage } from "./config";

export interface ReportTable {
  columns: string[];
  rows: string[][];
}

export interface ReportSection {
  key: ModuleKey;
  heading: string;
  /** Feld/Wert-Paare (z. B. Deckblatt). */
  fields: { label: string; value: string }[];
  tables: ReportTable[];
  standardText: string;
  orderText: string;
  /** true, wenn das Modul keine passenden Daten enthält. */
  empty: boolean;
}

export interface RenderedReport {
  lang: ReportLanguage;
  title: string;
  sections: ReportSection[];
  generatedOn: string;
}

type T = ReturnType<typeof docT>;
const k = (t: T, key: string) => String(t(`modular_report.${key}`));

export function formatNumber(n: number, lang: ReportLanguage): string {
  return new Intl.NumberFormat(docLocale(lang), { maximumFractionDigits: 6 }).format(n);
}

function formatSpec(raw: unknown, t: T): string {
  const v = parseSpecValue(raw);
  const prim = (x: unknown): string => {
    if (x === true || x === "true") return k(t, "yes");
    if (x === false || x === "false") return k(t, "no");
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const label = o.label ?? o.name ?? o.display_name ?? o.value;
      if (label != null && typeof label !== "object") return String(label);
      return Object.entries(o)
        .filter(([key, y]) => !key.startsWith("__") && !isEmptySpecValue(y))
        .map(([key, y]) => `${specColLabel(key)}: ${prim(y)}`)
        .join(", ");
    }
    return String(x);
  };
  if (Array.isArray(v)) return v.filter((x) => !isEmptySpecValue(x)).map(prim).join("; ");
  return prim(v);
}

interface SampleLite { id?: string; sample_number?: string | null; sample_name?: string | null; description?: string | null }

function orderSamples(order: any): SampleLite[] {
  const out = new Map<string, SampleLite>();
  const add = (s: SampleLite | null | undefined) => {
    if (!s) return;
    const id = s.id ?? s.sample_number ?? "";
    if (id && !out.has(id)) out.set(id, s);
  };
  add(order?.samples);
  for (const l of order?.order_samples ?? []) add(l?.samples);
  return [...out.values()].sort((a, b) => String(a.sample_number ?? "").localeCompare(String(b.sample_number ?? ""), "de", { numeric: true }));
}

const ACTIVITY = new Set(["nox", "sox", "bench_nox", "bench_sox"]);
const OPTICAL_RE = /optisch|visuell|sichtpr|optical|visual|foto|photo/i;

function moduleForService(serviceName: string): ModuleKey | null {
  const key = detectAnalysisKey(serviceName);
  if (ACTIVITY.has(key)) return "activity";
  if (key === "rfa") return "chemical";
  if (OPTICAL_RE.test(serviceName)) return "optical";
  return null;
}

function resultTables(rows: RawMeasurementRow[], module: ModuleKey, t: T, lang: ReportLanguage): ReportTable[] {
  const structure = buildOrderResultStructure(rows);
  const table: ReportTable = {
    columns: [k(t, "col_sample"), k(t, "col_analysis"), k(t, "col_parameter"), k(t, "col_value"), k(t, "col_unit")],
    rows: [],
  };
  for (const sample of structure) {
    for (const service of sample.services) {
      if (moduleForService(service.serviceName) !== module) continue;
      for (const a of service.analyses) {
        for (const v of a.values) {
          const value = v.value !== null ? formatNumber(v.value, lang) : v.text ?? "";
          table.rows.push([sample.sampleNumber, a.label, v.label, value, v.unit ?? ""]);
        }
      }
    }
  }
  return table.rows.length ? [table] : [];
}

export function buildReport(opts: {
  order: any;
  resultRows: RawMeasurementRow[];
  draft: OrderReportDraft;
  now?: Date;
}): RenderedReport {
  const { order, resultRows, draft } = opts;
  const lang = draft.lang;
  const t = docT(lang);
  const locale = docLocale(lang);
  const now = opts.now ?? new Date();
  const generatedOn = now.toLocaleDateString(locale);
  const samples = orderSamples(order);

  const sections: ReportSection[] = visibleModules(draft.layout).map((m) => {
    const heading = (m.heading[lang] || "").trim() || k(t, `modules.${m.key}`);
    const section: ReportSection = {
      key: m.key,
      heading,
      fields: [],
      tables: [],
      standardText: m.standardText[lang] ?? "",
      orderText: draft.orderTexts[m.key] ?? "",
      empty: false,
    };

    switch (m.key) {
      case "cover": {
        const push = (labelKey: string, value: unknown) => {
          const s = value == null ? "" : String(value).trim();
          if (s) section.fields.push({ label: k(t, `fields.${labelKey}`), value: s });
        };
        push("order_number", order?.order_number);
        push("customer", order?.customer_name);
        push("project", [order?.projects?.project_number, order?.projects?.project_name].filter(Boolean).join(" – "));
        push("samples", samples.map((s) => [s.sample_number, s.sample_name].filter(Boolean).join(" ")).join(", "));
        push("report_date", generatedOn);
        push("author", draft.author);
        break;
      }
      case "samples": {
        if (samples.length) {
          section.tables.push({
            columns: [k(t, "col_sample_number"), k(t, "col_sample_name"), k(t, "col_description")],
            rows: samples.map((s) => [s.sample_number ?? "", s.sample_name ?? "", s.description ?? ""]),
          });
        }
        break;
      }
      case "requester_specs": {
        const rows: string[][] = [];
        for (const om of order?.order_measurements ?? []) {
          const service = om?.measurement_services?.service_name ?? "";
          const sample = om?.samples?.sample_number ?? "";
          for (const p of om?.measurement_parameters ?? []) {
            if (isEmptySpecValue(parseSpecValue(p?.parameter_value))) continue;
            rows.push([service, sample, specLabelOf(String(p?.parameter_name ?? "")), formatSpec(p.parameter_value, t), p?.unit ?? ""]);
          }
        }
        if (rows.length) {
          section.tables.push({
            columns: [k(t, "col_service"), k(t, "col_sample"), k(t, "col_parameter"), k(t, "col_value"), k(t, "col_unit")],
            rows,
          });
        }
        break;
      }
      case "activity":
      case "chemical":
      case "optical":
        section.tables = resultTables(resultRows, m.key, t, lang);
        break;
      default:
        break;
    }

    section.empty =
      section.fields.length === 0 && section.tables.length === 0 && !section.standardText.trim() && !section.orderText.trim();
    return section;
  });

  const title = draft.reportTitle.trim() || k(t, "default_title");
  return { lang, title, sections, generatedOn };
}
