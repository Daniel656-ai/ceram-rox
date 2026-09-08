import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Messfall / Analyseschema.
 *
 * Ein Messfall beschreibt fachlich, welche einzelnen Messungen für eine Probe
 * erforderlich sind (z. B. „Unbekannte Probe“ → 3 Messungen). ROX erzeugt die
 * Messungsinstanzen daraus automatisch – der Messdienstleister muss nichts
 * konfigurieren.
 */
export interface MeasurementCaseInstance {
  id: string;
  case_id: string;
  position: number;
  /** Bezeichnung der Messung, z. B. „Kalibriert + Pressling“. */
  label: string;
  /** Messmethode, z. B. „RFA“. */
  method: string | null;
  /** Importprofil dieser Messung (eigener Import je Messung). */
  import_profile_id: string | null;
  /** Kontexteigenschaften: `{ "probenvorbereitung": "Pressling", ... }` */
  context: Record<string, string>;
  /**
   * Kurvenkonfiguration dieser Messung (Messfall-Steuerung für Messkurven):
   * erwarteter Messdatentyp, Standardachsen und erlaubte Auswertungen.
   */
  curve_config?: {
    measurement_type?: string | null;
    x_key?: string | null;
    y_keys?: string[];
    y2_key?: string | null;
    allowed_evaluations?: string[];
  } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ergebnis-Element eines Messfalls: Auswahl aus der globalen Elementbibliothek
 * inkl. Reihenfolge und Kennzeichen „offizielles Ergebnis“. Unterkategorien
 * bzw. der Messkontext bestimmen diese Liste NICHT.
 */
export interface MeasurementCaseElement {
  id?: string;
  case_id?: string;
  element_key: string;
  label: string | null;
  position: number;
  is_official: boolean;
}

export interface MeasurementCase {
  id: string;
  case_key: string;
  name: string;
  description: string | null;
  method: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Optionaler Elementbereich (z. B. „B-U“ für die standardlose RFA). */
  element_range?: string | null;
  instances?: MeasurementCaseInstance[];
  elements?: MeasurementCaseElement[];
}

const CASES = "measurement_cases" as any;
const INSTANCES = "measurement_case_instances" as any;
const ELEMENTS = "measurement_case_elements" as any;

export const measurementCases = {
  /** Alle Messfälle inkl. ihrer Messungen (sortiert). */
  list: async (): Promise<MeasurementCase[]> => {
    const rows = (await unwrap(
      dbClient
        .from(CASES)
        .select("*, measurement_case_instances(*), measurement_case_elements(*)")
        .order("name", { ascending: true })
    )) as any[];
    return (rows ?? []).map((r) => ({
      ...r,
      instances: ((r.measurement_case_instances ?? []) as MeasurementCaseInstance[])
        .slice()
        .sort((a, b) => a.position - b.position),
      elements: ((r.measurement_case_elements ?? []) as MeasurementCaseElement[])
        .slice()
        .sort((a, b) => a.position - b.position),
    })) as MeasurementCase[];
  },

  create: (input: { case_key: string; name: string; description?: string | null; method?: string | null }) =>
    unwrap(dbClient.from(CASES).insert(input as any).select().single()) as unknown as Promise<MeasurementCase>,

  update: (id: string, updates: Partial<MeasurementCase>) =>
    run(dbClient.from(CASES).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from(CASES).delete().eq("id", id)),

  addInstance: (input: {
    case_id: string;
    label: string;
    position?: number;
    method?: string | null;
    import_profile_id?: string | null;
    context?: Record<string, string>;
    curve_config?: MeasurementCaseInstance["curve_config"];
  }) =>
    unwrap(
      dbClient.from(INSTANCES).insert(input as any).select().single()
    ) as unknown as Promise<MeasurementCaseInstance>,

  updateInstance: (id: string, updates: Partial<MeasurementCaseInstance>) =>
    run(dbClient.from(INSTANCES).update(updates as any).eq("id", id)),

  removeInstance: (id: string) => run(dbClient.from(INSTANCES).delete().eq("id", id)),

  /** Ergebnis-Elemente eines Messfalls (sortiert). */
  listElements: async (caseId: string): Promise<MeasurementCaseElement[]> =>
    ((await unwrap(
      dbClient.from(ELEMENTS).select("*").eq("case_id", caseId).order("position", { ascending: true })
    )) ?? []) as unknown as MeasurementCaseElement[],

  /**
   * Ersetzt die Ergebnisliste eines Messfalls vollständig (Reihenfolge = Index).
   * Bestehende Elemente bleiben über ihren Schlüssel erhalten.
   */
  replaceElements: async (
    caseId: string,
    elements: Array<{ element_key: string; label?: string | null; is_official?: boolean }>
  ): Promise<void> => {
    const keys = elements.map((e) => e.element_key);
    const existing = (await unwrap(
      dbClient.from(ELEMENTS).select("id, element_key").eq("case_id", caseId)
    )) as unknown as Array<{ id: string; element_key: string }>;
    for (const row of existing ?? []) {
      if (!keys.includes(row.element_key)) await run(dbClient.from(ELEMENTS).delete().eq("id", row.id));
    }
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];
      const found = (existing ?? []).find((x) => x.element_key === e.element_key);
      const payload = {
        label: e.label ?? null,
        position: i,
        is_official: e.is_official !== false,
        updated_at: new Date().toISOString(),
      };
      if (found) await run(dbClient.from(ELEMENTS).update(payload as any).eq("id", found.id));
      else
        await run(
          dbClient.from(ELEMENTS).insert({ case_id: caseId, element_key: e.element_key, ...payload } as any)
        );
    }
  },
};
