/**
 * Konstanten der m³-Liste.
 *
 * Es wird ausschließlich die bereits vorhandene ROX-Konstantenmechanik
 * verwendet: globale Felder mit `data_source = "constant"`. Die Werte sind
 * dadurch zentral pflegbar und nicht in einzelnen Formeln hartkodiert.
 */
import { api } from "@/lib/api";
import { parseGlobalConstantValue, GLOBAL_CONSTANT_SOURCE } from "@/lib/globalConstants";
import type { M3Constants } from "./calculations";

export const M3_CONSTANT_OBJECT_KEY = "m3_liste";

export interface M3ConstantDefinition {
  field_key: string;
  display_name: string;
  unit: string | null;
  default_value: string;
  target: keyof M3Constants;
}

export const M3_CONSTANTS: M3ConstantDefinition[] = [
  { field_key: "m3_querschnitt_m", display_name: "Elementquerschnitt (Kantenlänge)", unit: "m", default_value: "0,15", target: "crossSectionM" },
  { field_key: "m3_druckpruefung_mm", display_name: "Länge je Druckprüfung", unit: "mm", default_value: "150", target: "pressureTestMm" },
  { field_key: "m3_rsm_max_mm", display_name: "RSM-Länge (Maximum)", unit: "mm", default_value: "350", target: "rsmMaxMm" },
  { field_key: "m3_laborkat_zuschlag_mm", display_name: "Laborkat-Zuschlag", unit: "mm", default_value: "50", target: "laborKatAddMm" },
  { field_key: "m3_elementanzahl_rundung", display_name: "Rundungsschritt Elementanzahl", unit: null, default_value: "10", target: "elementRounding" },
];

export interface M3ConstantsState {
  constants: M3Constants | null;
  /** Fehlende bzw. nicht auswertbare Konstanten – bewusst ohne Ersatzwert. */
  missing: string[];
}

/** Vergleichsform für Bezeichnungen (Groß-/Kleinschreibung, Leerzeichen, Klammern egal). */
const normalizeName = (v: string): string =>
  v.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

/** Baut die Konstanten aus bereits geladenen globalen Feldern. */
export function readM3Constants(
  fields: Array<{
    field_key: string;
    display_name?: string | null;
    data_type?: string | null;
    default_value?: string | null;
    data_source?: string | null;
  }>
): M3ConstantsState {
  const byKey = new Map(fields.map((f) => [f.field_key, f]));
  // Manuell angelegte Konstanten können einen abweichenden technischen
  // Schlüssel haben – dann greift die Erkennung über die Bezeichnung.
  const byName = new Map(
    fields.filter((f) => f.display_name).map((f) => [normalizeName(String(f.display_name)), f])
  );
  const result: Partial<M3Constants> = {};
  const missing: string[] = [];
  for (const def of M3_CONSTANTS) {
    const field = byKey.get(def.field_key) ?? byName.get(normalizeName(def.display_name));
    const value = field ? parseGlobalConstantValue(field) : undefined;
    if (typeof value === "number" && Number.isFinite(value)) result[def.target] = value;
    else missing.push(def.display_name);
  }
  return {
    constants: missing.length ? null : (result as M3Constants),
    missing,
  };
}

/**
 * Legt die Konstanten einmalig an, falls sie noch nicht existieren.
 * Bestehende Konstanten werden nie überschrieben.
 */
export async function ensureM3Constants(): Promise<void> {
  const objects = await api.globalObjects.list();
  let object = objects.find((o) => o.object_key === M3_CONSTANT_OBJECT_KEY) ?? null;
  if (!object) {
    object = await api.globalObjects.create({
      object_key: M3_CONSTANT_OBJECT_KEY,
      display_name: "m³-Liste",
      description: "Technische Konstanten der m³-Liste (fachliche Vorlage: Excel „m³-Liste“).",
      category: "Fertigung",
    });
  }
  const existing = await api.globalFields.list({ objectId: object.id, includeArchived: true });
  const keys = new Set(existing.map((f) => f.field_key));
  for (const def of M3_CONSTANTS) {
    if (keys.has(def.field_key)) continue;
    await api.globalFields.create({
      object_id: object.id,
      field_key: def.field_key,
      display_name: def.display_name,
      unit: def.unit,
      data_type: "decimal",
      data_source: GLOBAL_CONSTANT_SOURCE,
      default_value: def.default_value,
      category: "m³-Liste",
    });
  }
}
