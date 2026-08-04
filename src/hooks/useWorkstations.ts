import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
    queryFn: () => api.workstations.list() as Promise<Workstation[]>,
  });
}

export function useCreateWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ws: { name: string; description?: string; status?: string; responsible_user_id?: string | null }) =>
      api.workstations.create(ws),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

export function useUpdateWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; description?: string; status?: string; responsible_user_id?: string | null }) =>
      api.workstations.update(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

export function useDeleteWorkstation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workstations.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstations"] }),
  });
}

// ── Workstation Tasks ──────────────────────────────────
export function useWorkstationTasks(workstationId?: string) {
  return useQuery({
    queryKey: ["workstation_tasks", workstationId],
    enabled: !!workstationId,
    queryFn: () => api.workstationTasks.list(workstationId!) as Promise<WorkstationTask[]>,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: { workstation_id: string; title: string; description?: string; assigned_to?: string | null; due_date?: string | null; hourly_rate?: number; status?: "open" | "in_progress" | "completed" }) =>
      api.workstationTasks.create(task),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, workstation_id: _wid, ...updates }: { id: string; workstation_id: string; title?: string; description?: string; assigned_to?: string | null; due_date?: string | null; hourly_rate?: number; status?: "open" | "in_progress" | "completed" }) =>
      api.workstationTasks.update(id, updates),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; workstation_id: string }) =>
      api.workstationTasks.delete(id),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["workstation_tasks", vars.workstation_id] }),
  });
}

