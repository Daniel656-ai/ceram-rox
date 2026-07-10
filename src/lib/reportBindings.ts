import { dbClient } from "@/lib/api/client";
import type { FieldBinding, FormLayoutData } from "@/lib/api/serviceFormLayouts";

/**
 * Zentraler Datenkontext für den Live-Bericht.
 * Wird einmal pro Auftrag geladen und dann für alle Bindings genutzt.
 */
export interface ReportDataContext {
  order: any;
  project: any | null;
  sample: any | null;
  measurements: any[];
  parametersByFieldKey: Record<string, string>;
  resultsFlat: Array<{ result_name: string; value: any; unit: string | null; remarks: string | null }>;
  uploads: any[];
}

const dtfDate = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" });
const dtfDateTime = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" });

export async function loadReportContext(orderId: string): Promise<ReportDataContext> {
  const { data: order, error } = await (dbClient as any)
    .from("measurement_orders")
    .select(`
      id, order_number, order_type, status, workflow_status, priority, notes,
      due_date, created_at, created_by, order_kind,
      pp_experiment_number, pp_v2o5_percent, pp_experiment_date,
      pp_previous_experiments, pp_experiment_kind, pp_masse_type, pp_remarks,
      projects:project_id (
        id, project_number, project_name, description, start_date, end_date, project_status
      ),
      samples:sample_id (
        id, sample_number, sample_name, description, status, sample_group
      )
    `)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Auftrag nicht gefunden");

  const { data: measurements } = await (dbClient as any)
    .from("order_measurements")
    .select(`
      id, measurement_number, status, actual_duration_hours, planned_hours,
      measurement_services:service_id (service_name, category, unit_of_measurement)
    `)
    .eq("order_id", orderId);

  const measurementIds = (measurements ?? []).map((m: any) => m.id);
  const [{ data: params }, { data: results }, { data: uploads }] = await Promise.all([
    measurementIds.length
      ? (dbClient as any).from("measurement_parameters").select("*").in("order_measurement_id", measurementIds)
      : { data: [] as any[] },
    measurementIds.length
      ? (dbClient as any).from("measurement_results").select("*").in("order_measurement_id", measurementIds)
      : { data: [] as any[] },
    (dbClient as any).from("order_upload_files").select("*").eq("order_id", orderId),
  ]);

  const parametersByFieldKey: Record<string, string> = {};
  for (const p of params ?? []) {
    const key = p.parameter_name;
    parametersByFieldKey[key] = p.parameter_value ?? "";
  }

  return {
    order,
    project: order.projects ?? null,
    sample: order.samples ?? null,
    measurements: measurements ?? [],
    parametersByFieldKey,
    resultsFlat: (results ?? []).map((r: any) => ({
      result_name: r.result_name,
      value: r.value,
      unit: r.unit,
      remarks: r.remarks,
    })),
    uploads: uploads ?? [],
  };
}

export interface ResolvedValue {
  /** Wert für Anzeige (string oder komplexe Struktur bei "table"). */
  display: string | number | null;
  /** Bei "table" liefert der Resolver eine strukturierte Tabelle. */
  table?: { columns: string[]; rows: any[][] };
  /** Rohwert (für Weiterverarbeitung, z.B. numerische Berechnungen). */
  raw?: any;
  /** true wenn das Feld auto-befüllt ist (Binding aufgelöst). */
  isBound: boolean;
  /** Text-Erklärung falls kein Wert gefunden. */
  missingReason?: string;
}

function fmt(value: any, hint?: "date" | "datetime"): string {
  if (value == null || value === "") return "";
  if (hint === "date" && typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return dtfDate.format(d);
  }
  if (hint === "datetime" && typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return dtfDateTime.format(d);
  }
  return String(value);
}

/**
 * Löst eine einzelne Bindung gegen den geladenen Kontext auf.
 * Kein Wert vorhanden → { display: "", isBound: true, missingReason: ... }.
 */
export function resolveBinding(binding: FieldBinding, ctx: ReportDataContext): ResolvedValue {
  const path = binding.path?.trim() ?? "";
  switch (binding.source) {
    case "order": {
      const v = (ctx.order as any)?.[path];
      const hint = path === "due_date" ? "date" : path === "created_at" ? "datetime" : undefined;
      return { display: fmt(v, hint), raw: v, isBound: true };
    }
    case "project": {
      const v = ctx.project ? (ctx.project as any)[path] : null;
      return { display: fmt(v), raw: v, isBound: true, missingReason: ctx.project ? undefined : "Kein Projekt verknüpft" };
    }
    case "sample": {
      const v = ctx.sample ? (ctx.sample as any)[path] : null;
      return { display: fmt(v), raw: v, isBound: true, missingReason: ctx.sample ? undefined : "Keine Probe verknüpft" };
    }
    case "customer_form": {
      // Zuerst PP-Feldabbildung prüfen, dann generisch über parametersByFieldKey.
      const ppMap: Record<string, any> = {
        V2O5: ctx.order?.pp_v2o5_percent,
        art_des_versuches: ctx.order?.pp_experiment_kind,
        massetyp: ctx.order?.pp_masse_type,
        frühere_versuche: ctx.order?.pp_previous_experiments,
        experiment_number: ctx.order?.pp_experiment_number,
        experiment_date: ctx.order?.pp_experiment_date,
        remarks: ctx.order?.pp_remarks,
      };
      const v = ppMap[path] ?? ctx.parametersByFieldKey[path];
      return { display: fmt(v, path.includes("date") ? "date" : undefined), raw: v, isBound: true };
    }
    case "employee_form":
    case "measurement_parameter": {
      const v = ctx.parametersByFieldKey[path];
      return { display: fmt(v), raw: v, isBound: true };
    }
    case "measurement_result": {
      if (path === "*" || path === "") {
        return {
          display: `${ctx.resultsFlat.length} Ergebnisse`,
          isBound: true,
          table: {
            columns: ["Parameter", "Wert", "Einheit", "Bemerkung"],
            rows: ctx.resultsFlat.map((r) => [r.result_name, r.value ?? "", r.unit ?? "", r.remarks ?? ""]),
          },
        };
      }
      const hit = ctx.resultsFlat.find((r) => r.result_name === path);
      return { display: fmt(hit?.value), raw: hit?.value, isBound: true };
    }
    case "computed": {
      const nums = ctx.resultsFlat.map((r) => Number(r.value)).filter((n) => !isNaN(n));
      if (/^sum\(/.test(path)) {
        const s = nums.reduce((a, b) => a + b, 0);
        return { display: fmt(s), raw: s, isBound: true };
      }
      if (/^avg\(/.test(path)) {
        const a = nums.length ? nums.reduce((x, y) => x + y, 0) / nums.length : 0;
        return { display: fmt(Math.round(a * 1000) / 1000), raw: a, isBound: true };
      }
      if (/^count\(/.test(path)) {
        return { display: ctx.measurements.length, raw: ctx.measurements.length, isBound: true };
      }
      return { display: "", isBound: true, missingReason: "Formel nicht unterstützt" };
    }
    case "free":
    default:
      return { display: "", isBound: false };
  }
}

/**
 * Liefert eine flache Liste aller Feld-IDs (`FormFieldRef.id`) die im Layout vorkommen.
 * Wird u.a. dafür verwendet, verwaiste Override-Einträge nach Layoutänderungen auszuräumen.
 */
export function listFieldRefIds(layout: FormLayoutData | null | undefined): string[] {
  if (!layout) return [];
  return layout.sections.flatMap((s) => s.fields.map((f) => f.id));
}
