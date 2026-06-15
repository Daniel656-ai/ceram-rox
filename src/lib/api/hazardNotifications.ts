import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface HazardRecipient {
  id: string;
  user_id: string;
  role_label: string;
  created_at: string;
  created_by: string | null;
}

export interface HazardLogEntry {
  id: string;
  raw_material_id: string;
  event_type: "hazard_material_created" | "hazard_material_updated";
  triggered_by: string | null;
  triggered_at: string;
  recipient_user_ids: string[];
  material_snapshot: Record<string, any>;
  activity_id: string | null;
  channel: string;
}

export const hazardNotifications = {
  // ----- Recipients -----
  listRecipients: () =>
    unwrap(
      dbClient
        .from("hazard_notification_recipients")
        .select("*")
        .order("created_at", { ascending: true })
    ) as Promise<HazardRecipient[]>,

  addRecipient: (input: { user_id: string; role_label: string; created_by: string }) =>
    unwrap(
      dbClient
        .from("hazard_notification_recipients")
        .insert({
          user_id: input.user_id,
          role_label: input.role_label,
          created_by: input.created_by,
        } as any)
        .select()
        .single()
    ),

  updateRecipient: (id: string, updates: { role_label?: string }) =>
    run(dbClient.from("hazard_notification_recipients").update(updates as any).eq("id", id)),

  removeRecipient: (id: string) =>
    run(dbClient.from("hazard_notification_recipients").delete().eq("id", id)),

  // ----- Log -----
  listLog: (limit = 100) =>
    unwrap(
      dbClient
        .from("hazard_notification_log")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(limit)
    ) as Promise<HazardLogEntry[]>,
};
