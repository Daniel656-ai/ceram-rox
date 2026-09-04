/**
 * Fertigungsfreigabe – zentraler Feldkatalog.
 *
 * EINZIGE Quelle der Wahrheit für die strukturierten Felder einer
 * Fertigungsfreigabe. Wird gleichermaßen verwendet von
 *  - PDF-Import (Erkennung + Prüfmaske)
 *  - manueller Erfassung (Vertrieb)
 *  - Detailansicht / Übersicht
 *
 * Dadurch erzeugen beide Wege (PDF und Formular) exakt dieselbe Struktur.
 */

export type ReleaseFieldType = "text" | "textarea" | "number" | "integer" | "date";

export interface ReleaseFieldDef {
  /** Spaltenname in `production_releases` – stabile technische Referenz */
  key: string;
  labelDe: string;
  labelEn: string;
  type: ReleaseFieldType;
  unit?: string;
  group: ReleaseFieldGroupKey;
}

export type ReleaseFieldGroupKey = "commercial" | "production" | "geometry" | "notes";

export const RELEASE_FIELD_GROUPS: { key: ReleaseFieldGroupKey; labelDe: string; labelEn: string }[] = [
  { key: "commercial", labelDe: "Allgemeine / kaufmännische Daten", labelEn: "Commercial data" },
  { key: "production", labelDe: "Produktionsdaten", labelEn: "Production data" },
  { key: "geometry", labelDe: "Geometrie / technische Spezifikation", labelEn: "Geometry / specification" },
  { key: "notes", labelDe: "Prüfvorgaben, QA/QC & Bemerkungen", labelEn: "Test requirements, QA/QC & remarks" },
];

export const RELEASE_FIELDS: ReleaseFieldDef[] = [
  // --- kaufmännisch ---
  { key: "project_name", labelDe: "Projekt", labelEn: "Project", type: "text", group: "commercial" },
  { key: "customer_name", labelDe: "Kunde", labelEn: "Customer", type: "text", group: "commercial" },
  { key: "end_customer", labelDe: "Endkunde", labelEn: "End customer", type: "text", group: "commercial" },
  { key: "sales_owner", labelDe: "Projektverantwortlicher Vertrieb", labelEn: "Sales owner", type: "text", group: "commercial" },
  { key: "cost_center_code", labelDe: "Kostenträgercode", labelEn: "Cost center code", type: "text", group: "commercial" },
  { key: "recipe", labelDe: "Rezept", labelEn: "Recipe", type: "text", group: "commercial" },
  { key: "product_type", labelDe: "Typ", labelEn: "Type", type: "text", group: "commercial" },
  { key: "article_number", labelDe: "Artikelnummer", labelEn: "Article number", type: "text", group: "commercial" },
  { key: "drawing_approval", labelDe: "Zeichnungsfreigabe", labelEn: "Drawing approval", type: "text", group: "commercial" },
  { key: "delivery_date", labelDe: "Liefertermin", labelEn: "Delivery date", type: "date", group: "commercial" },
  { key: "completion_date", labelDe: "Fertigstellungstermin", labelEn: "Completion date", type: "date", group: "commercial" },
  { key: "delivery_address", labelDe: "Lieferadresse", labelEn: "Delivery address", type: "textarea", group: "commercial" },
  { key: "delivery_terms", labelDe: "Lieferkonditionen", labelEn: "Delivery terms", type: "text", group: "commercial" },
  { key: "packaging", labelDe: "Verpackung", labelEn: "Packaging", type: "text", group: "commercial" },
  { key: "freight_costs", labelDe: "Frachtkosten", labelEn: "Freight costs", type: "number", group: "commercial" },

  // --- Produktion ---
  { key: "piece_count", labelDe: "Stückzahl", labelEn: "Piece count", type: "integer", group: "production" },
  { key: "elements_total", labelDe: "Elemente gesamt", labelEn: "Elements total", type: "integer", group: "production" },
  { key: "normal_modules", labelDe: "Normalmodule", labelEn: "Normal modules", type: "integer", group: "production" },
  { key: "test_modules", labelDe: "Testmodule", labelEn: "Test modules", type: "integer", group: "production" },
  { key: "spare_elements", labelDe: "Ersatzelemente", labelEn: "Spare elements", type: "integer", group: "production" },
  { key: "sample_elements", labelDe: "Probeelemente", labelEn: "Sample elements", type: "integer", group: "production" },
  { key: "module_material", labelDe: "Modulmaterial", labelEn: "Module material", type: "text", group: "production" },
  { key: "accessories", labelDe: "Zubehör", labelEn: "Accessories", type: "text", group: "production" },
  { key: "module_costs", labelDe: "Modulkosten", labelEn: "Module costs", type: "number", group: "production" },
  { key: "accessory_costs", labelDe: "Zubehörkosten", labelEn: "Accessory costs", type: "number", group: "production" },
  { key: "costs_per_module", labelDe: "Kosten pro Modul", labelEn: "Costs per module", type: "number", group: "production" },
  { key: "module_numbering", labelDe: "Modulnummerierung", labelEn: "Module numbering", type: "text", group: "production" },
  { key: "test_elements_per_module", labelDe: "Testelemente pro Modul", labelEn: "Test elements per module", type: "integer", group: "production" },
  { key: "module_flow", labelDe: "Moduldurchströmung", labelEn: "Module flow", type: "text", group: "production" },

  // --- Geometrie ---
  { key: "length_mm", labelDe: "Länge L", labelEn: "Length L", type: "number", unit: "mm", group: "geometry" },
  { key: "length_tolerance", labelDe: "Toleranz Länge", labelEn: "Length tolerance", type: "text", group: "geometry" },
  { key: "cross_section_mm", labelDe: "Querschnitt D", labelEn: "Cross section D", type: "number", unit: "mm", group: "geometry" },
  { key: "cross_section_tolerance", labelDe: "Toleranz Querschnitt", labelEn: "Cross section tolerance", type: "text", group: "geometry" },
  { key: "inner_wall_thickness_mm", labelDe: "Innenwandstärke ti", labelEn: "Inner wall thickness ti", type: "number", unit: "mm", group: "geometry" },
  { key: "inner_wall_tolerance", labelDe: "Toleranz Innenwandstärke", labelEn: "Inner wall tolerance", type: "text", group: "geometry" },
  { key: "target_geometry", labelDe: "Ziel-/Nenngeometrie", labelEn: "Target geometry", type: "text", group: "geometry" },
  { key: "cell_configuration", labelDe: "Zelligkeit / Zellkonfiguration", labelEn: "Cellularity / cell configuration", type: "text", group: "geometry" },
  { key: "v2o5_percent", labelDe: "V₂O₅-Gehalt", labelEn: "V2O5 content", type: "number", unit: "%", group: "geometry" },
  { key: "sorting_criteria", labelDe: "Sortierkriterien", labelEn: "Sorting criteria", type: "textarea", group: "geometry" },

  // --- Bemerkungen ---
  { key: "test_conditions_remarks", labelDe: "Testbedingungen (Bemerkung)", labelEn: "Test conditions (remark)", type: "textarea", group: "notes" },
  { key: "qa_qc_requirements", labelDe: "QA/QC-Vorgaben", labelEn: "QA/QC requirements", type: "textarea", group: "notes" },
  { key: "remarks", labelDe: "Bemerkungen", labelEn: "Remarks", type: "textarea", group: "notes" },
];

export const RELEASE_FIELD_BY_KEY: Record<string, ReleaseFieldDef> = Object.fromEntries(
  RELEASE_FIELDS.map((f) => [f.key, f])
);

/** Prüfabschnitte (Beiblatt Seite 2) – strukturiert, nicht als Textblock. */
export const TEST_SECTIONS: { key: string; labelDe: string; labelEn: string }[] = [
  { key: "nox_bench", labelDe: "NOx im Bench", labelEn: "NOx bench" },
  { key: "sox_bench", labelDe: "SOx im Bench", labelEn: "SOx bench" },
  { key: "nox_micro", labelDe: "NOx im Micro", labelEn: "NOx micro" },
  { key: "sox_micro", labelDe: "SOx im Micro", labelEn: "SOx micro" },
  { key: "other", labelDe: "Weitere Prüfungen", labelEn: "Further tests" },
];

export const TEST_PARAMETERS: { key: string; labelDe: string; labelEn: string; unit?: string }[] = [
  { key: "target_k", labelDe: "Soll K", labelEn: "Target K" },
  { key: "flowrate", labelDe: "Flowrate", labelEn: "Flowrate", unit: "Nm³/h" },
  { key: "no_concentration", labelDe: "NO-Konzentration", labelEn: "NO concentration", unit: "ppm" },
  { key: "alpha", labelDe: "α", labelEn: "alpha" },
  { key: "so2_concentration", labelDe: "SO₂-Konzentration", labelEn: "SO2 concentration", unit: "ppm" },
  { key: "h2o", labelDe: "H₂O", labelEn: "H2O", unit: "%" },
  { key: "o2", labelDe: "O₂", labelEn: "O2", unit: "%" },
  { key: "temperature", labelDe: "Temperatur", labelEn: "Temperature", unit: "°C" },
  { key: "av", labelDe: "AV", labelEn: "AV" },
];

export const TEST_SECTION_LABEL: Record<string, string> = Object.fromEntries(
  TEST_SECTIONS.map((s) => [s.key, s.labelDe])
);
export const TEST_PARAMETER_LABEL: Record<string, string> = Object.fromEntries(
  TEST_PARAMETERS.map((p) => [p.key, p.labelDe])
);

export const RELEASE_STATUSES = ["entwurf", "in_pruefung", "freigegeben", "abgeschlossen"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Statuslogik bewusst datengetrieben – spätere Status lassen sich ergänzen. */
export const RELEASE_STATUS_LABEL: Record<string, string> = {
  entwurf: "Entwurf",
  in_pruefung: "In Prüfung",
  freigegeben: "Freigegeben",
  abgeschlossen: "Abgeschlossen",
};

export const RELEASE_STATUS_COLOR: Record<string, string> = {
  entwurf: "bg-muted text-muted-foreground",
  in_pruefung: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  freigegeben: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  abgeschlossen: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
};

/** Nächste erlaubte Status – zentral, damit die Logik erweiterbar bleibt. */
export const RELEASE_STATUS_FLOW: Record<string, string[]> = {
  entwurf: ["in_pruefung"],
  in_pruefung: ["entwurf", "freigegeben"],
  freigegeben: ["in_pruefung", "abgeschlossen"],
  abgeschlossen: [],
};

/** Herkunft eines Feldwertes (Datenstruktur für spätere Audit-Trails). */
export interface FieldSource {
  source: "pdf" | "manual" | "edited";
  at?: string;
  by?: string | null;
  document?: string | null;
}

export type FieldSourceMap = Record<string, FieldSource>;

/** Wandelt einen erkannten Rohwert in den Typ des Zielfeldes. */
export function coerceFieldValue(key: string, raw: unknown): unknown {
  const def = RELEASE_FIELD_BY_KEY[key];
  if (!def) return raw;
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (def.type === "number" || def.type === "integer") {
    // deutsche und englische Zahlformate, Einheiten und Vorzeichen tolerieren
    const cleaned = s
      .replace(/[^\d,.\-+]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", ".");
    const n = Number.parseFloat(cleaned);
    if (!Number.isFinite(n)) return null;
    return def.type === "integer" ? Math.round(n) : n;
  }
  if (def.type === "date") {
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const de = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
    if (de) {
      const y = de[3].length === 2 ? `20${de[3]}` : de[3];
      return `${y}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
    }
    return null;
  }
  return s;
}
