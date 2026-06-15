import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useHazardRecipients() {
  return useQuery({
    queryKey: ["hazard_recipients"],
    queryFn: () => api.hazardNotifications.listRecipients(),
  });
}

export function useAddHazardRecipient() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ user_id, role_label }: { user_id: string; role_label: string }) =>
      api.hazardNotifications.addRecipient({ user_id, role_label, created_by: user!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hazard_recipients"] }),
  });
}

export function useUpdateHazardRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role_label }: { id: string; role_label: string }) =>
      api.hazardNotifications.updateRecipient(id, { role_label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hazard_recipients"] }),
  });
}

export function useRemoveHazardRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hazardNotifications.removeRecipient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hazard_recipients"] }),
  });
}

export function useHazardLog(limit = 100) {
  return useQuery({
    queryKey: ["hazard_log", limit],
    queryFn: () => api.hazardNotifications.listLog(limit),
  });
}
