import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMeasurementResults(measurementId: string | undefined) {
  return useQuery({
    queryKey: ["measurement-results", measurementId],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_results")
        .select("*")
        .eq("order_measurement_id", measurementId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!measurementId,
  });
}

export function useAddMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (result: {
      order_measurement_id: string;
      result_name: string;
      unit?: string;
      value?: number;
      temperature_range_from?: number;
      temperature_range_to?: number;
      temperature_unit?: string;
      remarks?: string;
      measured_at?: string;
      measured_by?: string;
    }) => {
      const { data, error } = await api
        .from("measurement_results")
        .insert(result)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      result_name?: string;
      unit?: string;
      value?: number;
      temperature_range_from?: number;
      temperature_range_to?: number;
      temperature_unit?: string;
      remarks?: string;
      measured_at?: string;
      measured_by?: string;
    }) => {
      const { error } = await api
        .from("measurement_results")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useDeleteMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api
        .from("measurement_results")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
