/**
 * Parser für NETZSCH5-ASCII-Exporte (Proteus „DATA ALL“).
 *
 * Verifiziert an realen Dateien:
 *  - NETZSCH DIL 402C  (#MTYPE:DIL)
 *  - NETZSCH STA 449F3 (#MTYPE:DSC)
 *
 * Der Parser wertet ausschließlich die selbstbeschreibenden Kopfzeilen aus
 * (#FORMAT, #MTYPE, #DECIMAL, #SEPARATOR) – keine festen Spaltenlisten,
 * keine Dateiendungs-Heuristik.
 */
import {
  channelKey,
  splitChannelHeader,
  type MeasurementChannel,
  type MeasurementDataset,
} from "@/lib/curves/dataset";

export const NETZSCH5_PARSER_VERSION = "1.0.0";
export const NETZSCH5_IMPORTER_ID = "netzsch5";

export type NetzschMeasurementType = "DIL" | "DSC" | "TG" | "DTA" | "UNKNOWN";

export interface Netzsch5File {
  /** Alle Kopfzeilen in Reihenfolge (Schlüssel ohne "#"). */
  header: { key: string; value: string }[];
  headerMap: Record<string, string>;
  mtype: NetzschMeasurementType;
  instrument: string | null;
  decimal: "." | ",";
  separator: string;
  dataset: MeasurementDataset;
  warnings: string[];
}

/** NETZSCH-Exporte sind ANSI (ISO-8859-1/CP1252) – UTF-8 zerstört °C, µm, Umlaute. */
export function decodeNetzschText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Ersetzungszeichen deuten auf ANSI hin.
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

const SEPARATORS: Record<string, string> = {
  SEMICOLON: ";",
  COMMA: ",",
  TAB: "\t",
  SPACE: " ",
};

/** Zuverlässige, rein inhaltsbasierte Erkennung. */
export function isNetzsch5(text: string): boolean {
  return /^#FORMAT:\s*NETZSCH\d/im.test(text);
}

export function readMeasurementType(text: string): NetzschMeasurementType {
  const m = text.match(/^#MTYPE:\s*(\S+)/im);
  const v = (m?.[1] ?? "").toUpperCase();
  return v === "DIL" || v === "DSC" || v === "TG" || v === "DTA" ? v : "UNKNOWN";
}

function toNumber(raw: string, decimal: "." | ","): number {
  let s = String(raw ?? "").trim();
  if (!s) return NaN;
  if (decimal === ",") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Berechnet fehlende Ausdehnungs-Kanäle aus dL/Lo.
 * - T. Alpha (technisch): (dL/Lo)(T) / (T - T_start)
 * - Alpha (physikalisch): d(dL/Lo)/dT (zentrale Differenz)
 * Vorhandene Kanäle aus der Datei werden niemals überschrieben.
 */
function deriveExpansionChannels(ds: MeasurementDataset): void {
  const tempIdx = ds.channels.findIndex((c) => c.unit === "°C");
  const dlIdx = ds.channels.findIndex((c) => c.key === "dl_lo");
  if (tempIdx < 0 || dlIdx < 0 || ds.rows.length < 2) return;

  const hasTech = ds.channels.some((c) => c.key === "t_alpha");
  const hasAlpha = ds.channels.some((c) => c.key === "alpha");
  if (hasTech && hasAlpha) return;

  const t0 = ds.rows[0][tempIdx];
  const dl0 = ds.rows[0][dlIdx];

  const added: MeasurementChannel[] = [];
  if (!hasTech) {
    added.push({
      key: "t_alpha",
      label: "T. Alpha",
      unit: "1/K",
      derived: true,
      derivedFrom: "(dL/Lo − dL/Lo(T₀)) / (T − T₀)",
    });
  }
  if (!hasAlpha) {
    added.push({
      key: "alpha",
      label: "Alpha",
      unit: "1/K",
      derived: true,
      derivedFrom: "d(dL/Lo)/dT (zentrale Differenz)",
    });
  }

  for (let i = 0; i < ds.rows.length; i++) {
    const row = ds.rows[i];
    const t = row[tempIdx];
    const dl = row[dlIdx];
    const extra: number[] = [];
    if (!hasTech) {
      const dt = t - t0;
      extra.push(Math.abs(dt) > 1e-9 ? (dl - dl0) / dt : NaN);
    }
    if (!hasAlpha) {
      const prev = ds.rows[Math.max(0, i - 1)];
      const next = ds.rows[Math.min(ds.rows.length - 1, i + 1)];
      const dT = next[tempIdx] - prev[tempIdx];
      extra.push(Math.abs(dT) > 1e-9 ? (next[dlIdx] - prev[dlIdx]) / dT : NaN);
    }
    ds.rows[i] = [...row, ...extra];
  }
  ds.channels = [...ds.channels, ...added];
}

export function parseNetzsch5(text: string): Netzsch5File {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  const header: { key: string; value: string }[] = [];
  const headerMap: Record<string, string> = {};
  let columnLine: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    const l = line.trimEnd();
    if (!l.trim()) continue;
    if (l.startsWith("##")) {
      if (columnLine === null) columnLine = l.slice(2);
      continue;
    }
    if (l.startsWith("#")) {
      if (columnLine !== null) continue; // Kopfzeilen nach dem Datenblock ignorieren
      const idx = l.indexOf(":");
      const key = (idx >= 0 ? l.slice(1, idx) : l.slice(1)).trim();
      const value = idx >= 0 ? l.slice(idx + 1).trim() : "";
      header.push({ key, value });
      if (!(key in headerMap)) headerMap[key] = value;
      continue;
    }
    if (columnLine !== null) dataLines.push(l);
  }

  const decimal: "." | "," = (headerMap["DECIMAL"] ?? "POINT").toUpperCase() === "COMMA" ? "," : ".";
  const sepName = (headerMap["SEPARATOR"] ?? "SEMICOLON").toUpperCase();
  const separator = SEPARATORS[sepName] ?? ";";
  const mtype = readMeasurementType(text);
  const instrument = headerMap["INSTRUMENT"] || null;

  const channels: MeasurementChannel[] = [];
  if (columnLine) {
    for (const raw of columnLine.split(separator)) {
      const { name, unit } = splitChannelHeader(raw);
      if (!name) continue;
      let key = channelKey(name);
      if (!key) key = `col_${channels.length + 1}`;
      let unique = key;
      let n = 2;
      while (channels.some((c) => c.key === unique)) unique = `${key}_${n++}`;
      channels.push({ key: unique, label: name, unit });
    }
  } else {
    warnings.push("Keine Spaltenüberschrift (##…) gefunden – es konnten keine Messkanäle gelesen werden.");
  }

  const rows: number[][] = [];
  for (const line of dataLines) {
    const cells = line.split(separator);
    if (cells.length < 2) continue;
    const row = channels.map((_, i) => toNumber(cells[i] ?? "", decimal));
    if (row.every((v) => !Number.isFinite(v))) continue;
    rows.push(row);
  }
  if (channels.length > 0 && rows.length === 0) warnings.push("Kopf erkannt, aber keine Messpunkte gelesen.");

  const dataset: MeasurementDataset = { channels, rows };
  if (mtype === "DIL") deriveExpansionChannels(dataset);

  return { header, headerMap, mtype, instrument, decimal, separator, dataset, warnings };
}
