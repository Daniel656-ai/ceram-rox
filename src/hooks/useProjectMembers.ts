import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAnyProjectLead() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-any-project-lead", user?.id],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_members")
        .select("id")
        .eq("user_id", user!.id)
        .in("role", ["owner", "leader"])
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });
}

export function useProjectMembers(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_members")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: { project_id: string; user_id: string; role: string }) => {
      const { data, error } = await api
        .from("project_members")
        .insert(member as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-with-stats"] });
    },
  });
}

export function useUpdateProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, projectId }: { id: string; role: string; projectId: string }) => {
      const { error } = await api
        .from("project_members")
        .update({ role } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.projectId] });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await api
        .from("project_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-with-stats"] });
    },
  });
}
