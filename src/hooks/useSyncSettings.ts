import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type { SyncSetting } from "@/lib/api/syncSettings";

export function useSyncSettings() {
  return useQuery({ queryKey: ["sync_settings"], queryFn: () => api.syncSettings.list() });
}

export function useSyncSetting(key: string) {
  return useQuery({ queryKey: ["sync_settings", key], queryFn: () => api.syncSettings.get(key) });
}

export function useUpsertSyncSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, userId }: { key: string; value: Record<string, any>; userId: string }) =>
      api.syncSettings.upsert(key, value, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync_settings"] }),
  });
}
