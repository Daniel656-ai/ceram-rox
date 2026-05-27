import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkPackage {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planned" | "in_progress" | "completed";
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: string[];
}

export function useWorkPackages(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["work-packages", projectId],
    queryFn: async (): Promise<WorkPackage[]> => {
      const { data: wps, error } = await api
        .from("project_work_packages")
        .select("*")
        .eq("project_id", projectId!)
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;

      const ids = (wps || []).map((w: any) => w.id);
      let assigneesByWp = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: assignees, error: aErr } = await api
          .from("project_work_package_assignees")
          .select("work_package_id, user_id")
          .in("work_package_id", ids);
        if (aErr) throw aErr;
        for (const a of assignees || []) {
          const arr = assigneesByWp.get(a.work_package_id) || [];
          arr.push(a.user_id);
          assigneesByWp.set(a.work_package_id, arr);
        }
      }

      return (wps || []).map((w: any) => ({
        ...w,
        assignees: assigneesByWp.get(w.id) || [],
      }));
    },
    enabled: !!user && !!projectId,
  });
}

export function useCreateWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      title: string;
      description?: string;
      start_date?: string | null;
      end_date?: string | null;
      milestone_id?: string | null;
      status?: string;
      assignee_ids?: string[];
      created_by: string;
    }) => {
      const { assignee_ids, ...wp } = params;
      const { data, error } = await api
        .from("project_work_packages")
        .insert(wp as any)
        .select()
        .single();
      if (error) throw error;

      if (assignee_ids && assignee_ids.length > 0) {
        const rows = assignee_ids.map((uid) => ({
          work_package_id: data.id,
          user_id: uid,
        }));
        const { error: aErr } = await api
          .from("project_work_package_assignees")
          .insert(rows);
        if (aErr) throw aErr;
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["work-packages", vars.project_id] });
    },
  });
}

export function useUpdateWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      assignee_ids,
      ...updates
    }: {
      id: string;
      projectId: string;
      title?: string;
      description?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      milestone_id?: string | null;
      status?: string;
      assignee_ids?: string[];
    }) => {
      if (Object.keys(updates).length > 0) {
        const { error } = await api
          .from("project_work_packages")
          .update(updates as any)
          .eq("id", id);
        if (error) throw error;
      }

      if (assignee_ids !== undefined) {
        // Replace assignees: delete old, insert new
        const { error: delErr } = await api
          .from("project_work_package_assignees")
          .delete()
          .eq("work_package_id", id);
        if (delErr) throw delErr;

        if (assignee_ids.length > 0) {
          const rows = assignee_ids.map((uid) => ({
            work_package_id: id,
            user_id: uid,
          }));
          const { error: insErr } = await api
            .from("project_work_package_assignees")
            .insert(rows);
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] });
    },
  });
}

export function useDeleteWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await api
        .from("project_work_packages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] });
    },
  });
}
