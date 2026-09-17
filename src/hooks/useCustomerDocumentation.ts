/**
 * Lädt alle bereits vorhandenen Daten eines Auftrags, aus denen die
 * Kundendokumentation zusammengestellt wird. Es wird ausschließlich gelesen.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RawMeasurementRow } from "@/lib/orderResultsAggregation";
import type { DocumentRef, GeometryEntry, ReleaseRef } from "@/lib/customerDocumentation/chapters";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CustomerDocumentationSources {
  order: any;
  resultRows: RawMeasurementRow[];
  geometry: GeometryEntry[];
  releases: ReleaseRef[];
  m3Values: Record<string, unknown> | null;
  documents: DocumentRef[];
}

async function loadSources(orderId: string): Promise<CustomerDocumentationSources> {
  const [order, resultRows, releases, m3Requests] = await Promise.all([
    api.orders.get(orderId) as Promise<any>,
    api.orderSamples.resultsOverview(orderId) as Promise<RawMeasurementRow[]>,
    api.productionDocuments.releasesForOrder(orderId) as Promise<ReleaseRef[]>,
    api.productionDocuments.list({ orderId, kind: "m3_list" }),
  ]);

  // Geometriedaten der beteiligten Proben – bestehende Datenhaltung.
  const sampleIds = Array.from(
    new Set(
      [
        ...(resultRows ?? []).map((r) => r.sample_id),
        ...(((order?.order_samples ?? []) as any[]).map((s) => s.sample_id) ?? []),
        order?.sample_id,
      ].filter(Boolean) as string[]
    )
  );
  const sampleNumbers = new Map<string, string>();
  for (const r of resultRows ?? []) {
    if (r.sample_id && r.samples?.sample_number) sampleNumbers.set(r.sample_id, r.samples.sample_number);
  }
  for (const s of (order?.order_samples ?? []) as any[]) {
    if (s.sample_id && s.samples?.sample_number) sampleNumbers.set(s.sample_id, s.samples.sample_number);
  }

  const geometrySets = await Promise.all(
    sampleIds.map(async (id) => {
      try {
        const rows = await api.sampleGeometry.listForSample(id);
        return rows.map((g) => ({
          sampleNumber: sampleNumbers.get(id) ?? "–",
          geometryKind: g.geometry_kind,
          data: (g.data ?? {}) as Record<string, unknown>,
        }));
      } catch {
        return [] as GeometryEntry[];
      }
    })
  );

  // Vorhandene Dateien werden nur referenziert, niemals kopiert.
  const documents: DocumentRef[] = [];
  for (const m of ((order?.order_measurements ?? []) as any[])) {
    for (const d of ((m?.documents ?? []) as any[])) {
      if (d?.file_name) {
        documents.push({
          file_name: d.file_name,
          kindKey: "measurement_document",
          reference: m?.measurement_services?.service_name ?? null,
        });
      }
    }
  }

  const m3 = (m3Requests as any[])?.[0] ?? null;

  return {
    order,
    resultRows: resultRows ?? [],
    geometry: geometrySets.flat(),
    releases: releases ?? [],
    m3Values: (m3?.form_values as Record<string, unknown>) ?? null,
    documents,
  };
}

export function useCustomerDocumentationSources(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["customer-documentation-sources", orderId],
    queryFn: () => loadSources(orderId!),
    enabled: !!orderId,
  });
}
