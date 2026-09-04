import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";

/**
 * Berechtigungen für Fertigungsfreigaben – ausschließlich über die bestehende
 * Rollen-/Berechtigungslogik (keine parallele Rollenverwaltung).
 */
export function useProductionReleasePermissions() {
  const { role } = useAuth();
  const { hasPermission } = usePermissions();
  const master = role === "master";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (key: string) => master || hasPermission(key as any);
  return {
    canView: p("production_releases.view"),
    canCreate: p("production_releases.create"),
    canEdit: p("production_releases.edit"),
    canImport: p("production_releases.import"),
    canApprove: p("production_releases.approve"),
    canDelete: p("production_releases.delete"),
    canConfigure: master || p("production_releases.edit"),
  };
}

export function useProductionReleases() {
  return useQuery({
    queryKey: ["production-releases"],
    queryFn: () => api.productionReleases.list(),
  });
}

export function useProductionRelease(id: string | undefined) {
  return useQuery({
    queryKey: ["production-release", id],
    queryFn: () => api.productionReleases.get(id!),
    enabled: !!id,
  });
}

export function useReleaseTestParameters(id: string | undefined) {
  return useQuery({
    queryKey: ["production-release-tests", id],
    queryFn: () => api.productionReleases.testParameters(id!),
    enabled: !!id,
  });
}

export function useReleaseSettings() {
  return useQuery({
    queryKey: ["production-release-settings"],
    queryFn: () => api.productionReleases.settings(),
  });
}

export function useSaveRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id?: string;
      values: Record<string, unknown>;
      testParameters?: ProductionReleaseTestParameter[];
    }) => {
      let id = args.id;
      if (id) {
        await api.productionReleases.update(id, args.values);
      } else {
        const row = await api.productionReleases.create(args.values);
        id = row.id;
      }
      if (args.testParameters) {
        await api.productionReleases.replaceTestParameters(id!, args.testParameters);
      }
      return id!;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["production-releases"] });
      qc.invalidateQueries({ queryKey: ["production-release", id] });
      qc.invalidateQueries({ queryKey: ["production-release-tests", id] });
    },
  });
}

export function useDeleteRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.productionReleases.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-releases"] }),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => api.customers.list(),
  });
}
