/**
 * Auftrags-Laufzettel: reine, lesende Zusammenführung ALLER Vorgaben genau
 * eines Auftrags (Auftragsformular + alle Dienstleistungen, mit oder ohne
 * Probe). Keine Deduplizierung zwischen Quellen, nichts wird gespeichert.
 */
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { resolveOrderKind } from "@/lib/orders/orderKind";
import { parseSpecValue, primSpecValue, isEmptySpecValue } from "@/lib/specValues";
import { sortPppServices, type PppGroup, type PppLists } from "./pppGroups";

export interface OrderRunSheetField {
  id: string; field_key: string; display_name?: string | null; unit?: string | null;
  field_type?: string | null; parent_field_id?: string | null; metadata?: any;
}

export interface RunSheetParam { id: string; name: string; raw: string | null; unit: string | null }

/** Repeater-Zeilen eines Parameters, nach tatsächlichem Mundstückwert gruppiert. */
export interface MsGroup {
  /** Fachliche Bezeichnung aus dem gespeicherten MS-Wert, nie aus dem Zeilenindex. */
  label: string;
  /** ID des Ursprungsparameters (wird in der allgemeinen Tabelle ausgelassen). */
  paramId: string;
  /** Spalten ohne Mundstückschlüssel und ohne interne __-Schlüssel. */
  cols: string[];
  rows: Record<string, unknown>[];
}

export interface OrderRunSheetService {
  measurementId: string; measurementNumber: string | null; serviceName: string; sampleNumber: string | null;
  serviceId: string | null; status: string | null;
  pppGroup: PppGroup | null; pppReason?: string;
  params: RunSheetParam[];
  msGroups: MsGroup[];
}

/** Eine der drei PPP-Auswahllisten des Auftragsformulars (lesbare Werte). */
export interface PppSelection {
  id: "prozesse" | "standard" | "analyse";
  key: string;
  label: string;
  values: string[];
}

/** Knetungs-Angaben für den zweispaltigen Bereich des Pilot-Plant-Laufzettels. */
export interface KnetungBlock {
  vorbereitendeTaetigkeiten: string | null;
  knetdauer: { value: string; unit: string | null } | null;
  /** Rohstoffzeilen (Rohwerte; Materialauflösung erst bei der Darstellung). */
  rohstoffe: Record<string, unknown>[];
  /** Nicht verbrauchte übrige Knetungs-Parameter (gehen nie verloren). */
  otherParams: RunSheetParam[];
}

export interface OrderRunSheet {
  number: string;
  /** Nur gesetzt, wenn abweichend von der angezeigten Nummer. */
  technicalNumber: string | null;
  customerName: string | null;
  project: string | null;
  dueDate: string | null;
  priority: string | null;
  notes: string | null;
  /** Tatsächliches Erstellungsdatum des Auftrags (measurement_orders.created_at). */
  createdAt: string | null;
  /** Letzte order_spec_updated-Änderung dieses Auftrags (nur Dienstleistungsvorgaben). */
  lastSpecChange: string | null;
  form: { key: string; label: string | null; unit: string | null; raw: unknown; colLabels: Map<string, string> }[];
  /** Die drei PPP-Auswahllisten (aus dem Formular herausgelöst). */
  pppSelections: PppSelection[];
  /** true = Pilot Plant: Dienstleistungen nach Stammdatenlisten gruppiert. */
  grouped: boolean;
  services: OrderRunSheetService[];
  knetung: KnetungBlock | null;
}

const storageKey = (f: OrderRunSheetField) => {
  const sk = f.metadata?.repeater?.storage_key;
  return typeof sk === "string" && sk.trim() ? sk : f.field_key;
};

const normKey = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Die drei PPP-Auswahlfelder: Zuordnung über Feldschlüssel oder Anzeigename. */
const PPP_SELECTION_DEFS: { id: PppSelection["id"]; fallbackLabel: string; match: (key: string, display: string) => boolean }[] = [
  { id: "prozesse", fallbackLabel: "Gewünschte Pilot Plant Prozesse",
    match: (k, d) => k.includes("pilotplantprozesse") || d === "gewuenschtepilotplantprozesse" },
  { id: "standard", fallbackLabel: "Standardprüfungen PPP",
    match: (k, d) => k.includes("standardpruefungen") || d === "standardpruefungenppp" },
  { id: "analyse", fallbackLabel: "Analyse PPP",
    match: (k, d) => k === "analyseppp" || d === "analyseppp" },
];

const pppSelectionId = (key: string, display?: string | null) =>
  PPP_SELECTION_DEFS.find((def) => def.match(normKey(key), normKey(display)))?.id ?? null;

/** Auswahlwerte als lesbare Texte; gespeicherte Werte bleiben unverändert. */
const selectionValues = (raw: unknown): string[] => {
  const v = parseSpecValue(raw);
  const items = Array.isArray(v) ? v : [v];
  return items.filter((x) => !isEmptySpecValue(x)).map((x) => primSpecValue(x));
};

/** Mundstückschlüssel einer Repeater-Zeile (ms / mundstucke / ms_auswahl …). */
const MS_KEY_RE = /^(ms|ms_auswahl|msauswahl|mundstucke|mundstuecke)$/i;
const msKeyOf = (row: Record<string, unknown>) => Object.keys(row).find((k) => MS_KEY_RE.test(k)) ?? null;

export const MS_FALLBACK_LABEL = "Mundstück nicht angegeben";

/**
 * Repeater-Parameter mit Mundstückfeld nach dem tatsächlichen MS-Wert gruppieren.
 * Der Zeilenindex wird nie als Bezeichnung verwendet; führende Nullen bleiben
 * erhalten, weil der Wert ausschließlich als Zeichenkette gelesen wird.
 */
export function buildMsGroups(params: RunSheetParam[]): MsGroup[] {
  const groups: MsGroup[] = [];
  for (const p of params) {
    if (!p.name.startsWith("repeat:")) continue;
    const v = parseSpecValue(p.raw);
    if (!Array.isArray(v)) continue;
    const rows = v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
    if (rows.length === 0) continue;
    const msKey = rows.map(msKeyOf).find((k) => k !== null) ?? null;
    if (!msKey) continue;
    const byMs = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const raw = r[msKey];
      const ms = isEmptySpecValue(raw) ? "" : String(raw).trim();
      const bucket = byMs.get(ms) ?? [];
      bucket.push(r);
      byMs.set(ms, bucket);
    }
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__") && k !== msKey))));
    for (const [ms, msRows] of byMs) {
      groups.push({ label: ms ? `Mundstück ${ms}` : MS_FALLBACK_LABEL, paramId: p.id, cols, rows: msRows });
    }
  }
  return groups;
}

const VORBEREITENDE_RE = /vorbereit/i;
const KNETDAUER_RE = /knetdauer/i;
const ROHSTOFF_ROW_RE = /^(rohstoff|rohstoff_id|material|material_id)$/i;

/** Knetungs-Block: vorbereitende Tätigkeiten, Knetdauer und Rohstoffe lesend auflösen. */
function buildKnetungBlock(
  kneading: OrderRunSheetService | undefined,
  values: Record<string, unknown>,
): KnetungBlock | null {
  if (!kneading) return null;
  const consumed = new Set<string>();
  let vorbereitende: string | null = null;
  let knetdauer: KnetungBlock["knetdauer"] = null;
  const rohstoffe: Record<string, unknown>[] = [];

  for (const p of kneading.params) {
    if (VORBEREITENDE_RE.test(p.name) && !isEmptySpecValue(p.raw)) {
      vorbereitende = primSpecValue(parseSpecValue(p.raw));
      consumed.add(p.id);
      continue;
    }
    if (KNETDAUER_RE.test(p.name) && !isEmptySpecValue(p.raw)) {
      knetdauer = { value: primSpecValue(parseSpecValue(p.raw)), unit: p.unit };
      consumed.add(p.id);
      continue;
    }
    if (p.name.startsWith("repeat:")) {
      const v = parseSpecValue(p.raw);
      if (Array.isArray(v)) {
        const rows = v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
        if (rows.length > 0 && rows.some((r) => Object.keys(r).some((k) => ROHSTOFF_ROW_RE.test(k)))) {
          rohstoffe.push(...rows);
          consumed.add(p.id);
          continue;
        }
      }
    }
  }
  // Rückfall auf das Auftragsformular, falls die Messaufgabe das Feld nicht führt.
  if (!vorbereitende) {
    for (const [k, v] of Object.entries(values)) {
      if (VORBEREITENDE_RE.test(k) && !isEmptySpecValue(v)) { vorbereitende = primSpecValue(parseSpecValue(v)); break; }
    }
  }
  if (!knetdauer) {
    for (const [k, v] of Object.entries(values)) {
      if (KNETDAUER_RE.test(k) && !isEmptySpecValue(v)) { knetdauer = { value: primSpecValue(parseSpecValue(v)), unit: null }; break; }
    }
  }
  return {
    vorbereitendeTaetigkeiten: vorbereitende,
    knetdauer,
    rohstoffe,
    otherParams: kneading.params.filter((p) => !consumed.has(p.id)),
  };
}

export function buildOrderRunSheet(
  order: any,
  fields: OrderRunSheetField[],
  events: { event_type: string; order_id?: string | null; created_at: string }[],
  pppLists: PppLists = { masse: null, produkt: null },
): OrderRunSheet {
  const id = orderIdentity(order);
  const values = (order?.shared_form_data?.template?.values ?? {}) as Record<string, unknown>;
  const valueKeys = values && typeof values === "object" ? Object.keys(values) : [];

  const top = fields.filter((f) => !f.parent_field_id);
  const form: OrderRunSheet["form"] = [];
  const selections = new Map<PppSelection["id"], PppSelection>();
  const used = new Set<string>();
  const addSelection = (key: string, display: string | null | undefined, raw: unknown) => {
    const selId = pppSelectionId(key, display);
    if (!selId || selections.has(selId)) return false;
    const def = PPP_SELECTION_DEFS.find((d) => d.id === selId)!;
    selections.set(selId, { id: selId, key, label: display?.trim() || def.fallbackLabel, values: selectionValues(raw) });
    return true;
  };
  for (const f of top) {
    const k = storageKey(f);
    if (!(k in values) || used.has(k)) continue;
    used.add(k);
    if (addSelection(k, f.display_name, values[k])) continue;
    const colLabels = new Map<string, string>();
    for (const c of fields) {
      if (c.parent_field_id === f.id && c.display_name) colLabels.set(c.field_key, c.display_name);
    }
    form.push({ key: k, label: f.display_name?.trim() || null, unit: f.unit?.trim() || null, raw: values[k], colLabels });
  }
  // Werte ohne Feldbeschreibung nie verschweigen.
  for (const k of valueKeys) {
    if (used.has(k)) continue;
    used.add(k);
    if (addSelection(k, null, values[k])) continue;
    form.push({ key: k, label: null, unit: null, raw: values[k], colLabels: new Map() });
  }
  const pppSelections = PPP_SELECTION_DEFS.map((d) => selections.get(d.id)).filter((s): s is PppSelection => !!s);

  const base = ((order?.order_measurements ?? []) as any[])
    .filter((m) => !m.order_id || m.order_id === order.id)
    .map((m) => ({
      measurementId: m.id,
      measurementNumber: m.measurement_number ?? null,
      serviceName: m.measurement_services?.service_name ?? "–",
      sampleNumber: m.samples?.sample_number ?? null,
      serviceId: m.service_id ?? null,
      status: m.status ?? null,
      params: ((m.measurement_parameters ?? []) as any[]).map((p) => ({
        id: p.id, name: p.parameter_name, raw: p.parameter_value ?? null, unit: p.unit?.trim() || null,
      })),
    }));
  const grouped = !!order && resolveOrderKind(order) === "pilot_plant";
  const services: OrderRunSheetService[] = (grouped
    ? sortPppServices(base, pppLists)
    : base.map((s) => ({ ...s, pppGroup: null }))
  ).map((s) => ({ ...s, msGroups: buildMsGroups(s.params) }));

  const knetung = grouped
    ? buildKnetungBlock(services.find((s) => s.pppGroup === "knetung"), values)
    : null;

  let last: string | null = null;
  for (const e of events) {
    if (e.event_type !== "order_spec_updated" || (e.order_id && e.order_id !== order.id)) continue;
    if (!last || e.created_at > last) last = e.created_at;
  }

  return {
    number: id.number,
    technicalNumber: id.technicalNumber && id.technicalNumber !== id.number ? id.technicalNumber : null,
    customerName: order?.customer_name?.trim() || null,
    project: order?.projects ? [order.projects.project_number, order.projects.project_name].filter(Boolean).join(" – ") || null : null,
    dueDate: order?.due_date ?? null,
    priority: order?.priority ?? null,
    notes: order?.notes?.trim() || null,
    createdAt: order?.created_at ?? null,
    lastSpecChange: last,
    form,
    pppSelections,
    grouped,
    services,
    knetung,
  };
}

export function orderDmcPayload(number: string): string | null {
  return number.trim() ? `ROX|A:${number}` : null;
}

/**
 * Vorgeschlagener PDF-Dateiname des Laufzettels: „Laufzettel_<Versuchsnummer>"
 * (die Anzeigenummer ist bereits die aufgelöste Versuchsnummer; ohne
 * Versuchsnummer greift die Auftragsnummer als Rückfall). Ungültige
 * Dateizeichen werden ersetzt; der Wert selbst (inkl. führender Nullen)
 * bleibt unverändert – reine Darstellung, nichts wird gespeichert.
 */
export function runSheetFileName(number: string): string {
  const safe = number
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return `Laufzettel_${safe || "Auftrag"}`;
}

/**
 * Knetungs-Rohstofftabelle: `container_id` wird nicht angezeigt. Entfernt den
 * Schlüssel nur aus der Darstellung eines Zellwerts; gespeicherte Werte und
 * andere Bereiche bleiben unberührt.
 */
export function stripContainerId(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if ("container_id" in o) {
      const { container_id: _drop, ...rest } = o;
      return rest;
    }
  }
  return value;
}
