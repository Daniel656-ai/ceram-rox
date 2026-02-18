import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSamples() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, projects(project_number, project_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sample: {
      sample_name: string;
      project_id: string;
      description: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from("samples")
        .insert({ ...sample, sample_number: "WILL_BE_OVERWRITTEN" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["samples"] }),
  });
}

export function useDeleteSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("samples").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["samples"] }),
  });
}
