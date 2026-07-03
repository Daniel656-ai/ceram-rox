import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectDetail(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: () => api.projects.get(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useProjectSamples(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-samples", projectId],
    queryFn: () => api.projects.listSamples(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useProjectOrders(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-orders", projectId],
    queryFn: () => api.projects.listOrdersWithDetails(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useProjectSampleHistory(sampleIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-sample-history", sampleIds],
    queryFn: () => api.projectSampleHistory.listForSampleIds(sampleIds),
    enabled: !!user && sampleIds.length > 0,
  });
}

/** Aggregated project stats for the overview list */
export function useProjectsWithStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects-with-stats"],
    queryFn: async () => {
      const [projects, samples, orders, projCon, projKn, projExp, timeEntries] = await Promise.all([
        api.projects.list(),
        api.projects.listSampleIndex(),
        api.projects.listOrderIndex(),
        api.projects.listConsumableCostIndex(),
        api.projects.listKnetungCostIndex(),
        api.projects.listExpenseCostIndex(),
        api.projects.listTimeEntryIndex(),
      ]);

      const statsMap = new Map<string, {
        sampleCount: number;
        measurementCount: number;
        totalHours: number;
        totalCost: number;
        materialCost: number;
        completedOrders: number;
        totalOrders: number;
      }>();

      for (const p of projects || []) {
        statsMap.set(p.id, { sampleCount: 0, measurementCount: 0, totalHours: 0, totalCost: 0, materialCost: 0, completedOrders: 0, totalOrders: 0 });
      }

      for (const s of samples || []) {
        const st = statsMap.get(s.project_id);
        if (st) st.sampleCount++;
      }

      for (const o of (orders || []) as any[]) {
        const st = statsMap.get(o.project_id);
        if (!st) continue;
        st.totalOrders++;
        if (o.status === "completed") st.completedOrders++;
        for (const m of o.order_measurements || []) {
          st.measurementCount++;
          const workLogHours = (m.work_logs || []).reduce((sum: number, wl: any) => sum + (wl.hours || 0), 0);
          const useActual = m.status === "completed" && m.actual_duration_hours != null;
          const hours = useActual ? Number(m.actual_duration_hours) : workLogHours;
          st.totalHours += hours;
          const rate = m.measurement_services?.hourly_rate || 0;
          st.totalCost += hours * rate;
        }
      }

      for (const c of projCon || []) {
        const st = statsMap.get(c.project_id);
        if (st) st.materialCost += Number(c.total_cost || 0);
      }
      for (const k of projKn || []) {
        const st = statsMap.get(k.project_id);
        if (st) st.materialCost += Number(k.total_cost || 0);
      }
      for (const e of projExp || []) {
        const st = statsMap.get(e.project_id);
        if (st) st.materialCost += Number(e.total_price || 0);
      }

      for (const te of timeEntries || []) {
        const st = statsMap.get(te.project_id);
        if (st) st.totalHours += (te.duration_minutes || 0) / 60;
      }

      return (projects || []).map(p => ({
        ...p,
        stats: statsMap.get(p.id) || { sampleCount: 0, measurementCount: 0, totalHours: 0, totalCost: 0, materialCost: 0, completedOrders: 0, totalOrders: 0 },
      }));
    },
    enabled: !!user,
  });
}
