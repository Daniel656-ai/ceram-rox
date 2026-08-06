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
  isLoading: boolean;
}

const EMPTY: ProcessContextShape = {
  context: {},
  variables: {},
  list: [],
  render: (t) => t,
  isLoading: false,
};

const Ctx = createContext<ProcessContextShape>(EMPTY);

export function ProcessContextProvider({
  children,
  ...request
}: SystemContextRequest & { children: ReactNode }) {
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

  const value = useMemo<ProcessContextShape>(() => {
    const context = data ?? {};
    const variables = flattenSystemContext(context);
    return {
      context,
      variables,
      list: listSystemVariables(context),
      render: (text: string) => renderSystemTokens(text, variables),
      isLoading,
    };
  }, [data, isLoading]);

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
