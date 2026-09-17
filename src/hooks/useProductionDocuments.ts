import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { DocKind } from "@/lib/productionDocuments/requirements";
import type { ProductionDocumentRequest } from "@/lib/api/productionDocuments";

export function useProductionDocumentRequests(opts: { orderId?: string; kind?: DocKind } = {}) {
  return useQuery({
    queryKey: ["production-document-requests", opts.orderId ?? "all", opts.kind ?? "all"],
    queryFn: () => api.productionDocuments.list(opts),
  });
}

export function useOrderReleases(orderId: string | undefined) {
  return useQuery({
    queryKey: ["production-releases-for-order", orderId],
    queryFn: () => api.productionDocuments.releasesForOrder(orderId!),
    enabled: !!orderId,
  });
}

/** Alle Fertigungsfreigabe-Revisionen als auswählbare Quellen (lesend). */
export function useReleaseRevisionOptions(enabled = true) {
  return useQuery({
    queryKey: ["production-releases", "revision-options"],
    queryFn: () => api.productionReleases.listRevisionsForSelection(),
    enabled,
  });
}

/** Genau eine Revision – Grundlage der Wertauflösung einer m³-Liste. */
export function useProductionReleaseRevision(releaseId: string | null | undefined) {
  return useQuery({
    queryKey: ["production-release", releaseId],
    queryFn: () => api.productionReleases.get(releaseId!),
    enabled: !!releaseId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["production-document-requests"] });
    qc.invalidateQueries({ queryKey: ["production-releases-for-order"] });
    qc.invalidateQueries({ queryKey: ["production-releases"] });
  };
}

export function useRequestProductionDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: Parameters<typeof api.productionDocuments.request>[0]) =>
      api.productionDocuments.request(args),
    onSuccess: invalidate,
  });
}

export function useUpdateProductionDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Parameters<typeof api.productionDocuments.update>[1]) =>
      api.productionDocuments.update(id, fields),
    onSuccess: invalidate,
  });
}

export function useLinkReleaseToOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ releaseId, orderId }: { releaseId: string; orderId: string | null }) =>
      api.productionDocuments.linkReleaseToOrder(releaseId, orderId),
    onSuccess: invalidate,
  });
}

export type { ProductionDocumentRequest };

/**
 * Stellt beim Öffnen der Kundendokumentation sicher, dass jeder Auftrag mit
 * Fertigungsfreigabe genau eine Kundendoku besitzt und diese auf die aktuell
 * gültige Freigabe-Revision verweist. Es entsteht nie ein zweites Dokument.
 */
export function useEnsureCustomerDocumentation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api.productionDocuments
      .syncCustomerDocumentation(user?.id ?? null)
      .then((res) => {
        if (res.created || res.updated) {
          qc.invalidateQueries({ queryKey: ["production-document-requests"] });
        }
      })
      .catch((e) => console.error("[kundendoku] Abgleich fehlgeschlagen:", e));
  }, [qc, user?.id]);
}
