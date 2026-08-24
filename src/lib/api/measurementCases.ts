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
  created_at: string;
  updated_at: string;
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
  instances?: MeasurementCaseInstance[];
}

const CASES = "measurement_cases" as any;
const INSTANCES = "measurement_case_instances" as any;

export const measurementCases = {
  /** Alle Messfälle inkl. ihrer Messungen (sortiert). */
  list: async (): Promise<MeasurementCase[]> => {
    const rows = (await unwrap(
      dbClient
        .from(CASES)
        .select("*, measurement_case_instances(*)")
        .order("name", { ascending: true })
    )) as any[];
    return (rows ?? []).map((r) => ({
      ...r,
      instances: ((r.measurement_case_instances ?? []) as MeasurementCaseInstance[])
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
  }) =>
    unwrap(
      dbClient.from(INSTANCES).insert(input as any).select().single()
    ) as unknown as Promise<MeasurementCaseInstance>,

  updateInstance: (id: string, updates: Partial<MeasurementCaseInstance>) =>
    run(dbClient.from(INSTANCES).update(updates as any).eq("id", id)),

  removeInstance: (id: string) => run(dbClient.from(INSTANCES).delete().eq("id", id)),
};
