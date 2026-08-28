import { dbClient } from "./client";

/**
 * Arbeitsansicht für den Probenvorbereiter sowie Teilproben-Erzeugung.
 * Setzt vollständig auf der bestehenden Proben-/Aufgabenverwaltung auf
 * (`samples`, `order_measurements`) – es entsteht keine zweite Probenverwaltung.
 */
export interface PreparationRow {
  measurement_id: string;
  measurement_number: string | null;
  service_id: string | null;
  service_name: string | null;
  origin: "booked" | "package" | "workflow";
  status: string;
  is_ready: boolean;
  sample_id: string | null;
  sample_number: string | null;
  sample_name: string | null;
  parent_sample_id: string | null;
  parent_sample_number: string | null;
  subsample_suffix: string | null;
  requires_subsample: boolean;
  preparation_note: string | null;
}

export const orderPreparation = {
  overview: async (orderId: string): Promise<PreparationRow[]> => {
    const { data, error } = await dbClient.rpc("get_order_preparation_overview" as any, {
      _order_id: orderId,
    } as any);
    if (error) throw error;
    return (data ?? []) as PreparationRow[];
  },

  /** Erzeugt eine Teilprobe (A, B, C …) und hängt optional die Prüfung um. */
  createSubsample: async (input: {
    parentSampleId: string;
    measurementId?: string | null;
    name?: string | null;
    description?: string | null;
  }): Promise<string> => {
    const { data, error } = await dbClient.rpc("create_subsample" as any, {
      _parent_sample_id: input.parentSampleId,
      _measurement_id: input.measurementId ?? null,
      _name: input.name ?? null,
      _description: input.description ?? null,
    } as any);
    if (error) throw error;
    return data as string;
  },

  /** Prüft, ob eine Aufgabe startbereit ist (alle Vorgängerschritte erledigt). */
  isReady: async (measurementId: string): Promise<boolean> => {
    const { data, error } = await dbClient.rpc("measurement_is_ready" as any, {
      _measurement_id: measurementId,
    } as any);
    if (error) throw error;
    return Boolean(data);
  },

  /** Erzeugt für eine gebuchte Aufgabe die im Workflow benötigten Leistungen nach. */
  expandWorkflow: async (measurementId: string): Promise<number> => {
    const { data, error } = await dbClient.rpc("expand_service_workflow" as any, {
      _measurement_id: measurementId,
    } as any);
    if (error) throw error;
    return (data as number) ?? 0;
  },
};
