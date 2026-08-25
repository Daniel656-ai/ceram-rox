/**
 * Datei-Importer für NETZSCH-Thermoanalyse (Dilatometer, STA/DSC).
 *
 * Nutzt die bestehende Importer-Registry und das bestehende Importmodell.
 * Neu ist nur, dass hier zusätzlich ein vollständiger Rohdaten-Datensatz
 * (`dataset`) mit allen Messkanälen geliefert wird.
 */
import type { FileImporter, ImportedMeasurement, ImportedResult, ImportedSeries } from "../types";
import {
  decodeNetzschText,
  isNetzsch5,
  parseNetzsch5,
  readMeasurementType,
  NETZSCH5_IMPORTER_ID,
  NETZSCH5_PARSER_VERSION,
  type NetzschMeasurementType,
} from "./netzsch5";

export * from "./netzsch5";

/** Kopfzeilen, die als Probenangaben bzw. Messbedingungen gelten. */
const SAMPLE_KEYS = ["SAMPLE", "IDENTITY", "MATERIAL"];

export const measurementTypeLabel = (t: NetzschMeasurementType) =>
  t === "DIL" ? "Dilatometer" : t === "DSC" ? "STA / DSC" : t === "TG" ? "Thermogravimetrie" : t === "DTA" ? "DTA" : "Unbekannt";

/** Kopfzeilen-Zahl im Dezimalformat der Datei (#DECIMAL). */
function parseHeaderNumber(raw: string, decimal: "." | ","): number | null {
  const m = String(raw ?? "").match(/^[+-]?[\d.,]+/);
  if (!m) return null;
  const cleaned = decimal === "," ? m[0].replace(/\./g, "").replace(",", ".") : m[0].replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): string | undefined {
  const m = String(raw ?? "").match(/^(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return undefined;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2]}-${m[1]}`;
}

export function parseNetzschMeasurement(file: { name: string; buffer: ArrayBuffer }): ImportedMeasurement {
  const text = decodeNetzschText(file.buffer);
  const parsed = parseNetzsch5(text);
  const { dataset, headerMap } = parsed;

  // X-Achse: erster Temperaturkanal, sonst erster Kanal.
  const xChannel = dataset.channels.find((c) => c.unit === "°C") ?? dataset.channels[0] ?? null;

  const series: ImportedSeries[] = xChannel
    ? dataset.channels
        .filter((c) => c.key !== xChannel.key)
        .map((c) => {
          const xi = dataset.channels.findIndex((ch) => ch.key === xChannel.key);
          const yi = dataset.channels.findIndex((ch) => ch.key === c.key);
          return {
            name: c.label,
            xLabel: xChannel.label,
            xUnit: xChannel.unit,
            yLabel: c.label,
            yUnit: c.unit,
            points: dataset.rows
              .filter((r) => Number.isFinite(r[xi]) && Number.isFinite(r[yi]))
              .map((r) => ({ x: r[xi], y: r[yi] })),
          };
        })
    : [];

  // Kopfwerte mit Einheit im Schlüssel ("SAMPLE MASS /mg") sind echte Messgrößen
  // der Probe – sie werden als Ergebniskandidaten angeboten, alles andere bleibt
  // Metadatum und wird von der bestehenden Klassifizierung gefiltert.
  const results: ImportedResult[] = [];
  for (const { key, value } of parsed.header) {
    const m = key.match(/^(.*?)\s*\/(.+)$/);
    if (!m || !value) continue;
    const num = parseHeaderNumber(value, parsed.decimal);
    if (num == null) continue;
    results.push({
      sourceName: m[1].trim(),
      normalizedName: m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      aliases: [key],
      value: num,
      unit: m[2].trim(),
      confidence: "high",
      analysis: "UNKNOWN",
    });
  }

  const sampleName = SAMPLE_KEYS.map((k) => headerMap[k]).find((v) => v && v.trim()) || undefined;
  const massRaw = headerMap["SAMPLE MASS /mg"];

  return {
    source: parsed.instrument ?? "NETZSCH",
    instrumentFamily: measurementTypeLabel(parsed.mtype),
    sourceFileName: file.name,
    parserVersion: NETZSCH5_PARSER_VERSION,
    sampleInformation: {
      sampleName,
      sampleMass: massRaw ? parseHeaderNumber(massRaw, parsed.decimal) ?? undefined : undefined,
      sampleMassUnit: massRaw ? "mg" : undefined,
      analysisDate: parseDate(headerMap["DATE/TIME"]),
    },
    analyses: [{ type: "UNKNOWN", results, series }],
    warnings: parsed.warnings,
    unrecognized: [],
    measurementType: parsed.mtype,
    dataset,
    headerMap,
  };
}

export const netzschImporter: FileImporter = {
  id: NETZSCH5_IMPORTER_ID,
  label: "NETZSCH Thermoanalyse (DIL / STA / DSC)",
  extensions: [".txt", ".csv", ".asc", ".dat"],
  detect: (file) => {
    // Bewusst inhaltsbasiert: die Endung .txt sagt nichts aus.
    const head = decodeNetzschText(file.buffer.slice(0, 4096));
    return isNetzsch5(head) && readMeasurementType(head) !== "UNKNOWN";
  },
  parse: parseNetzschMeasurement,
};
