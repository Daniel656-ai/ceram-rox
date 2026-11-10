import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { orderElementResults } from "@/lib/rfaFixedElements";
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
      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`])
      );

      const records: SampleMeasurementRecord[] = (measurements || []).map((m: any) => {
        const order = m.measurement_orders;
        const service = m.measurement_services;
        const sample = m.samples || order?.samples || null;
        const identity = orderIdentity(order ?? {});

        return {
          measurementId: m.id,
          measurementNumber: m.measurement_number,
          orderId: order?.id || "",
          orderNumber: order?.order_number || "",
          orderDisplayNumber: identity?.number || order?.order_number || "",
          orderType: order?.order_type || "",
          projectNumber: order?.projects?.project_number || "",
          projectName: order?.projects?.project_name || "",
          // Probe ausschließlich aus dem konkreten Messdatensatz; nur ohne
          // eigene Probe greift die Auftragsprobe als Altdaten-Fallback.
          sampleId: m.sample_id || order?.samples?.id || null,
          sampleNumber: sample?.sample_number || "",
          sampleName: sample?.sample_name || "",
          originalSampleNumber: m.original_sample?.sample_number || null,
          serviceId: m.service_id || null,
          serviceName: service?.service_name || "",
          serviceCategory: service?.category || "",
          assignedToId: m.assigned_to,
          assignedToName: m.assigned_to ? profileMap.get(m.assigned_to) || "Unbekannt" : "",
          createdById: order?.created_by || "",
          createdByName: order?.created_by ? profileMap.get(order.created_by) || "Unbekannt" : "",
          status: m.status,
          completedAt: m.updated_at,
          createdAt: m.created_at,
          remarks: order?.notes || "",
          // ALLE Werte – die Kennzeichnung erfolgt über is_official am Wert.
          results: orderElementResults(m.measurement_results || []),
          orderSharedFormData: order?.shared_form_data ?? null,
        };
      });

      // Messungen ohne jeden Ergebniswert haben in der Ergebnissicht keinen Inhalt.
      return records.filter((r) => r.results.length > 0);
    },
    enabled: !!user,
  });
}
