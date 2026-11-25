/**
 * Temperaturblock (Wiederholungsblock mit Temperaturen, z. B. `temperatur_12` im NOx-Formular).
 * ==============================================================================================
 *
 * Der Auftraggeber trägt die Temperaturen als Liste ein. Ein Eintrag hat KEINE Stufennummer:
 * Eintrag i gehört zu Temperaturstufe i (Reihenfolge der Eingabe, erster Eintrag = Stufe 1).
 * Leere Einträge lassen ihre Stufe frei, ohne die anderen zu verschieben. Damit hängt die Zuordnung
 * zu η-NOx, K-Wert und Gasen (je Stufe) allein an der Reihenfolge – deshalb darf die Reihenfolge nicht
 * verändert werden, sobald Messwerte je Stufe vorliegen (siehe `hasStepMeasurementValues`).
 *
 * Erkennung nicht über feste Schlüssel wie `temperatur_12`, sondern über die Struktur:
 * Block heißt `temperatur` / `temperatur_<n>` und alle Unterfelder sind Zahlen in °C.
 */
import { parseGasInOut } from "@/lib/elementKeys";
import { parseStructuredText } from "@/lib/results/structuredValues";

const BLOCK_NAME = /^temperatur(?:_\d+)?$/i;
const NUMERIC_TYPES = new Set(["number", "decimal", "percent"]);

interface BlockFieldLike { field_key: string; field_type: string; unit?: string | null; metadata?: unknown }
interface ChildLike { field_type: string; unit?: string | null }

const isCelsius = (unit: string | null | undefined) => /^\s*°\s*c\s*$/i.test(unit ?? "");

/** Schlüssel, unter dem die Liste gespeichert wird (`storage_key` oder Feldschlüssel). */
export function blockStorageKey(repeater: BlockFieldLike): string {
  const sk = (repeater.metadata as { repeater?: { storage_key?: unknown } } | null | undefined)?.repeater?.storage_key;
  return typeof sk === "string" && sk ? sk : repeater.field_key;
}

/** Wiederholungsblock, dessen Unterfelder ausschließlich Temperaturen in °C sind. */
export function isTemperatureBlock(repeater: BlockFieldLike, children: ChildLike[]): boolean {
  if (repeater.field_type !== "repeater") return false;
  if (!BLOCK_NAME.test(blockStorageKey(repeater)) && !BLOCK_NAME.test(repeater.field_key)) return false;
  return children.length > 0 && children.every((c) => NUMERIC_TYPES.has(c.field_type) && isCelsius(c.unit));
}

/** Wert eines Eintrags: Zahl (auch „200,5“) oder null, wenn leer/ungültig. */
export function temperatureOf(entry: unknown): number | null {
  if (!entry || typeof entry !== "object") return null;
  for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
    if (k.startsWith("__")) continue;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.trim().replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

/** Einträge mit Wert, jeweils mit ihrer Stufe (1-basiert, Position in der Liste). */
export function filledTemperatureSteps(entries: unknown): Array<{ step: number; value: number }> {
  if (!Array.isArray(entries)) return [];
  const out: Array<{ step: number; value: number }> = [];
  entries.forEach((e, i) => {
    const value = temperatureOf(e);
    if (value !== null) out.push({ step: i + 1, value });
  });
  return out;
}

/**
 * Die als Text gespeicherte Liste eines Ergebnisses (`remarks`) als Temperaturliste lesen.
 * null, wenn es keine Liste reiner Temperatureinträge ist.
 */
export function parseTemperatureList(remarks: string | null | undefined): Array<number | null> | null {
  const parsed = parseStructuredText(remarks);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const ok = parsed.every((e) =>
    e !== null && typeof e === "object" && !Array.isArray(e) &&
    Object.keys(e as object).filter((k) => !k.startsWith("__")).every((k) => /^temperatur/i.test(k)));
  return ok ? parsed.map((e) => temperatureOf(e)) : null;
}

/** Ergebnisname der Zeilenwerte: `<…>temperatur_12[<Zeilenkennung>].<Unterfeld>`; liefert die Zeilenkennung. */
export function temperatureRowInstance(resultKey: string): string | null {
  const m = /^temperatur(?:_\d+)?\[([^\]]+)\]\./i.exec(resultKey);
  return m ? m[1] : null;
}

/** Stufe aus einer positionsbasierten Zeilenkennung `idx_<n>` (1-basiert), sonst null. */
export function stepOfInstance(instanceId: string): number | null {
  const m = /^idx_(\d+)$/.exec(instanceId);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Sperre                                                              */
/* ------------------------------------------------------------------ */

/** Feldschlüssel eines Messwerts je Temperaturstufe (η-NOx, K-Wert, Gas ein/aus). */
export function isStepMeasurementKey(rawKey: string): boolean {
  const key = (rawKey.startsWith("form:") ? rawKey.slice(rawKey.indexOf(":", 5) + 1) : rawKey).toLowerCase();
  if (/^eta_nox(?:_kopie)*$/.test(key) || /^k_wert(?:_kopie)*$/.test(key)) return true;
  return parseGasInOut(key) !== null;
}

const hasValue = (v: unknown) =>
  typeof v === "number" ? Number.isFinite(v) : typeof v === "string" ? v.trim() !== "" : false;

/** true, sobald irgendein Messwert je Stufe (η-NOx, K-Wert, Gas) einen Wert hat. */
export function hasStepMeasurementValues(values: Record<string, unknown> | null | undefined): boolean {
  if (!values) return false;
  return Object.entries(values).some(([k, v]) => isStepMeasurementKey(k) && hasValue(v));
}
