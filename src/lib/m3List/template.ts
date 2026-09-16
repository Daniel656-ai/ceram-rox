/**
 * Formularvorlage der m³-Liste.
 *
 * Die m³-Liste ist eine ganz normale ROX-Formularvorlage (`form_definitions` +
 * `form_fields`) und daher im bestehenden Formulardesigner anpassbar. Sie wird
 * einmalig angelegt; danach ist die Vorlage frei änderbar und wird hier nicht
 * mehr überschrieben. Dargestellt wird sie überall (Web und ROX Desktop) mit
 * dem gemeinsamen `FormLayoutRenderer`.
 */
import { api } from "@/lib/api";
import type { FormFieldType } from "@/lib/api/formFields";

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

/** Vorhandene Vorlage suchen (Name ist die fachliche Identität). */
export async function findM3Template(): Promise<string | null> {
  const forms = await api.formDefinitions.list({ scope: "global" });
  return forms.find((f) => f.name === M3_FORM_NAME)?.id ?? null;
}

/**
 * Vorlage sicherstellen: vorhandene Vorlage wird unverändert verwendet,
 * andernfalls einmalig angelegt.
 */
export async function ensureM3Template(): Promise<string> {
  const existing = await findM3Template();
  if (existing) return existing;

  const form = await api.formDefinitions.create({
    name: M3_FORM_NAME,
    scope: "global",
    description:
      "m³-Liste (fachliche Vorlage: Excel „m³-Liste“, F5 Rev. 4-11/23). Graue Werte stammen aus der verknüpften Fertigungsfreigabe-Revision, gelbe Felder werden geprüft, berechnete Felder ermittelt ROX.",
    layout: {},
  });

  let sort = 0;
  for (const spec of [...M3_HEADER_FIELDS, ...M3_CONTROL_FIELDS, ...M3_CALC_FIELDS]) {
    await api.formFields.create(fieldPayload(form.id, spec, sort++) as never);
  }

  const repeater = await api.formFields.create({
    form_id: form.id,
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
  } as never);

  let childSort = 0;
  for (const spec of M3_ROW_FIELDS) {
    await api.formFields.create(fieldPayload(form.id, spec, childSort++, repeater.id) as never);
  }

  for (const spec of M3_CONFIRM_FIELDS) {
    await api.formFields.create(fieldPayload(form.id, spec, sort++) as never);
  }

  return form.id;
}
