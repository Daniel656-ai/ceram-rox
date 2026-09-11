import { dbClient } from "./client";
import { unwrap } from "./_helpers";

/**
 * Geometriedatensätze je Probe und Geometrieart.
 *
 * Ein Datensatz wird von allen Dienstleistungen derselben Probe und
 * Geometrieart gemeinsam genutzt (z. B. BENCH NOx + BENCH SOx → eine
 * Plattengeometrie). Unterschiedliche Geometriearten derselben Probe bleiben
 * strikt getrennt (Wabenkörper ≠ Platte).
 */
export interface SampleGeometryDataset {
  id: string;
  sample_id: string;
  geometry_kind: string;
  data: Record<string, unknown>;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const TBL = "sample_geometry_datasets" as const;

export const sampleGeometry = {
  /** Alle Geometriedatensätze einer Probe. */
  listForSample: (sampleId: string) =>
    unwrap(
      dbClient.from(TBL).select("*").eq("sample_id", sampleId),
    ) as unknown as Promise<SampleGeometryDataset[]>,

  /** Vorhandenen Datensatz laden – legt nichts an. */
  async get(sampleId: string, geometryKind: string): Promise<SampleGeometryDataset | null> {
    const rows = (await unwrap(
      dbClient.from(TBL).select("*").eq("sample_id", sampleId).eq("geometry_kind", geometryKind).limit(1),
    )) as unknown as SampleGeometryDataset[];
    return rows?.[0] ?? null;
  },

  /**
   * Speichert die Geometriedaten. Existiert bereits ein Datensatz für
   * Probe + Geometrieart, wird genau dieser aktualisiert – dadurch kann
   * niemals eine zweite Geometrie derselben Art entstehen.
   */
  async save(
    sampleId: string,
    geometryKind: string,
    data: Record<string, unknown>,
    updatedBy?: string | null,
  ): Promise<SampleGeometryDataset> {
    const rows = (await unwrap(
      dbClient
        .from(TBL)
        .upsert(
          { sample_id: sampleId, geometry_kind: geometryKind, data: data as never, updated_by: updatedBy ?? null },
          { onConflict: "sample_id,geometry_kind" },
        )
        .select("*"),
    )) as unknown as SampleGeometryDataset[];
    return rows[0];
  },
};
