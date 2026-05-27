import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UserAbsence {
  id: string;
  user_id: string;
  absence_type: "urlaub" | "krankheit" | "weiterbildung" | "sonstiges";
  start_at: string;
  end_at: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export function useAbsences(userId?: string) {
  return useQuery({
    queryKey: ["user_absences", userId],
    queryFn: async () => {
      let q = api.from("user_absences").select("*").order("start_at");
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data as UserAbsence[];
    },
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      user_id: string;
      absence_type: UserAbsence["absence_type"];
      start_at: string;
      end_at: string;
      comment?: string;
    }) => {
      const { data, error } = await api.from("user_absences").insert(a).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useUpdateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<UserAbsence> & { id: string }) => {
      const { data, error } = await api.from("user_absences").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.from("user_absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useCheckAbsenceConflict() {
  return useMutation({
    mutationFn: async ({
      userId,
      start,
      end,
    }: {
      userId: string;
      start: string;
      end: string;
    }) => {
      const { data, error } = await api.rpc("check_user_absence_conflict", {
        _user_id: userId,
        _start: start,
        _end: end,
      });
      if (error) throw error;
      return data as Array<{
        id: string;
        absence_type: string;
        start_at: string;
        end_at: string;
      }>;
    },
  });
}
