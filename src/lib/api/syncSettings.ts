import { dbClient } from "./client";
import { unwrap } from "./_helpers";

export interface SyncSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  updated_at: string;
  updated_by: string;
}

export const syncSettings = {
  list: () => unwrap(dbClient.from("sync_settings").select("*")) as Promise<SyncSetting[]>,
  get: (key: string) =>
    unwrap(dbClient.from("sync_settings").select("*").eq("setting_key", key).maybeSingle()) as Promise<SyncSetting | null>,
  async upsert(key: string, value: Record<string, any>, userId: string) {
    const existing = await unwrap(
      dbClient.from("sync_settings").select("id").eq("setting_key", key).maybeSingle()
    );
    if (existing) {
      return unwrap(
        dbClient
          .from("sync_settings")
          .update({ setting_value: value, updated_by: userId, updated_at: new Date().toISOString() })
          .eq("id", (existing as any).id)
          .select()
          .single()
      );
    }
    return unwrap(
      dbClient
        .from("sync_settings")
        .insert({ setting_key: key, setting_value: value, updated_by: userId })
        .select()
        .single()
    );
  },
};
