/**
 * Katalog der für einen Ergebnisbericht tatsächlich verfügbaren Felder.
 *
 * WICHTIG: Der Bericht ist nur eine Darstellungsebene. Es werden hier KEINE
 * eigenen Felder verwaltet – der Katalog wird dynamisch aus den bereits
 * vorhandenen Strukturen abgeleitet:
 *   - globale Felder / Auftragsfelder  (global_objects / global_fields)
 *   - Formularfelder                    (form_definitions / form_fields)
 *   - Dienstleistungsformulare          (service_form_links)
 *   - globale Berechnungen              (global_calculations)
 *   - Repeater inkl. Unterfelder        (metadata.repeater / metadata.subfields)
 */

export type ReportFieldKind = "value" | "repeater" | "computed";

export interface ReportSubfield {
  key: string;
  label: string;
  unit?: string | null;
}

export interface ReportFieldItem {
  /** Auflösbarer Pfad im Snapshot, z.B. "customer_form.hauptrohstoff". */
  path: string;
  label: string;
  kind: ReportFieldKind;
  dataType?: string | null;
  unit?: string | null;
  /** Nur bei kind === "repeater". */
  subfields?: ReportSubfield[];
  /** Herkunftsbeschreibung für die Anzeige (z.B. Formularname). */
  sourceLabel: string;
}

export interface ReportFieldGroup {
  key: string;
  label: string;
  items: ReportFieldItem[];
}

// ---------------------------------------------------------------- Auflösung

/**
 * Löst einen Pfad im Snapshot auf. Zusätzlich zu exakten Treffern werden
 * bekannte Ablageorte durchsucht, damit ein im Designer gewähltes Feld auch
 * dann gefunden wird, wenn es zur Laufzeit in einem anderen Formularbereich
 * gespeichert wurde.
 */
export function resolveReportPath(snapshot: any, path: string): unknown {
  if (!snapshot || !path) return undefined;
  const direct = pick(snapshot, path);
  if (direct !== undefined && direct !== null && direct !== "") return direct;

  const key = path.split(".").slice(1).join(".") || path;
  const fallbacks = [
    `customer_form.${key}`,
    `employee_form.${key}`,
    `order.${key}`,
    `shared_form_data.${key}`,
    `computed.${key}`,
  ];
  for (const f of fallbacks) {
    if (f === path) continue;
    const v = pick(snapshot, f);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return direct;
}

function pick(obj: any, path: string): unknown {
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// -------------------------------------------------------------- Formatierung

export type ReportNumberFormat = "auto" | "0" | "0.0" | "0.00" | "0.000" | "date" | "datetime" | "time";

export interface ReportFieldFormatting {
  format?: ReportNumberFormat;
  unit?: string | null;
  showUnit?: boolean;
  hideIfEmpty?: boolean;
}

export function formatReportValue(value: unknown, opts: ReportFieldFormatting = {}): string {
  const { format = "auto", unit, showUnit = true } = opts;
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";

  if (Array.isArray(value)) {
    if (!value.length) return "";
    if (typeof value[0] === "object") {
      return value.map((r) => Object.values(r as any).join(" · ")).join("\n");
    }
    return value.join(", ");
  }

  const raw = String(value);

  if (format === "date" || format === "datetime" || format === "time") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      if (format === "date") return d.toLocaleDateString("de-AT");
      if (format === "time") return d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleString("de-AT");
    }
    return raw;
  }

  let out = raw;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (isFinite(n) && raw.trim() !== "") {
    if (format === "0" || format === "0.0" || format === "0.00" || format === "0.000") {
      const dec = format === "0" ? 0 : format.split(".")[1].length;
      out = n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    } else if (typeof value === "number") {
      out = n.toLocaleString("de-DE");
    } else if (/^-?\d+(\.\d+)?$/.test(raw.trim())) {
      out = n.toLocaleString("de-DE");
    }
  } else if (typeof value === "object") {
    out = Object.entries(value as any).map(([k, v]) => `${k}: ${v}`).join(" · ");
  } else if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) out = d.toLocaleString("de-AT");
  }

  if (showUnit && unit) out = `${out} ${unit}`;
  return out;
}

/** Beispielwert für die Designer-Vorschau, wenn keine echten Daten existieren. */
export function sampleValueFor(item: Pick<ReportFieldItem, "dataType" | "label">): unknown {
  switch (item.dataType) {
    case "number":
    case "decimal":
      return 4.8;
    case "percent":
      return 12.5;
    case "boolean":
      return true;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "datetime":
      return new Date().toISOString();
    default:
      return `${item.label} (Beispiel)`;
  }
}
