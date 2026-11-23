import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { mapSampleDatabaseRows } from "@/lib/results/sampleDatabaseMapping";
import type { SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";

/**
 * Datenquelle der probenbezogenen 3-Ebenen-Sicht: lädt ALLE gespeicherten
 * Ergebniswerte (offiziell + vorläufig) je Messung. Die offizielle
 * Ergebnisdatenbank (`useResultsDatabase`) bleibt unverändert und filtert
 * weiterhin auf `is_official === true`.
 */
export function useSampleResultsDatabase() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sample-results-database"],
    queryFn: async (): Promise<SampleMeasurementRecord[]> => {
      const measurements = await api.measurementResults.listSampleDatabase();
      const profiles = await api.measurementResults.listDatabaseProfiles().catch(() => []);
      return mapSampleDatabaseRows(measurements, profiles);
    },
    enabled: !!user,
  });
}
