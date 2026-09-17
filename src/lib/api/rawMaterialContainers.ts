import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const db = dbClient as any;

export type ContainerKind = "fass" | "kanister" | "sack" | "big_bag" | "ibc" | "tank" | "flasche" | "kiste" | "sonstige";
export type ContainerStatus = "verfuegbar" | "reserviert" | "in_verwendung" | "leer" | "gesperrt" | "entsorgt";

export interface RawMaterialContainer {
  id: string;
  raw_material_id: string;
  batch_id: string | null;
  container_code: string;
  container_name: string | null;
  barcode: string | null;
  kind: ContainerKind;
  initial_quantity: number;
  current_quantity: number;
  reserved_quantity: number;
  unit: string;
  status: ContainerStatus;
  location_id: string | null;
  location_note: string | null;
  notes: string | null;
  tare_weight: number | null;
  tare_unit: string | null;
  is_default_container: boolean;
  expiry_date: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
  updated_at: string;
}

export const rawMaterialContainers = {
  /** Aktuelle Gebinde. Archivierte Gebinde sind standardmäßig ausgeblendet. */
  list: (rawMaterialId?: string, opts?: { includeArchived?: boolean }) => {
    let q = db
      .from("raw_material_containers")
      .select("*, storage_locations(*), raw_material_batches(batch_number)")
      .order("created_at", { ascending: false });
    if (rawMaterialId) q = q.eq("raw_material_id", rawMaterialId);
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap<any[]>(q);
  },

  get: (id: string) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .select("*, storage_locations(*), raw_material_batches(batch_number)")
        .eq("id", id)
        .single()
    ),

  getByBarcode: (barcode: string) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .select("*, storage_locations(*), raw_material_batches(batch_number, raw_material_id), raw_materials(material_name, unit)")
        .or(`barcode.eq.${barcode},container_code.eq.${barcode}`)
        .maybeSingle()
    ),

  create: (
    c: {
      raw_material_id: string;
      batch_id?: string | null;
      container_code?: string | null;
      container_name?: string | null;
      barcode?: string | null;
      kind?: ContainerKind;
      initial_quantity?: number;
      current_quantity?: number;
      unit?: string;
      status?: ContainerStatus;
      location_id?: string | null;
      location_note?: string | null;
      notes?: string | null;
      tare_weight?: number | null;
      tare_unit?: string | null;
      is_default_container?: boolean;
      expiry_date?: string | null;
    },
    createdBy: string
  ) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .insert({ ...c, created_by: createdBy })
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: Partial<{
      container_code: string;
      container_name: string | null;
      barcode: string | null;
      kind: ContainerKind;
      initial_quantity: number;
      current_quantity: number;
      reserved_quantity: number;
      unit: string;
      status: ContainerStatus;
      location_id: string | null;
      location_note: string | null;
      notes: string | null;
      tare_weight: number | null;
      tare_unit: string | null;
      is_default_container: boolean;
      expiry_date: string | null;
    }>
  ) => run(db.from("raw_material_containers").update(updates).eq("id", id)),

  /**
   * "Löschen" aus der aktuellen Verwaltung = Archivieren.
   * Historische Buchungen, Einwaagen und Bewegungen bleiben unverändert erhalten
   * und verweisen weiterhin auf das archivierte Gebinde.
   * Zusätzlich werden LOTs archiviert, die danach kein aktives Gebinde mehr haben.
   */
  delete: async (id: string) => {
    const rows = await unwrap<any[]>(
      db
        .from("raw_material_containers")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .is("archived_at", null)
        .select("id, batch_id")
    );
    if (!rows || rows.length === 0) {
      const still = await unwrap<any[]>(
        db.from("raw_material_containers").select("id, archived_at").eq("id", id)
      );
      if (still && still.length && still[0].archived_at) return; // bereits archiviert
      throw new Error(
        "Gebinde konnte nicht archiviert werden – keine Berechtigung oder Gebinde nicht mehr vorhanden."
      );
    }

    // Betroffene LOTs ermitteln (direkter Bezug + LOT-Positionen im Gebinde)
    const batchIds = new Set<string>();
    if (rows[0].batch_id) batchIds.add(rows[0].batch_id);
    try {
      const positions = await unwrap<any[]>(
        db.from("container_batch_positions").select("batch_id").eq("container_id", id)
      );
      for (const p of positions || []) if (p?.batch_id) batchIds.add(p.batch_id);
    } catch {
      /* Positionen optional – Archivierung des Gebindes bleibt gültig */
    }

    for (const batchId of batchIds) {
      try {
        const active = await unwrap<any[]>(
          db
            .from("raw_material_containers")
            .select("id")
            .eq("batch_id", batchId)
            .is("archived_at", null)
            .limit(1)
        );
        if (active && active.length) continue;
        await run(
          db
            .from("raw_material_batches")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", batchId)
            .is("archived_at", null)
        );
      } catch {
        /* LOT-Archivierung darf die Gebinde-Archivierung nicht verhindern */
      }
    }
  },

  /**
   * List the LOT positions inside a container, in FIFO order (oldest entry first).
   * `includeDepleted` also returns lots with 0 quantity (status "aufgebraucht") for the history.
   */
  positions: (containerId: string, includeDepleted = true) =>
    unwrap<any[]>(
      db.rpc("get_container_positions", {
        _container_id: containerId,
        _include_depleted: includeDepleted,
      })
    ),

  /** Add a further LOT (batch) into an existing container. Same raw material only. */
  addBatch: (args: {
    container_id: string;
    batch_id: string;
    quantity: number;
    movement_date?: string;
    comment?: string;
  }) =>
    unwrap<string>(
      db.rpc("add_batch_to_container", {
        _container_id: args.container_id,
        _batch_id: args.batch_id,
        _quantity: args.quantity,
        _movement_date: args.movement_date ?? null,
        _comment: args.comment ?? null,
      })
    ),
};
