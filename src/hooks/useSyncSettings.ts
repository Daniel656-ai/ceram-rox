import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SyncSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  updated_at: string;
  updated_by: string;
}

export function useSyncSettings() {
  return useQuery({
    queryKey: ["sync_settings"],
    queryFn: async () => {
      const { data, error } = await api
        .from("sync_settings")
        .select("*");
      if (error) throw error;
      return (data || []) as SyncSetting[];
    },
  });
}

export function useSyncSetting(key: string) {
  return useQuery({
    queryKey: ["sync_settings", key],
    queryFn: async () => {
      const { data, error } = await api
        .from("sync_settings")
        .select("*")
        .eq("setting_key", key)
        .maybeSingle();
      if (error) throw error;
      return data as SyncSetting | null;
    },
  });
}

export function useUpsertSyncSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key,
      value,
      userId,
    }: {
      key: string;
      value: Record<string, any>;
      userId: string;
    }) => {
      // Try update first
      const { data: existing } = await api
        .from("sync_settings")
        .select("id")
        .eq("setting_key", key)
        .maybeSingle();

      if (existing) {
        const { data, error } = await api
          .from("sync_settings")
          .update({ setting_value: value, updated_by: userId, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await api
          .from("sync_settings")
          .insert({ setting_key: key, setting_value: value, updated_by: userId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync_settings"] }),
  });
}
