import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────
export interface Workstation {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkstationTask {
  id: string;
  workstation_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  hourly_rate: number;
  status: "open" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
}

// ── Workstations ───────────────────────────────────────
export function useWorkstations() {
  return useQuery({
    queryKey: ["workstations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workstations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Workstation[];
    },
  });
}

export function useCreateWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ws: { name: string; description?: string; status?: string; responsible_user_id?: string | null }) => {
      const { data, error } = await supabase.from("workstations").insert(ws).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

export function useUpdateWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; status?: string; responsible_user_id?: string | null }) => {
      const { data, error } = await supabase.from("workstations").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

export function useDeleteWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workstations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

// ── Workstation Tasks ──────────────────────────────────
export function useWorkstationTasks(workstationId?: string) {
  return useQuery({
    queryKey: ["workstation_tasks", workstationId],
    enabled: !!workstationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workstation_tasks")
        .select("*")
        .eq("workstation_id", workstationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WorkstationTask[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: { workstation_id: string; title: string; description?: string; assigned_to?: string | null; due_date?: string | null; hourly_rate?: number; status?: "open" | "in_progress" | "completed" }) => {
      const { data, error } = await supabase.from("workstation_tasks").insert([task]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workstation_id: _wid, ...updates }: { id: string; workstation_id: string; title?: string; description?: string; assigned_to?: string | null; due_date?: string | null; hourly_rate?: number; status?: "open" | "in_progress" | "completed" }) => {
      const { data, error } = await supabase.from("workstation_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workstation_id: _wid }: { id: string; workstation_id: string }) => {
      const { error } = await supabase.from("workstation_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}
