/**
 * ROX – Feldverknüpfungen (Datenfunktion) und dynamische Ergebnisbezeichnungen
 * ===========================================================================
 *
 * Grundsätze:
 *  - Layout (Zeilen spannen, Ausrichtung) und Daten (Wertquelle) sind strikt
 *    getrennt: Layout liegt im Layoutbaum, die Wertquelle am Feld selbst.
 *  - Es gibt genau EIN Wertquellen-Modell: `form_fields.data_source`. Es wurde
 *    bereits für Workflow-Schritte eingeführt und wird hier lediglich um die
 *    Quelle „Feld aus demselben Formular“ erweitert. Weitere Quellen (Feld einer
 *    vorangegangenen Dienstleistung, globaler Wert …) lassen sich ergänzen, ohne
 *    das Datenmodell zu ändern.
 *  - Ergebnisbezeichnungen werden nur für die ANZEIGE aus verknüpften
 *    Bedingungen erzeugt. Die Bedingungen bleiben zusätzlich strukturiert
 *    erhalten (Wert + Einheit) und werden nie aus dem Anzeigetext geparst.
 */

import type { FormField } from "@/lib/api/formFields";

export type ValueSourceKind = "form_field" | "workflow_step";
export type ValueSourceMode = "display" | "copy" | "calc";

export interface ValueSourceRef {
  kind: ValueSourceKind;
  /** Feldschlüssel der Quelle. */
  field_key: string;
  /** Nur bei `workflow_step`: Schritt bzw. vorangegangene Dienstleistung. */
  step_key?: string;
  service_id?: string;
  /** Sprechende Herkunftsbezeichnung für die Anzeige („🔗 Wert aus …“). */
  label?: string;
}

export interface ValueSource {
  mode: ValueSourceMode;
  source: ValueSourceRef;
}

/** Liest die Wertquelle eines Feldes (leer = eigene Eingabe). */
export function readValueSource(field: Pick<FormField, "id"> & { data_source?: unknown }): ValueSource | null {
  const ds = (field as any)?.data_source;
  if (!ds || typeof ds !== "object") return null;
  const src = (ds as any).source;
  if (!src || typeof src !== "object" || !src.field_key) return null;
  const kind: ValueSourceKind = src.kind === "form_field" ? "form_field" : "workflow_step";
  return {
    mode: (["display", "copy", "calc"].includes((ds as any).mode) ? (ds as any).mode : "copy") as ValueSourceMode,
    source: {
      kind,
      field_key: String(src.field_key),
      step_key: src.step_key ? String(src.step_key) : undefined,
      service_id: src.service_id ? String(src.service_id) : undefined,
      label: src.label ? String(src.label) : undefined,
    },
  };
}

/** Verknüpfung mit einem Feld desselben Formulars? */
export function isSameFormLink(vs: ValueSource | null): boolean {
  return !!vs && vs.source.kind === "form_field";
}

/**
 * Numerischer Wert eines Feldwertes – für Berechnungen. Einheiten sind eigene
 * Attribute und dürfen niemals in die Mathematik gelangen; deutschsprachige
 * Dezimalkommas werden unterstützt.
 */
export function numericValue(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.replace(/\s/g, "").match(/^[-+]?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Anzeigeform einer Bedingung: `300 °C` (Wert und Einheit bleiben getrennt). */
export function formatConditionValue(raw: unknown, unit?: string | null): string {
  const v = raw == null ? "" : String(raw).trim();
  const u = (unit ?? "").trim();
  if (!v) return "";
  return u ? `${v} ${u}` : v;
}

/* -------------------------------------------------------------
 * Ergebnisbedingungen (dynamische Ergebnisbezeichnung)
 * ----------------------------------------------------------- */

/** Feldschlüssel der als Bedingung verknüpften Felder. */
export function readResultConditions(field: { metadata?: unknown } | null | undefined): string[] {
  const m = ((field as any)?.metadata ?? {}) as Record<string, unknown>;
  const list = (m as any).result_conditions;
  return Array.isArray(list) ? list.map((x) => String(x)).filter(Boolean) : [];
}

/** Schreibt die Bedingungen in ein Metadaten-Objekt (nicht-destruktiv). */
export function writeResultConditions(
  metadata: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const next = { ...metadata };
  if (keys.length) next.result_conditions = keys;
  else delete next.result_conditions;
  return next;
}

export interface ResultCondition {
  /** Feldschlüssel der Bedingung, z. B. `temperatur`. */
  key: string;
  /** Fachliche Bezeichnung, z. B. „Temperatur“. */
  label: string;
  /** Roher Wert (ohne Einheit). */
  value: string;
  /** Einheit als eigenes Attribut. */
  unit: string | null;
  /** Numerischer Wert, sofern vorhanden (für Filter, Sortierung, Diagramme). */
  numeric: number | null;
}

/** Ermittelt strukturierte Bedingungen aus Felddefinitionen und Werten. */
export function collectResultConditions(
  keys: string[],
  fields: FormField[],
  values: Record<string, unknown>,
): ResultCondition[] {
  const out: ResultCondition[] = [];
  for (const key of keys) {
    const def = fields.find((f) => f.field_key === key);
    const raw = values[key];
    const value = raw == null ? "" : String(raw).trim();
    if (!value) continue;
    out.push({
      key,
      label: def?.display_name || key,
      value,
      unit: (def?.unit ?? "").trim() || null,
      numeric: numericValue(raw),
    });
  }
  return out;
}

/**
 * Baut die Anzeigebezeichnung: `η-NO_{x}` + Bedingungen ⇒
 * `η-NO_{x}_{(300 °C)}`. Die gesamte Klammer inklusive Einheit ist
 * tiefgestellt (ROX-Rich-Text-Auszeichnung `_{…}`).
 */
export function buildConditionLabel(base: string, conditions: ResultCondition[]): string {
  const name = (base ?? "").trim();
  if (!conditions.length) return name;
  const inner = conditions
    .map((c) => formatConditionValue(c.value, c.unit))
    .filter(Boolean)
    .join(", ");
  if (!inner) return name;
  return `${name}_{(${inner})}`;
}

/** Bedingungen als flache, strukturierte Zuordnung (Speicherung im Ergebnis). */
export function conditionsToContext(conditions: ResultCondition[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of conditions) out[c.label] = formatConditionValue(c.value, c.unit);
  return out;
}

/* -------------------------------------------------------------
 * Verknüpfte Felder als Eingangsgröße von Berechnungen
 * -----------------------------------------------------------
 * Es gibt bewusst KEINE zweite Verknüpfungsstruktur: Berechnungen nutzen
 * dieselbe `form_fields.data_source`. Der verknüpfte Wert wird zur Laufzeit
 * aufgelöst und unter dem eigenen Feldschlüssel gespiegelt – damit sind
 * verknüpfte Felder in Formeln wie lokale Felder referenzierbar.
 */

/** Werte vorangegangener Schritte: step_key -> { field_key: Wert }. */
export type StepData = Record<string, Record<string, unknown> | undefined>;

/** Verknüpfung mit einem Feld einer vorangegangenen Dienstleistung? */
export function isPreviousServiceLink(vs: ValueSource | null): boolean {
  return !!vs && vs.source.kind === "workflow_step" && !!vs.source.step_key;
}

/** Besitzt das Feld überhaupt eine Wertquelle (lokal oder vorgelagert)? */
export function isLinkedField(field: { data_source?: unknown } | null | undefined): boolean {
  return !!readValueSource((field ?? {}) as any);
}

/** Sprechende Herkunft für die Anzeige im Berechnungs-/Formeleditor. */
export function linkOriginLabel(vs: ValueSource | null): string | null {
  if (!vs) return null;
  if (vs.source.kind === "form_field") return vs.source.label || vs.source.field_key;
  return vs.source.label || [vs.source.step_key, vs.source.field_key].filter(Boolean).join(" → ");
}

/**
 * Aktueller Wert einer Verknüpfung. Kein Ersatzwert (nie 0): fehlt der Wert,
 * wird `null` geliefert und die Berechnung bleibt „nicht berechenbar“.
 */
export function resolveLinkedValue(
  vs: ValueSource | null,
  ctx: { formValues?: Record<string, unknown>; stepData?: StepData },
): unknown {
  if (!vs) return null;
  const raw = vs.source.kind === "form_field"
    ? ctx.formValues?.[vs.source.field_key]
    : ctx.stepData?.[vs.source.step_key ?? ""]?.[vs.source.field_key];
  return raw === undefined || raw === "" ? null : raw;
}
