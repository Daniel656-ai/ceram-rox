import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { MeasurementChannel, MeasurementDataset } from "@/lib/curves/dataset";
import { ORDER_UPLOADS_BUCKET } from "./serviceFieldTemplates";

/** Messpunkte werden blockweise gespeichert, damit auch lange Messreihen performant bleiben. */
const CHUNK_SIZE = 2000;

/**
 * Signal-/Achsenzuordnung des Messtechnikers.
 *
 * Sie dokumentiert, wie die Rohdatensignale ursprünglich interpretiert werden
 * sollten – sie ist ausdrücklich **kein** fertiges Diagramm und keine
 * Auswertung. Die Rohdaten bleiben davon unberührt.
 */
export interface CurveSignalMapping {
  x_key?: string | null;
  y_keys?: string[];
  y2_key?: string | null;
  /** Anzeigenamen und Einheiten zum Zeitpunkt der Zuordnung (Nachvollziehbarkeit). */
  labels?: Record<string, string>;
  units?: Record<string, string | null>;
  assigned_by?: string | null;
  assigned_at?: string | null;
}

export interface MeasurementRawDataset {
  id: string;
  order_measurement_id: string;
  sample_id: string | null;
  service_id: string | null;
  instance_key: string | null;
  instance_label: string | null;
  case_instance_id: string | null;
  source_file_id: string | null;
  source_file_name: string | null;
  importer_id: string;
  parser_version: string | null;
  measurement_type: string | null;
  instrument: string | null;
  channels: MeasurementChannel[];
  point_count: number;
  metadata: Record<string, unknown>;
  /** Gespeicherte Signalzuordnung (Ausgangspunkt späterer Diagramme). */
  signal_mapping: CurveSignalMapping;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export interface CurveEvaluationRecord {
  id: string;
  dataset_id: string;
  measurement_result_id: string | null;
  /** "point" = Wert an definierter Stelle, "range" = Bereichsauswertung. */
  kind: "point" | "range";
  /** Ausgewertete X-Position (nur bei kind = "point"). */
  x_at: number | null;
  /** Klammert alle Kurvenwerte derselben Auswertung (z. B. 850 °C über 3 Kurven). */
  group_id: string | null;
  comment: string | null;
  include_in_report: boolean;
  x_label: string | null;
  y_label: string | null;
  revision: number;
  updated_by: string | null;
  updated_at: string;
  method: string;
  method_label: string | null;
  x_channel: string;
  x_unit: string | null;
  y_channel: string;
  y_unit: string | null;
  x_from: number;
  x_to: number;
  value: number | null;
  unit: string | null;
  formula: string | null;
  details: { label: string; value: string }[];
  result_label: string | null;
  created_by: string | null;
  created_at: string;
}

/** Eine Kurve innerhalb einer Punktauswertung. */
export interface EvaluationCurveValue {
  y_channel: string;
  y_label: string;
  y_unit: string | null;
  value: number | null;
}


const DATASETS = "measurement_raw_datasets" as any;
const SERIES = "measurement_raw_series" as any;
const EVALUATIONS = "measurement_curve_evaluations" as any;
/** Diagramm-Momentaufnahmen liegen im bestehenden Auftrags-Bucket. */
const CHART_BUCKET = ORDER_UPLOADS_BUCKET;

/**
 * `created_by` der Kurventabellen verweist auf `public.profiles.id`, während
 * die Sitzung `auth.users.id` liefert. Die Übersetzung bleibt deshalb zentral
 * in der Domain-API und kann nicht versehentlich mit einer Auth-ID umgangen
 * werden.
 */
const currentProfileId = async (): Promise<string> => {
  const { data: authData, error: authError } = await dbClient.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Für die Rohdatenspeicherung ist eine Anmeldung erforderlich.");

  const { data: profile, error: profileError } = await dbClient
    .from("profiles")
    .select("id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.id) {
    throw new Error("Für den angemeldeten Benutzer wurde kein gültiges Benutzerprofil gefunden.");
  }
  return profile.id;
};

export const measurementRawData = {
  /** Alle Rohdatensätze einer Messung (ohne Messpunkte). */
  listByMeasurement: (measurementId: string) =>
    unwrap(
      dbClient.from(DATASETS).select("*").eq("order_measurement_id", measurementId)
        .order("created_at", { ascending: false })
    ) as unknown as Promise<MeasurementRawDataset[]>,

  /** Alle Rohdatensätze eines Auftrags – Grundlage der Auswertung durch den Auftragsersteller. */
  listByOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from(DATASETS)
        .select("*, order_measurements!inner(id, measurement_number, order_id, service_id)")
        .eq("order_measurements.order_id", orderId)
        .order("created_at", { ascending: false })
    ) as unknown as Promise<(MeasurementRawDataset & { order_measurements: any })[]>,

  get: async (id: string) =>
    (await unwrap(
      dbClient.from(DATASETS).select("*").eq("id", id).maybeSingle()
    )) as unknown as MeasurementRawDataset | null,

  /**
   * Lädt die Messpunkte eines Datensatzes und setzt sie wieder zum Dataset
   * zusammen. Fehlen die Messpunkte, obwohl der Kopf welche ausweist, wird ein
   * Fehler geworfen – ein unvollständiger Datensatz darf nicht als gültig gelten.
   */
  loadDataset: async (datasetId: string): Promise<MeasurementDataset | null> => {
    const head = (await unwrap(
      dbClient.from(DATASETS).select("*").eq("id", datasetId).maybeSingle()
    )) as unknown as MeasurementRawDataset | null;
    if (!head) return null;
    const chunks = (await unwrap(
      dbClient.from(SERIES).select("rows,chunk_index").eq("dataset_id", datasetId)
        .order("chunk_index", { ascending: true })
    )) as unknown as { rows: number[][]; chunk_index: number }[];
    const rows = chunks.flatMap((c) => c.rows ?? []);
    if (head.point_count > 0 && rows.length === 0) {
      throw new Error("Die Rohdaten konnten nicht geladen werden (keine Messpunkte gespeichert).");
    }
    return { channels: head.channels ?? [], rows };
  },

  /** Speichert einen importierten Datensatz samt Messpunkten. */
  save: async (input: {
    order_measurement_id: string;
    sample_id?: string | null;
    service_id?: string | null;
    instance_key?: string | null;
    instance_label?: string | null;
    case_instance_id?: string | null;
    source_file_id?: string | null;
    source_file_name?: string | null;
    importer_id: string;
    parser_version?: string | null;
    measurement_type?: string | null;
    instrument?: string | null;
    metadata?: Record<string, unknown>;
    signal_mapping?: CurveSignalMapping;
    created_by?: string | null;
    dataset: MeasurementDataset;
  }): Promise<MeasurementRawDataset> => {
    const { dataset, ...head } = input;
    if (!dataset || dataset.rows.length === 0) {
      throw new Error("Die Rohdaten enthalten keine Messpunkte und können nicht gespeichert werden.");
    }
    const profileId = await currentProfileId();
    const signalMapping = {
      ...(head.signal_mapping ?? {}),
      assigned_by: profileId,
    };
    const created = (await unwrap(
      dbClient
        .from(DATASETS)
        .insert({
          ...head,
          created_by: profileId,
          channels: dataset.channels as any,
          point_count: dataset.rows.length,
          metadata: head.metadata ?? {},
          signal_mapping: signalMapping as any,
        } as any)
        .select()
        .single()
    )) as unknown as MeasurementRawDataset;

    const chunks: { dataset_id: string; chunk_index: number; rows: number[][] }[] = [];
    for (let i = 0; i * CHUNK_SIZE < dataset.rows.length; i++) {
      chunks.push({
        dataset_id: created.id,
        chunk_index: i,
        rows: dataset.rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      });
    }
    try {
      await run(dbClient.from(SERIES).insert(chunks as any));
    } catch (e) {
      // Keine leere/ungültige Rohdatenreferenz zurücklassen.
      await run(dbClient.from(DATASETS).delete().eq("id", created.id)).catch(() => undefined);
      throw e;
    }
    return created;
  },

  /** Speichert die Signal-/Achsenzuordnung erneut (Rohdaten bleiben unverändert). */
  updateSignalMapping: async (id: string, mapping: CurveSignalMapping) => {
    const profileId = await currentProfileId();
    await run(
      dbClient.from(DATASETS)
        .update({ signal_mapping: { ...mapping, assigned_by: profileId } as any } as any)
        .eq("id", id)
    );
  },



  remove: (id: string) => run(dbClient.from(DATASETS).delete().eq("id", id)),

  /** Dokumentierte Kurvenauswertungen eines Datensatzes (älteste zuerst innerhalb einer Gruppe). */
  listEvaluations: (datasetId: string) =>
    unwrap(
      dbClient.from(EVALUATIONS).select("*").eq("dataset_id", datasetId)
        .order("created_at", { ascending: false })
    ) as unknown as Promise<CurveEvaluationRecord[]>,

  createEvaluation: async (
    input: Partial<CurveEvaluationRecord> & { dataset_id: string; method: string; x_channel: string; y_channel: string }
  ) => {
    const profileId = await currentProfileId();
    return (await unwrap(
      dbClient.from(EVALUATIONS)
        .insert({ ...input, created_by: profileId, updated_by: profileId } as any)
        .select()
        .single()
    )) as unknown as CurveEvaluationRecord;
  },

  /**
   * Speichert einen Auswertungspunkt („Wert an definierter Stelle") für beliebig
   * viele Kurven. Alle Kurvenwerte einer Stelle teilen sich eine Gruppen-Id,
   * damit die Zuordnung Punkt ↔ Kurve dauerhaft erhalten bleibt.
   * Die Rohdaten werden dabei nicht verändert.
   */
  saveEvaluationPoint: async (input: {
    dataset_id: string;
    method?: string;
    method_label?: string;
    x_channel: string;
    x_label: string;
    x_unit: string | null;
    x_at: number;
    comment?: string | null;
    include_in_report?: boolean;
    curves: EvaluationCurveValue[];
  }): Promise<CurveEvaluationRecord[]> => {
    if (input.curves.length === 0) throw new Error("Für die Auswertung wurde keine Kurve ausgewählt.");
    const profileId = await currentProfileId();
    const groupId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rows = input.curves.map((c) => ({
      dataset_id: input.dataset_id,
      kind: "point",
      group_id: groupId,
      method: input.method ?? "value_at_x",
      method_label: input.method_label ?? "Wert an definierter Stelle",
      x_channel: input.x_channel,
      x_label: input.x_label,
      x_unit: input.x_unit,
      x_at: input.x_at,
      x_from: input.x_at,
      x_to: input.x_at,
      y_channel: c.y_channel,
      y_label: c.y_label,
      y_unit: c.y_unit,
      value: c.value,
      unit: c.y_unit,
      formula: "y = y(x) linear interpoliert",
      details: [{ label: "Stelle (X)", value: String(input.x_at) }],
      result_label: `${c.y_label} bei ${input.x_at}${input.x_unit ? ` ${input.x_unit}` : ""}`,
      comment: input.comment ?? null,
      include_in_report: input.include_in_report ?? true,
      created_by: profileId,
      updated_by: profileId,
    }));
    return (await unwrap(
      dbClient.from(EVALUATIONS).insert(rows as any).select()
    )) as unknown as CurveEvaluationRecord[];
  },

  updateEvaluation: async (
    id: string,
    patch: Partial<Pick<CurveEvaluationRecord, "comment" | "include_in_report" | "result_label" | "value">>
  ) => {
    const profileId = await currentProfileId();
    await run(
      dbClient.from(EVALUATIONS).update({ ...patch, updated_by: profileId } as any).eq("id", id)
    );
  },

  /** Aktualisiert alle Kurvenwerte eines Auswertungspunktes gemeinsam. */
  updateEvaluationGroup: async (
    groupId: string,
    patch: Partial<Pick<CurveEvaluationRecord, "comment" | "include_in_report">>
  ) => {
    const profileId = await currentProfileId();
    await run(
      dbClient.from(EVALUATIONS).update({ ...patch, updated_by: profileId } as any).eq("group_id", groupId)
    );
  },

  deleteEvaluation: (id: string) => run(dbClient.from(EVALUATIONS).delete().eq("id", id)),

  deleteEvaluationGroup: (groupId: string) =>
    run(dbClient.from(EVALUATIONS).delete().eq("group_id", groupId)),

  /** Legt das Auswertungsdiagramm eines Datensatzes ab (nur Darstellung, keine Rohdaten). */
  saveChartSnapshot: async (datasetId: string, png: Blob) => {
    const path = `curve-charts/${datasetId}.png`;
    const { error } = await dbClient.storage
      .from(CHART_BUCKET)
      .upload(path, png, { upsert: true, contentType: "image/png" });
    if (error) throw error;
    await run(
      dbClient.from(DATASETS)
        .update({ evaluation_chart_path: path, evaluation_chart_updated_at: new Date().toISOString() } as any)
        .eq("id", datasetId)
    );
    return path;
  },

  chartSnapshotUrl: async (path: string, expiresIn = 600) => {
    const { data } = await dbClient.storage.from(CHART_BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  },


  /** Verknüpft eine Auswertung mit dem daraus erzeugten offiziellen Ergebnis. */
  linkResult: (evaluationId: string, measurementResultId: string) =>
    run(
      dbClient.from(EVALUATIONS)
        .update({ measurement_result_id: measurementResultId } as any)
        .eq("id", evaluationId)
    ),
};
