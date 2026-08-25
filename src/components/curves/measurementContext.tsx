import { createContext, useContext, type ReactNode } from "react";

/**
 * Zuordnungskontext der aktuell bearbeiteten Messung.
 *
 * Er wird von der Aufgabenbearbeitung bereitgestellt, damit importierte
 * Rohdaten (Messkurven) eindeutig zu Auftrag, Probe, Dienstleistung und
 * Messung gespeichert und daraus berechnete Werte als offizielle Ergebnisse
 * übernommen werden können. Im Designer/Vorschau fehlt der Kontext – dort
 * bleibt der Import rein lokal.
 */
export interface RuntimeMeasurementContext {
  orderMeasurementId: string;
  sampleId?: string | null;
  serviceId?: string | null;
  userId?: string | null;
}

const Ctx = createContext<RuntimeMeasurementContext | null>(null);

export const MeasurementContextProvider = ({
  value, children,
}: { value: RuntimeMeasurementContext | null; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useRuntimeMeasurementContext = () => useContext(Ctx);
