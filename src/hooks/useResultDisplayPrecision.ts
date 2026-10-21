import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResultRecord } from "@/hooks/useResultsDatabase";
import { resultFormId, emptyPrecisionDefinitions } from "@/lib/resultDisplayPrecision";

/** Separate query so search, charts, exports and raw result records stay untouched. */
export function useResultDisplayPrecision(records: ResultRecord[]) {
  const serviceIds = Array.from(new Set(records.flatMap((r) => r.serviceId ? [r.serviceId] : []))).sort();
  const formIds = Array.from(new Set(records.flatMap((r) => r.outputResults.flatMap((o) => {
    const id = resultFormId(o.result_name);
    return id ? [id] : [];
  })))).sort();
  const { data } = useQuery({
    queryKey: ["result-display-precision", serviceIds, formIds],
    queryFn: () => api.measurementResults.listDisplayPrecisionDefinitions(serviceIds, formIds),
    enabled: serviceIds.length > 0 || formIds.length > 0,
  });
  return data ?? emptyPrecisionDefinitions;
}