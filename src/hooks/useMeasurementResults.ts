import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMeasurementResults(measurementId: string | undefined) {
  return useQuery({
    queryKey: ["measurement-results", measurementId],
    queryFn: () => api.measurementResults.list(measurementId!),
    enabled: !!measurementId,
  });
}

export function useAddMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (result: {
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
    }) => api.measurementResults.create(result),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: {
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
    }) => api.measurementResults.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useDeleteMeasurementResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.measurementResults.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
