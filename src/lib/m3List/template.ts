/**
 * Formularvorlage der m³-Liste.
 *
 * Die m³-Liste ist eine ganz normale ROX-Formularvorlage (`form_definitions` +
 * `form_fields`) und daher im bestehenden Formulardesigner anpassbar. Sie wird
 * gezielt vervollständigt; vorhandene Felder und Benutzeränderungen werden
 * dabei nie überschrieben. Dargestellt wird sie überall (Web und ROX Desktop) mit
 * dem gemeinsamen `FormLayoutRenderer`.
 */
import { api } from "@/lib/api";
import type { FormField, FormFieldType } from "@/lib/api/formFields";

export const M3_FORM_NAME = "m³-Liste";

export type M3FieldRole = "grey" | "yellow" | "computed" | "row";

interface FieldSpec {
  field_key: string;
  display_name: string;
  field_type: FormFieldType;
  unit?: string | null;
  role: M3FieldRole;
  category: string;
  /** Quellfeld der Fertigungsfreigabe-Revision (nur bei „grey"). */
  release_field?: string;
  select_options?: string[];
  description?: string;
}

export const M3_HEADER_FIELDS: FieldSpec[] = [
  { field_key: "order_number", display_name: "Auftrag", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "order_number" },
  { field_key: "project_name", display_name: "Projekt", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "project_name" },
  { field_key: "customer_name", display_name: "Kunde", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "customer_name" },
  { field_key: "end_customer", display_name: "Endkunde", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "end_customer" },
  { field_key: "article_number", display_name: "Artikelnummer", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "article_number" },
  { field_key: "release_label", display_name: "Fertigungsfreigabe / Revision", field_type: "text", role: "grey", category: "Kopfdaten" },
  { field_key: "v2o5_percent", display_name: "V2O5", field_type: "decimal", unit: "%", role: "grey", category: "Kopfdaten", release_field: "v2o5_percent" },
  { field_key: "length_mm", display_name: "Länge", field_type: "number", unit: "mm", role: "grey", category: "Kopfdaten", release_field: "length_mm" },
  { field_key: "piece_count", display_name: "Stückzahl", field_type: "number", unit: "Stk", role: "grey", category: "Kopfdaten", release_field: "piece_count" },
  { field_key: "inner_wall_thickness_mm", display_name: "Innenwand ti", field_type: "decimal", unit: "mm", role: "grey", category: "Kopfdaten", release_field: "inner_wall_thickness_mm" },
  { field_key: "cross_section_mm", display_name: "Durchmesser D", field_type: "decimal", unit: "mm", role: "grey", category: "Kopfdaten", release_field: "cross_section_mm" },
  { field_key: "cell_configuration", display_name: "Zellkonfiguration", field_type: "text", role: "grey", category: "Kopfdaten", release_field: "cell_configuration" },
  { field_key: "completion_date", display_name: "Fertigstellung", field_type: "date", role: "grey", category: "Kopfdaten", release_field: "completion_date" },
  { field_key: "delivery_date", display_name: "Lieferdatum", field_type: "date", role: "grey", category: "Kopfdaten", release_field: "delivery_date" },
];

export const M3_CONTROL_FIELDS: FieldSpec[] = [
  { field_key: "delivery_volume_m3", display_name: "Liefermenge", field_type: "decimal", unit: "m³", role: "yellow", category: "Kontrollfelder" },
  { field_key: "av_nox", display_name: "AV-NOx", field_type: "decimal", role: "yellow", category: "Kontrollfelder" },
  { field_key: "av_sox", display_name: "AV-SOx", field_type: "decimal", role: "yellow", category: "Kontrollfelder" },
  { field_key: "sox_required", display_name: "SOx gefordert", field_type: "boolean", role: "yellow", category: "Kontrollfelder" },
  { field_key: "doku_date", display_name: "Doku-Termin", field_type: "date", role: "yellow", category: "Kontrollfelder" },
  { field_key: "spare_elements", display_name: "Ersatzelemente", field_type: "number", unit: "Stk", role: "yellow", category: "Kontrollfelder" },
  { field_key: "mounting_frames", display_name: "Einbaurahmen", field_type: "number", unit: "Stk", role: "yellow", category: "Kontrollfelder" },
  {
    field_key: "tolerance_variant", display_name: "Toleranzvariante", field_type: "select", role: "yellow",
    category: "Kontrollfelder", select_options: ["1", "2"],
    description: "Variante 1: L (+3/-3), D (+/-2). Variante 2: L (+0/-3), D (+2/-2).",
  },
  { field_key: "test_charge_element_number", display_name: "Elementnummer TEST-Charge", field_type: "text", role: "yellow", category: "Kontrollfelder" },
  { field_key: "bench_note", display_name: "Bench (manuelle Ergänzung)", field_type: "text", role: "yellow", category: "Kontrollfelder", description: "Bench bleibt manuell – z. B. „… + Bench“." },
];

export const M3_CALC_FIELDS: FieldSpec[] = [
  { field_key: "cell_count", display_name: "Zellenzahl", field_type: "number", role: "computed", category: "Berechnungen" },
  { field_key: "elements_per_m3", display_name: "Elemente je m³", field_type: "decimal", unit: "Stk", role: "computed", category: "Berechnungen" },
  { field_key: "marking_elements", display_name: "Mit TEST zu kennzeichnende Elemente (inkl. 10 %)", field_type: "number", unit: "Stk", role: "computed", category: "Berechnungen" },
  { field_key: "marking_rows", display_name: "Zu kennzeichnende m³-Zeilen", field_type: "number", role: "computed", category: "Berechnungen" },
  { field_key: "laborkat_length_mm", display_name: "Laborkat-Länge", field_type: "number", unit: "mm", role: "computed", category: "Berechnungen" },
  { field_key: "required_length_mm", display_name: "Notwendige Länge", field_type: "number", unit: "mm", role: "computed", category: "Berechnungen" },
  { field_key: "labor_kat_count", display_name: "Anzahl Labor-KAT", field_type: "number", role: "computed", category: "Berechnungen" },
  { field_key: "micro_nox", display_name: "Mikrostück NOx", field_type: "text", role: "computed", category: "Berechnungen" },
  { field_key: "micro_sox", display_name: "Mikrostück SOx", field_type: "text", role: "computed", category: "Berechnungen" },
  { field_key: "length_tolerance", display_name: "Längentoleranz", field_type: "text", role: "computed", category: "Berechnungen" },
  { field_key: "diameter_tolerance", display_name: "Durchmessertoleranz", field_type: "text", role: "computed", category: "Berechnungen" },
  { field_key: "inner_wall_tolerance", display_name: "Innenwandtoleranz", field_type: "text", role: "computed", category: "Berechnungen" },
  { field_key: "lab_tests", display_name: "Labor-Messungen", field_type: "text", role: "computed", category: "Berechnungen" },
];

export const M3_CONFIRM_FIELDS: FieldSpec[] = [
  { field_key: "scope_confirmed", display_name: "Prüfumfang kontrolliert und bestätigt", field_type: "boolean", role: "yellow", category: "Bestätigungen" },
  { field_key: "responsible", display_name: "Verantwortlich / bearbeitet", field_type: "text", role: "yellow", category: "Bestätigungen" },
];

export const M3_ROW_FIELDS: FieldSpec[] = [
  { field_key: "volume_m3", display_name: "m³", field_type: "decimal", unit: "m³", role: "row", category: "m³-Tabelle" },
  { field_key: "element_count", display_name: "Elemente", field_type: "number", unit: "Stk", role: "computed", category: "m³-Tabelle" },
  { field_key: "row_labor_kat", display_name: "Labor-Kats", field_type: "number", role: "computed", category: "m³-Tabelle" },
  { field_key: "row_responsible", display_name: "verantwortlich / bearbeitet", field_type: "text", role: "row", category: "m³-Tabelle" },
];

export const M3_ROWS_KEY = "m3_rows";

const fieldPayload = (formId: string, spec: FieldSpec, sort: number, parentId: string | null = null) => ({
  form_id: formId,
  field_key: spec.field_key,
  display_name: spec.display_name,
  field_type: spec.field_type,
  unit: spec.unit ?? null,
  category: spec.category,
  description: spec.description ?? null,
  readonly: spec.role === "grey" || spec.role === "computed",
  select_options: spec.select_options ?? [],
  sort_order: sort,
  parent_field_id: parentId,
  metadata: {
    m3_role: spec.role,
    ...(spec.release_field ? { m3_release_field: spec.release_field } : {}),
  },
});

/**
 * Vorhandene Vorlage suchen (Name ist die fachliche Identität).
 *
 * Es wird über alle Bereiche gesucht (global und Vorlagen) und der Name
 * unempfindlich gegen Schreibweise, Leerzeichen sowie „m3“/„m³“ verglichen.
 * Damit wird auch eine im ROX-Desktop angelegte Vorlage gefunden und
 * weiterverwendet, statt eine zweite zu erzeugen.
 */
const normalizeName = (v: string) =>
  v.trim().toLowerCase().replace(/³/g, "3").replace(/\s+/g, " ");

export async function findM3Template(): Promise<string | null> {
  const forms = await api.formDefinitions.list();
  const target = normalizeName(M3_FORM_NAME);
  const matches = forms.filter((f) => normalizeName(f.name) === target);
  if (!matches.length) return null;
  return (matches.find((f) => f.scope === "global") ?? matches[0]).id;
}


export interface M3TemplateSeedResult {
  formId: string;
  existingKeys: string[];
  createdKeys: string[];
}

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; code?: unknown };
    return [value.message, value.details, value.code]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" · ") || "Unbekannter Backend-Fehler";
  }
  return String(error || "Unbekannter Fehler");
};

async function createM3Field(
  formId: string,
  key: string,
  payload: Parameters<typeof api.formFields.create>[0]
): Promise<FormField> {
  try {
    return await api.formFields.create(payload);
  } catch (error) {
    const detail = errorText(error);
    console.error(`[m³-Liste] Feld „${key}“ konnte in Vorlage ${formId} nicht ergänzt werden: ${detail}`, error);
    throw new Error(`m³-Vorlage: Feld „${key}“ konnte nicht ergänzt werden: ${detail}`);
  }
}

/**
 * Ergänzt ausschließlich fehlende Teile der definierten m³-Struktur.
 * Der Abgleich erfolgt pro technischem Schlüssel und ist damit nach einem
 * abgebrochenen Teil-Seed beim nächsten Aufruf fortsetzbar.
 */
export async function seedMissingM3Fields(formId: string, initialFields?: FormField[]): Promise<M3TemplateSeedResult> {
  const fields = initialFields ?? await api.formFields.listForForm(formId);
  const byKey = new Map(fields.map((field) => [field.field_key, field]));
  const existingKeys = Array.from(byKey.keys());
  const createdKeys: string[] = [];
  let sort = Math.max(-1, ...fields.filter((field) => field.parent_field_id == null).map((field) => field.sort_order)) + 1;

  for (const spec of [...M3_HEADER_FIELDS, ...M3_CONTROL_FIELDS, ...M3_CALC_FIELDS]) {
    if (byKey.has(spec.field_key)) continue;
    const created = await createM3Field(formId, spec.field_key, fieldPayload(formId, spec, sort++));
    byKey.set(spec.field_key, created);
    createdKeys.push(spec.field_key);
  }

  let repeater = byKey.get(M3_ROWS_KEY);
  if (repeater && repeater.field_type !== "repeater") {
    throw new Error(
      `m³-Vorlage: Das vorhandene Feld „${M3_ROWS_KEY}“ ist kein Repeater. Es wurde zum Schutz der Benutzerkonfiguration nicht verändert.`
    );
  }
  if (!repeater) {
    repeater = await createM3Field(formId, M3_ROWS_KEY, {
      form_id: formId,
      field_key: M3_ROWS_KEY,
      display_name: "m³-Tabelle",
      field_type: "repeater",
      category: "m³-Tabelle",
      sort_order: sort++,
      metadata: {
        m3_role: "rows",
        repeater: {
          item_label: "m³-Zeile",
          add_label: "m³-Zeile hinzufügen",
          table_view: true,
          min_entries: 1,
        },
      },
    });
    byKey.set(M3_ROWS_KEY, repeater);
    createdKeys.push(M3_ROWS_KEY);
  }

  let childSort = Math.max(-1, ...fields.filter((field) => field.parent_field_id === repeater.id).map((field) => field.sort_order)) + 1;
  for (const spec of M3_ROW_FIELDS) {
    const existingRowField = byKey.get(spec.field_key);
    if (existingRowField) {
      if (existingRowField.parent_field_id !== repeater.id) {
        throw new Error(
          `m³-Vorlage: Das vorhandene Feld „${spec.field_key}“ gehört nicht zum Repeater „${M3_ROWS_KEY}“. Es wurde zum Schutz der Benutzerkonfiguration nicht verschoben.`
        );
      }
      continue;
    }
    const created = await createM3Field(formId, spec.field_key, fieldPayload(formId, spec, childSort++, repeater.id));
    byKey.set(spec.field_key, created);
    createdKeys.push(spec.field_key);
  }

  for (const spec of M3_CONFIRM_FIELDS) {
    if (byKey.has(spec.field_key)) continue;
    const created = await createM3Field(formId, spec.field_key, fieldPayload(formId, spec, sort++));
    byKey.set(spec.field_key, created);
    createdKeys.push(spec.field_key);
  }

  console.info(
    `[m³-Liste] Vorlage ${formId}: ${existingKeys.length} Schlüssel vorhanden, ${createdKeys.length} ergänzt.`,
    { existingKeys, createdKeys }
  );
  return { formId, existingKeys, createdKeys };
}

/**
 * Vorlage sicherstellen: Die vorhandene Vorlage wird weiterverwendet (gleiche
 * ID) und ausschließlich um fehlende m³-Schlüssel ergänzt. Diese Laufzeitlogik
 * erzeugt bewusst keine zweite Vorlage.
 */
export async function ensureM3Template(): Promise<string> {
  const existing = await findM3Template();
  if (existing) {
    const fields = await api.formFields.listForForm(existing);
    await seedMissingM3Fields(existing, fields);
    return existing;
  }
  throw new Error(`Die bestehende Formularvorlage „${M3_FORM_NAME}“ wurde nicht gefunden. Es wurde keine neue Vorlage erzeugt.`);
}

