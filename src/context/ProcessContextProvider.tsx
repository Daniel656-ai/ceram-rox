import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SystemContextRequest } from "@/lib/api/systemContext";
import {
  flattenSystemContext,
  listSystemVariables,
  renderSystemTokens,
  type SystemContextData,
  type SystemVariable,
} from "@/lib/systemVariables";
import { flattenMasterDataCatalog, masterDataSelectionVariables } from "@/lib/masterData";
import type { MasterDataCategory } from "@/lib/api/globalLibrary";

/**
 * Prozessmanager-Kontext.
 *
 * Stellt Auftrag / Probe / Projekt / Benutzer / Prozess als schreibgeschützte
 * Systemvariablen bereit. Formulare, Berechnungen, Regeln und Berichte lesen
 * ausschließlich hier – es gibt keine zweite Datenhaltung.
 */

interface ProcessContextShape {
  context: SystemContextData;
  /** "auftrag.auftragsnummer" -> Wert */
  variables: Record<string, unknown>;
  list: SystemVariable[];
  /** Ersetzt {{...}} Tokens in einem Text. */
  render: (text: string) => string;
  /** Zentrale Stammdaten (Kategorien inkl. Attributen und Einträgen). */
  masterData: MasterDataCategory[];
  isLoading: boolean;
}

const EMPTY: ProcessContextShape = {
  context: {},
  variables: {},
  list: [],
  render: (t) => t,
  masterData: [],
  isLoading: false,
};

const Ctx = createContext<ProcessContextShape>(EMPTY);

export function ProcessContextProvider({
  children,
  masterDataSelection,
  ...request
}: SystemContextRequest & {
  children: ReactNode;
  /** Aktuell ausgewählte Stammdaten-Einträge: { mundstuecke: "m1" } */
  masterDataSelection?: Record<string, string | null | undefined>;
}) {
  const key = [
    "system-context",
    request.orderId ?? null,
    request.orderInstanceId ?? null,
    request.sampleId ?? null,
    request.projectId ?? null,
    request.processTemplateId ?? null,
    request.currentStepName ?? null,
  ];

  const enabled = Boolean(
    request.orderId || request.orderInstanceId || request.sampleId ||
    request.projectId || request.processTemplateId
  );

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.systemContext.load(request),
    enabled,
    staleTime: 60 * 1000,
  });

  // Stammdaten stehen systemweit zur Verfügung – unabhängig vom Auftragskontext.
  const { data: catalog = [] } = useQuery({
    queryKey: ["master-data-catalog"],
    queryFn: () => api.masterData.catalog(),
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo<ProcessContextShape>(() => {
    const context = data ?? {};
    const variables = {
      ...flattenMasterDataCatalog(catalog),
      ...masterDataSelectionVariables(catalog, masterDataSelection ?? {}),
      ...flattenSystemContext(context),
    };
    return {
      context,
      variables,
      list: listSystemVariables(context),
      render: (text: string) => renderSystemTokens(text, variables),
      masterData: catalog,
      isLoading,
    };
  }, [data, isLoading, catalog, JSON.stringify(masterDataSelection ?? {})]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Voller Prozessmanager-Kontext (leer, wenn kein Provider aktiv ist). */
export function useProcessContext(): ProcessContextShape {
  return useContext(Ctx);
}

/** Nur die flache Variablen-Map – bequem für Formeln und Regeln. */
export function useSystemVariables(): Record<string, unknown> {
  return useContext(Ctx).variables;
}

/** Token-Renderer für Labels, Hinweise und Textbausteine. */
export function useSystemTextRenderer(): (text: string) => string {
  return useContext(Ctx).render;
}
