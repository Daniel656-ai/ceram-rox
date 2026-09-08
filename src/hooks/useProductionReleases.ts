import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import type { ProductionReleaseTestParameter, ProductionReleaseChange } from "@/lib/api/productionReleases";
import { RELEASE_FIELD_BY_KEY, coerceFieldValue } from "@/lib/productionRelease/fields";

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

/** Typabhängige Vorgabensätze (z. B. NOx-Messpunkte) einer Revision. */
export function useReleaseSpecSets(id: string | undefined) {
  return useQuery({
    queryKey: ["production-release-spec-sets", id],
    queryFn: () => api.productionReleases.specSets(id!),
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

// ---- Revisionen & Prüfung ---------------------------------------------------

export function useReleaseRevisions(rootId: string | undefined) {
  return useQuery({
    queryKey: ["production-release-revisions", rootId],
    queryFn: () => api.productionReleases.revisions(rootId!),
    enabled: !!rootId,
  });
}

export function useReleaseChanges(releaseId: string | undefined) {
  return useQuery({
    queryKey: ["production-release-changes", releaseId],
    queryFn: () => api.productionReleases.changes(releaseId!),
    enabled: !!releaseId,
  });
}

/**
 * Gibt eine geprüfte Revision frei: atomar in der Datenbank wird die bisherige
 * Revision zur Historie und diese Revision zum aktuellen gültigen Stand.
 */
export function useReleaseRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: string) => api.productionReleases.releaseRevision(releaseId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["production-releases"] });
      qc.invalidateQueries({ queryKey: ["production-release", res.release_id] });
      if (res.previous_release_id) qc.invalidateQueries({ queryKey: ["production-release", res.previous_release_id] });
      qc.invalidateQueries({ queryKey: ["production-release-revisions", res.root_release_id] });
    },
  });
}

/** „Abschließen“: Prüfung erledigt + Status abgeschlossen + Revision aktuell (atomar im Backend). */
export function useCompleteRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: string) => api.productionReleases.completeRevision(releaseId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["production-releases"] });
      qc.invalidateQueries({ queryKey: ["production-release", res.release_id] });
      const prev = res.promotion?.previous_release_id;
      if (prev) qc.invalidateQueries({ queryKey: ["production-release", prev] });
      qc.invalidateQueries({ queryKey: ["production-release-revisions"] });
    },
  });
}


/**
 * Löst einen unsicheren Prüfpunkt auf: übernehmen, korrigieren oder als
 * unverändert markieren. Sind keine offenen Punkte mehr vorhanden, wechselt
 * die Fertigungsfreigabe automatisch auf „Geprüft".
 */
export function useResolveChange() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      releaseId: string;
      change: ProductionReleaseChange;
      action: "accept" | "correct" | "dismiss";
      value?: string;
    }) => {
      const now = new Date().toISOString();
      const applied = args.action === "dismiss"
        ? null
        : args.action === "correct"
          ? (args.value ?? "")
          : (args.change.new_value ?? "");

      if (applied !== null && args.change.field_key && RELEASE_FIELD_BY_KEY[args.change.field_key]) {
        const coerced = coerceFieldValue(args.change.field_key, applied);
        const release = await api.productionReleases.get(args.releaseId);
        const sources = { ...((release.field_sources as Record<string, unknown>) ?? {}) };
        sources[args.change.field_key] = { source: "edited", at: now, by: user?.id ?? null };
        await api.productionReleases.update(args.releaseId, {
          [args.change.field_key]: coerced === "" ? null : coerced,
          field_sources: sources,
          updated_by: user?.id ?? null,
        });
      }

      await api.productionReleases.updateChange(args.change.id!, {
        status: args.action === "dismiss" ? "dismissed" : args.action === "correct" ? "corrected" : "accepted",
        resolved_value: applied,
        reviewed_by: user?.id ?? null,
        reviewed_at: now,
      });

      const rest = await api.productionReleases.changes(args.releaseId);
      const open = rest.filter((c) => c.status === "pending").length;
      if (!open) {
        await api.productionReleases.update(args.releaseId, {
          import_status: "reviewed",
          reviewed_at: now,
          reviewed_by: user?.id ?? null,
        });
      }
      return open;
    },
    onSuccess: (_open, vars) => {
      qc.invalidateQueries({ queryKey: ["production-release-changes", vars.releaseId] });
      qc.invalidateQueries({ queryKey: ["production-release", vars.releaseId] });
      qc.invalidateQueries({ queryKey: ["production-releases"] });
    },
  });
}
