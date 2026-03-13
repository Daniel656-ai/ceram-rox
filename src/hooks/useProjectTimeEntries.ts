import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectTimeEntries(projectId?: string, orderId?: string) {
  return useQuery({
    queryKey: ["project_time_entries", projectId, orderId],
    queryFn: async () => {
      let query = supabase
        .from("project_time_entries")
        .select("*")
        .eq("project_id", projectId!)
        .order("entry_date", { ascending: false });
      if (orderId) {
        query = query.eq("order_id", orderId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectTimeEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (entry: {
      project_id: string;
      person_id: string;
      entry_date: string;
      duration_minutes: number;
      note: string;
    }) => {
      const { data, error } = await supabase
        .from("project_time_entries")
        .insert({ ...entry, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}

export function useUpdateProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: {
      id: string;
      project_id: string;
      person_id?: string;
      entry_date?: string;
      duration_minutes?: number;
      note?: string;
    }) => {
      const { error } = await supabase
        .from("project_time_entries")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}

export function useDeleteProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_time_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}
