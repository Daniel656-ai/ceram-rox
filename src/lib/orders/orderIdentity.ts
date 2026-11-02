import { resolveOrderKind } from "./orderKind";

export type ExperimentNumberSource =
  | "pp_experiment_number"
  | "legacy_pp_stammdaten"
  | "template_values";

export interface ExperimentNumberResolution {
  /** Erster gültiger, nicht-leerer Wert nach Priorität; null wenn keine Quelle einen Wert enthält. */
  value: string | null;
  /** Herkunft des angezeigten Werts; null wenn kein Wert vorhanden. */
  source: ExperimentNumberSource | null;
  /** Abweichende gültige Werte niedrigerer Priorität (nur bei Konflikt befüllt). */
  conflicts: { source: ExperimentNumberSource; value: string }[];
}

export type OrderIdentitySource = Parameters<typeof resolveOrderKind>[0] & {
  order_number?: string | null;
  pp_experiment_number?: string | null;
  shared_form_data?: unknown;
};

/** Liest einen verschachtelten String-Wert defensiv; liefert null bei fehlenden/ungültigen Strukturen. */
function readNestedString(root: unknown, path: readonly string[]): string | null {
  let node: unknown = root;
  for (const key of path) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "string" && node.trim() ? node.trim() : null;
}

const SOURCE_PATHS: readonly { source: ExperimentNumberSource; path: readonly string[] }[] = [
  { source: "legacy_pp_stammdaten", path: ["pp", "stammdaten", "versuchsnummer"] },
  { source: "template_values", path: ["template", "values", "versuchsnummer"] },
];

/**
 * Zentrale, rein lesende Auflösung der Pilot-Plant-Versuchsnummer.
 * Priorität: 1) pp_experiment_number, 2) shared_form_data.pp.stammdaten.versuchsnummer,
 * 3) shared_form_data.template.values.versuchsnummer.
 * Keine Ableitung aus anderen Feldern, keine Schreibzugriffe, keine Veränderung der Werte.
 */
export function resolveExperimentNumber(order: OrderIdentitySource): ExperimentNumberResolution {
  const candidates: { source: ExperimentNumberSource; value: string }[] = [];
  const column = typeof order.pp_experiment_number === "string" && order.pp_experiment_number.trim()
    ? order.pp_experiment_number.trim()
    : null;
  if (column) candidates.push({ source: "pp_experiment_number", value: column });
  for (const { source, path } of SOURCE_PATHS) {
    const value = readNestedString(order.shared_form_data, path);
    if (value) candidates.push({ source, value });
  }
  if (candidates.length === 0) return { value: null, source: null, conflicts: [] };
  const winner = candidates[0];
  return {
    value: winner.value,
    source: winner.source,
    // Konflikt nur bei abweichenden Werten; identische Werte in mehreren Quellen sind kein Konflikt.
    conflicts: candidates.filter((c) => c.value !== winner.value),
  };
}

/** Display only: never derive, normalize or persist an experiment number. */
export function orderIdentity(order: OrderIdentitySource) {
  const isPilotPlant = resolveOrderKind(order) === "pilot_plant";
  const resolution = isPilotPlant
    ? resolveExperimentNumber(order)
    : { value: null, source: null, conflicts: [] as ExperimentNumberResolution["conflicts"] };
  const experimentNumber = resolution.value;
  return {
    number: experimentNumber ?? order.order_number ?? "",
    technicalNumber: order.order_number ?? "",
    hasExperimentNumber: experimentNumber !== null,
    missingExperimentNumber: isPilotPlant && experimentNumber === null,
    /** Herkunft der angezeigten Versuchsnummer (Diagnose/Konflikthinweis). */
    experimentNumberSource: resolution.source,
    /** Abweichende Werte niedrigerer Priorität; leer wenn kein Konflikt. */
    experimentNumberConflicts: resolution.conflicts,
  };
}
