import type { ResultRecord } from "@/hooks/useResultsDatabase";
import {
  flattenSchemas,
  resultCell,
  type ResultParamColumn,
  type ServiceResultSchema,
} from "@/lib/resultSchema";
import { expandByMeasurementInstance } from "@/hooks/useResultsDatabase";

/**
 * Anzeigelogik der Ergebnismatrix (Messart-Auswahl, leere Spalten).
 * Reine Darstellung – die gemeinsame Spaltenstruktur (resultSchema) und der
 * Export bleiben unverändert.
 */

/** Auswahlwert für „alle Messarten in einer Tabelle“. */
export const ALL_SERVICES = "__all__";

/** Schlüssel einer Messart – deckungsgleich für Schema und Datensatz. */
export const schemaServiceKey = (s: Pick<ServiceResultSchema, "serviceId" | "serviceName">): string =>
  s.serviceId ?? s.serviceName;

export const recordServiceKey = (r: Pick<ResultRecord, "serviceName"> & { serviceId?: string | null }): string =>
  r.serviceId || r.serviceName || "Dienstleistung";

export interface MatrixServiceOption {
  key: string;
  name: string;
  /** Anzahl offizieller Ergebnisse dieser Messart (ungefilterte Datenbasis). */
  resultCount: number;
}

/** Messarten für die Auswahl: meiste Ergebnisse zuerst, bei Gleichstand alphabetisch. */
export function buildServiceOptions(schemas: ServiceResultSchema[], records: ResultRecord[]): MatrixServiceOption[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = recordServiceKey(r);
    counts.set(key, (counts.get(key) ?? 0) + r.outputResults.length);
  }
  return schemas
    .map((s) => ({ key: schemaServiceKey(s), name: s.serviceName, resultCount: counts.get(schemaServiceKey(s)) ?? 0 }))
    .sort((a, b) => b.resultCount - a.resultCount || a.name.localeCompare(b.name, "de"));
}

/**
 * Gültige Auswahl bestimmen: gemerkte Messart, falls sie noch existiert,
 * sonst die Messart mit den meisten Ergebnissen; „Alle“ nur, wenn gemerkt.
 */
export function resolveMatrixService(stored: string | null | undefined, options: MatrixServiceOption[]): string {
  if (stored === ALL_SERVICES) return ALL_SERVICES;
  if (stored && options.some((o) => o.key === stored)) return stored;
  return options[0]?.key ?? ALL_SERVICES;
}

/** Spalten der gewählten Messart (Reihenfolge laut Ergebnisstruktur) bzw. aller Messarten. */
export function columnsForService(schemas: ServiceResultSchema[], service: string): ResultParamColumn[] {
  if (service === ALL_SERVICES) return flattenSchemas(schemas);
  const schema = schemas.find((s) => schemaServiceKey(s) === service);
  return schema ? schema.columns : [];
}

export function recordsForService(records: ResultRecord[], service: string): ResultRecord[] {
  if (service === ALL_SERVICES) return records;
  return records.filter((r) => recordServiceKey(r) === service);
}

/** Nur Spalten, in denen mindestens eine der angezeigten Zeilen einen Wert hat. */
export function nonEmptyColumns(columns: ResultParamColumn[], records: ResultRecord[]): ResultParamColumn[] {
  const rows = expandByMeasurementInstance(records);
  return columns.filter((c) => rows.some((r) => resultCell(r, c.key).present));
}
