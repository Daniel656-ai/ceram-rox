import { dbClient } from "./client";
import { unwrap } from "./_helpers";

const db = dbClient as any;

export type ContainerMovementType =
  | "eingang"
  | "umlagerung"
  | "verbrauch"
  | "korrektur_plus"
  | "korrektur_minus"
  | "inventur"
  | "entsorgung"
  | "reservierung"
  | "freigabe_reservierung";

export const containerMovements = {
  list: (containerId: string) =>
    unwrap<any[]>(
      db
        .from("container_movements")
        .select("*, from_loc:from_location_id(name,hall,room,shelf,position), to_loc:to_location_id(name,hall,room,shelf,position)")
        .eq("container_id", containerId)
        .order("created_at", { ascending: false })
    ),

  history: (containerId: string) =>
    unwrap<any[]>(
      db
        .from("container_location_history")
        .select("*, from_loc:from_location_id(name,hall,room,shelf,position), to_loc:to_location_id(name,hall,room,shelf,position)")
        .eq("container_id", containerId)
        .order("changed_at", { ascending: false })
    ),

  audit: (containerId: string) =>
    unwrap<any[]>(
      db
        .from("container_audit_log")
        .select("*")
        .eq("container_id", containerId)
        .order("changed_at", { ascending: false })
    ),

  record: (input: {
    container_id: string;
    movement_type: ContainerMovementType;
    quantity?: number | null;
    new_quantity?: number | null;
    to_location_id?: string | null;
    to_location_note?: string | null;
    reference?: string | null;
    comment?: string | null;
  }) =>
    unwrap<string>(
      db.rpc("record_container_movement", {
        _container_id: input.container_id,
        _movement_type: input.movement_type,
        _quantity: input.quantity ?? null,
        _new_quantity: input.new_quantity ?? null,
        _to_location_id: input.to_location_id ?? null,
        _to_location_note: input.to_location_note ?? null,
        _reference: input.reference ?? null,
        _comment: input.comment ?? null,
      })
    ),
};
