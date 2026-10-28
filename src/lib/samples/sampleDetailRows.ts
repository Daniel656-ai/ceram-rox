/**
 * Read-only, lesbare Zeilen der gespeicherten Probenfelder (gleiche Labels wie
 * die Probenverwaltung). Leere Werte werden als `null` geliefert und nie als 0.
 */
export interface SampleDetailRow { key: string; label: string; value: string | null }
export interface SampleDetailSection { title: string; rows: SampleDetailRow[] }

type T = (key: string, opts?: Record<string, unknown>) => string;

const empty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
const text = (v: unknown): string | null => (empty(v) ? null : String(v).trim());
const date = (v: unknown): string | null => {
  if (empty(v)) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("de-DE");
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function formatLocation(loc: any): string | null {
  if (!loc) return null;
  const s = [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
  return s || null;
}

export function buildSampleDetailSections(s: any, t: T): SampleDetailSection[] {
  const yesNo = (v: unknown) => (v == null ? null : v ? t("hazard_yes") : t("hazard_no"));
  const translated = (prefix: string, v: unknown) => (empty(v) ? null : t(`${prefix}${v}`, { defaultValue: String(v) }));
  const project = s.projects ? [s.projects.project_number, s.projects.name ?? s.projects.project_name].filter(Boolean).join(" – ") : null;
  const v2o5 = empty(s.v2o5_content) || isNaN(Number(s.v2o5_content)) ? null
    : `${Number(s.v2o5_content).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  const raw = text(s.raw_material_code);

  return [
    { title: t("overview"), rows: [
      { key: "sample_number", label: t("sample_number"), value: text(s.sample_number) },
      { key: "sample_name", label: t("name"), value: text(s.sample_name) },
      { key: "status", label: t("status"), value: translated("status_", s.status) },
      { key: "project", label: t("project"), value: project || null },
      { key: "description", label: t("description"), value: text(s.description) },
      { key: "created_at", label: t("created_at"), value: date(s.created_at) },
      { key: "tags", label: t("tags"), value: list(s.tags).length ? list(s.tags).map(String).join(", ") : null },
    ] },
    { title: t("parameters", { defaultValue: "Probenparameter" }), rows: [
      { key: "category", label: t("category"), value: translated("category_", s.category) },
      { key: "v2o5_content", label: t("v2o5_content"), value: v2o5 },
      { key: "operating_hours", label: t("operating_hours"), value: empty(s.operating_hours) ? null : String(s.operating_hours) },
      { key: "is_used_catalyst", label: t("used_catalyst"), value: yesNo(s.is_used_catalyst) },
      { key: "raw_material_code", label: t("raw_material_code"), value: raw ? `${raw}${!s.raw_material_id ? ` (${t("raw_material_external")})` : ""}` : null },
      { key: "lot_number", label: t("lot_number"), value: text(s.lot_number) },
      { key: "bigbag_number", label: t("bigbag_number"), value: text(s.bigbag_number) },
    ] },
    { title: t("location_section"), rows: [
      { key: "location", label: t("location"), value: formatLocation(s.storage_locations) },
      { key: "post_measurement_action", label: t("post_measurement"), value: translated("post_", s.post_measurement_action) },
      { key: "post_measurement_action_text", label: t("post_measurement_text", { defaultValue: "Bemerkung zur Nachbehandlung" }), value: text(s.post_measurement_action_text) },
      { key: "storage_min_duration", label: t("storage_min_duration"), value: text(s.storage_min_duration) },
      { key: "storage_hints", label: t("storage_hints"), value: text(s.storage_hints) },
      { key: "storage_expiry_date", label: t("storage_expiry_date"), value: date(s.storage_expiry_date) },
      { key: "disposal_method", label: t("disposal_method"), value: text(s.disposal_method) },
      { key: "disposal_hints", label: t("disposal_hints"), value: text(s.disposal_hints) },
      { key: "disposal_category", label: t("disposal_category"), value: translated("disposal_", s.disposal_category) },
    ] },
    { title: t("hazard_section"), rows: [
      { key: "is_hazardous", label: t("hazard_section"), value: yesNo(s.is_hazardous) },
      { key: "hazard_categories", label: t("hazard_contains", { defaultValue: "Gefahrenkategorien" }),
        value: list(s.hazard_categories).length ? list(s.hazard_categories).map((c) => t(`hazard_${c}`, { defaultValue: String(c) })).join(", ") : null },
    ] },
  ];
}
