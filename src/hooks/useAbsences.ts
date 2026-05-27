import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type { UserAbsence } from "@/lib/api/absences";
import type { UserAbsence } from "@/lib/api/absences";

export function useAbsences(userId?: string) {
  return useQuery({
    queryKey: ["user_absences", userId],
    queryFn: () => api.absences.list(userId),
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: {
      user_id: string;
      absence_type: UserAbsence["absence_type"];
      start_at: string;
      end_at: string;
      comment?: string;
    }) => api.absences.create(a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useUpdateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserAbsence> & { id: string }) => api.absences.update(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.absences.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_absences"] }),
  });
}

export function useCheckAbsenceConflict() {
  return useMutation({
    mutationFn: ({ userId, start, end }: { userId: string; start: string; end: string }) =>
      api.absences.checkConflict(userId, start, end) as Promise<
        Array<{ id: string; absence_type: string; start_at: string; end_at: string }>
      >,
  });
}
