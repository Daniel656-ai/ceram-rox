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
  /** Offizielle Ergebnisse dieser Messart unter den AKTUELLEN Filtern. */
  resultCount: number;
  /** Offizielle Ergebnisse dieser Messart insgesamt (ungefilterte Datenbasis). */
  totalCount: number;
}

const countResults = (records: ResultRecord[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = recordServiceKey(r);
    counts.set(key, (counts.get(key) ?? 0) + r.outputResults.length);
  }
  return counts;
};

/**
 * Messarten für die Auswahl. Die Reihenfolge bleibt stabil (meiste Ergebnisse
 * insgesamt zuerst, dann alphabetisch) und springt nicht bei Filteränderungen;
 * die angezeigte Zahl berücksichtigt die aktuellen Filter.
 */
export function buildServiceOptions(
  schemas: ServiceResultSchema[],
  allRecords: ResultRecord[],
  filteredRecords: ResultRecord[] = allRecords,
): MatrixServiceOption[] {
  const total = countResults(allRecords);
  const filtered = countResults(filteredRecords);
  return schemas
    .map((s) => ({
      key: schemaServiceKey(s),
      name: s.serviceName,
      resultCount: filtered.get(schemaServiceKey(s)) ?? 0,
      totalCount: total.get(schemaServiceKey(s)) ?? 0,
    }))
    .sort((a, b) => b.totalCount - a.totalCount || a.name.localeCompare(b.name, "de"));
}

/**
 * Gültige Auswahl bestimmen. Die gemerkte Messart gilt nur, solange sie unter den
 * aktuellen Filtern Ergebnisse hat – sonst folgt die Auswahl dem Filter (erste
 * Messart mit Ergebnissen). Die gemerkte Wahl selbst bleibt unverändert und
 * kommt zurück, sobald der Filter aufgehoben wird. „Alle“ nur, wenn gewählt.
 */
export function resolveMatrixService(stored: string | null | undefined, options: MatrixServiceOption[]): string {
  if (stored === ALL_SERVICES) return ALL_SERVICES;
  const withResults = options.filter((o) => o.resultCount > 0);
  const storedOption = options.find((o) => o.key === stored);
  if (storedOption && (storedOption.resultCount > 0 || withResults.length === 0)) return storedOption.key;
  return withResults[0]?.key ?? options[0]?.key ?? ALL_SERVICES;
}

/* ---- gemerkte Einstellungen (nur Komfort; ohne Speicher gilt die Auswahl nur für die Sitzung) ---- */
const MATRIX_PREF_PREFIX = "ceram.resultsMatrix.";
export const readMatrixPref = (key: string): string | null => {
  try {
    return window.localStorage.getItem(MATRIX_PREF_PREFIX + key);
  } catch {
    return null;
  }
};
export const writeMatrixPref = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(MATRIX_PREF_PREFIX + key, value);
  } catch {
    /* Speicher nicht verfügbar */
  }
};

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

/* ---- Zeile -> Auswahl für die Seitenleiste (Schlüssel wie in groupRecordsByOrder/-BySample) ---- */
export interface MatrixSelection {
  orderKey: string;
  sampleKey: string;
}

export const matrixRowSelection = (
  r: Pick<ResultRecord, "orderId" | "orderNumber" | "sampleId">,
): MatrixSelection => ({
  orderKey: r.orderId || `number:${r.orderNumber}`,
  sampleKey: r.sampleId ?? `order:${r.orderId}`,
});

/** Proben in der Reihenfolge der Matrixzeilen (aufeinanderfolgende Zeilen derselben Probe nur einmal). */
export function matrixNavItems(records: ResultRecord[]): MatrixSelection[] {
  const out: MatrixSelection[] = [];
  for (const r of expandByMeasurementInstance(records)) {
    const sel = matrixRowSelection(r);
    const last = out[out.length - 1];
    if (!last || last.orderKey !== sel.orderKey || last.sampleKey !== sel.sampleKey) out.push(sel);
  }
  return out;
}
