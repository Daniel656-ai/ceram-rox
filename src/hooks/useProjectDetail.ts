import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectDetail(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

export function useProjectSamples(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-samples", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, storage_locations:location_id(id, hall, room, shelf, position)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

export function useProjectOrders(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-orders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_orders")
        .select(`
          *,
          samples(sample_number, sample_name),
          order_measurements(
            *,
            measurement_services(service_name, category, hourly_rate, standard_duration_hours),
            work_logs(*),
            measurement_results(*)
          )
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}

export function useProjectSampleHistory(sampleIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-sample-history", sampleIds],
    queryFn: async () => {
      if (sampleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sample_history")
        .select("*")
        .in("sample_id", sampleIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && sampleIds.length > 0,
  });
}

/** Aggregated project stats for the overview list */
export function useProjectsWithStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects-with-stats"],
    queryFn: async () => {
      // Fetch projects
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;

      // Fetch sample counts per project
      const { data: samples, error: sErr } = await supabase
        .from("samples")
        .select("id, project_id");
      if (sErr) throw sErr;

      // Fetch orders with measurements & work_logs
      const { data: orders, error: oErr } = await supabase
        .from("measurement_orders")
        .select("id, project_id, status, order_measurements(id, status, processing_time_hours, planned_hours, actual_duration_hours, measurement_services(hourly_rate), work_logs(hours))");
      if (oErr) throw oErr;

      // Fetch material costs
      const { data: projCon, error: pcErr } = await supabase
        .from("project_consumables")
        .select("project_id, total_cost");
      if (pcErr) throw pcErr;

      const { data: projKn, error: pkErr } = await supabase
        .from("project_knetung_materials")
        .select("project_id, total_cost");
      if (pkErr) throw pkErr;

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
          // Use actual_duration_hours (Ist-Dauer) for completed measurements
          const useActual = m.status === "completed" && m.actual_duration_hours != null;
          const hours = useActual ? Number(m.actual_duration_hours) : workLogHours;
          st.totalHours += hours;
          const rate = m.measurement_services?.hourly_rate || 0;
          st.totalCost += hours * rate;
        }
      }

      // Add material costs
      for (const c of projCon || []) {
        const st = statsMap.get(c.project_id);
        if (st) st.materialCost += Number(c.total_cost || 0);
      }
      for (const k of projKn || []) {
        const st = statsMap.get(k.project_id);
        if (st) st.materialCost += Number(k.total_cost || 0);
      }

      return (projects || []).map(p => ({
        ...p,
        stats: statsMap.get(p.id) || { sampleCount: 0, measurementCount: 0, totalHours: 0, totalCost: 0, materialCost: 0, completedOrders: 0, totalOrders: 0 },
      }));
    },
    enabled: !!user,
  });
}
