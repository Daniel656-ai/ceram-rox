/**
 * Datei-Importer für Geometrievermessungen (CSV aus dem Messgerät).
 *
 * Erweitert ausschließlich die bestehende Importer-Registry und das bestehende
 * Importmodell (`ImportedMeasurement`). Neu ist die fachliche Regel, dass die
 * Einzelmessungen (D1, D2, to1, ti1 Außen, d3 Innen …) automatisch ihrer
 * übergeordneten Messart zugeordnet und je Messart gemittelt werden.
 *
 * Grundregeln:
 * - Nur numerisch interpretierbare Messwerte gehen in den Mittelwert ein.
 * - Ein fehlender Messwert ist NIEMALS 0, er wird ignoriert.
 * - Ein einziger gültiger Wert ergibt genau diesen Wert als Ergebnis.
 * - Groß-/Kleinschreibung ist relevant: "D" und "d" sind verschiedene Messarten.
 * - Einzelmesswerte bleiben vollständig erhalten (eigene Ergebniszeilen).
 */
import type { FileImporter, ImportedMeasurement, ImportedResult } from "../types";
import { parseValue } from "@/lib/measurementImport";

export const GEOMETRY_IMPORTER_ID = "geometry_csv";
export const GEOMETRY_PARSER_VERSION = "1.0.0";

export interface GeometryReading {
  /** Laufende Nummer laut Datei (Spalte "Nr."), falls vorhanden. */
  no: string | null;
  /** Bezeichnung exakt wie in der Datei, z. B. "ti1 Außen". */
  element: string;
  /** Rohwert exakt wie in der Datei. */
  raw: string;
  /** Numerischer Wert oder null (leer, "---", "Fehler", Text …). */
  value: number | null;
  unit: string | null;
  /** Übergeordnete Messart, z. B. "ti". */
  group: string | null;
  /** Nummer der Einzelmessung, z. B. 1. */
  index: number | null;
  /** Zusatz der Einzelmessung, z. B. "Außen". */
  qualifier: string | null;
}

export interface GeometryGroup {
  /** Name der Messart, z. B. "D" (case-sensitiv). */
  name: string;
  unit: string | null;
  /** Arithmetischer Mittelwert der gültigen Werte (ungerundet). */
  mean: number;
  validCount: number;
  invalidCount: number;
  members: GeometryReading[];
}

/* ------------------------------------------------------------------ */
/* Datei lesen                                                         */
/* ------------------------------------------------------------------ */

/** CSV-Dateien der Messgeräte sind häufig ANSI (Windows-1252) kodiert. */
export function decodeCsvText(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "");
  try {
    return new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return utf8.replace(/^\uFEFF/, "");
  }
}

const splitRow = (line: string): string[] => {
  const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
};

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/* ------------------------------------------------------------------ */
/* Gruppierung                                                         */
/* ------------------------------------------------------------------ */

/**
 * Zerlegt eine Messelement-Bezeichnung dynamisch in Messart, Nummer und Zusatz.
 * "D2" -> { group: "D", index: 2 }
 * "ti1 Außen" -> { group: "ti", index: 1, qualifier: "Außen" }
 * "d3 Innen" -> { group: "d", index: 3, qualifier: "Innen" }
 * Die Groß-/Kleinschreibung des Präfixes bleibt erhalten ("D" ≠ "d").
 */
export function parseElementName(element: string): { group: string | null; index: number | null; qualifier: string | null } {
  const raw = String(element ?? "").trim();
  if (!raw) return { group: null, index: null, qualifier: null };
  const m = raw.match(/^([^\s\d]+?)\s*(\d+)\s*(.*)$/u);
  if (!m) return { group: raw, index: null, qualifier: null };
  const qualifier = m[3].trim();
  return { group: m[1].trim(), index: Number(m[2]), qualifier: qualifier || null };
}

/** Bildet die Messarten und deren Mittelwerte aus den Einzelmessungen. */
export function groupGeometryReadings(readings: GeometryReading[]): GeometryGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, GeometryReading[]>();
  for (const r of readings) {
    if (!r.group) continue;
    if (!buckets.has(r.group)) { buckets.set(r.group, []); order.push(r.group); }
    buckets.get(r.group)!.push(r);
  }

  const groups: GeometryGroup[] = [];
  for (const name of order) {
    const members = buckets.get(name)!;
    const valid = members.filter((m) => m.value != null && Number.isFinite(m.value));
    if (valid.length === 0) continue; // nichts Gültiges -> kein Ergebniswert (nicht 0!)
    const sum = valid.reduce((a, m) => a + (m.value as number), 0);
    const units = [...new Set(valid.map((m) => m.unit).filter(Boolean) as string[])];
    groups.push({
      name,
      unit: units.length === 1 ? units[0] : null,
      mean: sum / valid.length,
      validCount: valid.length,
      invalidCount: members.length - valid.length,
      members,
    });
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Parsen                                                              */
/* ------------------------------------------------------------------ */

interface HeaderInfo { row: number; cols: { no: number; element: number; value: number; unit: number } }

function findHeader(rows: string[][]): HeaderInfo | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map(norm);
    const element = cells.findIndex((c) => c.startsWith("messelement"));
    const value = cells.findIndex((c) => c === "messwert" || c.startsWith("istwert"));
    if (element < 0 || value < 0) continue;
    return {
      row: i,
      cols: {
        no: cells.findIndex((c) => c === "nr" || c === "nummer"),
        element,
        value,
        unit: cells.findIndex((c) => c.startsWith("einheit")),
      },
    };
  }
  return null;
}

export function parseGeometryCsv(text: string): { readings: GeometryReading[]; groups: GeometryGroup[]; header: Record<string, string>; warnings: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows = lines.map(splitRow);
  const warnings: string[] = [];
  const info = findHeader(rows);
  if (!info) return { readings: [], groups: [], header: {}, warnings: ["Keine Spaltenüberschriften „Messelemente“ / „Messwert“ gefunden."] };

  // Alles oberhalb der Kopfzeile ist Metadaten (Prüfling, Datum, Status …).
  const header: Record<string, string> = {};
  for (let i = 0; i < info.row; i++) {
    const cells = rows[i].filter((c) => c !== "");
    if (cells.length >= 2) header[cells[0].replace(/:$/, "")] = cells.slice(1).join(" ");
    else if (cells.length === 1) header[`Zeile ${i + 1}`] = cells[0];
  }

  const readings: GeometryReading[] = [];
  for (const r of rows.slice(info.row + 1)) {
    const element = (r[info.cols.element] ?? "").trim();
    if (!element) continue;
    const raw = (r[info.cols.value] ?? "").trim();
    const unitCell = info.cols.unit >= 0 ? (r[info.cols.unit] ?? "").trim() : "";
    const parsed = parseValue(raw);
    // Werte wie "<0,01", "Fehler", "---" oder leer gelten NICHT als Messwert.
    const value = !parsed.belowDetection && parsed.value != null ? parsed.value : null;
    const { group, index, qualifier } = parseElementName(element);
    readings.push({
      no: info.cols.no >= 0 ? (r[info.cols.no] ?? "").trim() || null : null,
      element,
      raw,
      value,
      unit: unitCell || parsed.unit || null,
      group,
      index,
      qualifier,
    });
  }

  if (readings.length === 0) warnings.push("Die Datei enthält keine Messelemente.");
  const groups = groupGeometryReadings(readings);
  const skipped = readings.filter((r) => r.value == null).length;
  if (skipped > 0) {
    warnings.push(
      `${skipped} Einzelmessung(en) ohne gültigen Messwert wurden ignoriert (nicht als 0 gewertet). ` +
        "Die übrigen Werte wurden ausgewertet."
    );
  }
  return { readings, groups, header, warnings };
}

/* ------------------------------------------------------------------ */
/* Importmodell                                                        */
/* ------------------------------------------------------------------ */

const normalized = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function parseGeometryMeasurement(file: { name: string; buffer: ArrayBuffer }): ImportedMeasurement {
  const text = decodeCsvText(file.buffer);
  const { readings, groups, header, warnings } = parseGeometryCsv(text);

  // 1. Mittelwerte je Messart = die eigentlichen Ergebniswerte.
  const meanResults: ImportedResult[] = groups.map((g) => ({
    sourceName: g.name,
    // Groß-/Kleinschreibung ist fachlich relevant -> im normalisierten Namen erhalten.
    normalizedName: `geom_${normalized(g.name)}_${/[A-Z]/.test(g.name) ? "u" : "l"}`,
    aliases: [g.name],
    value: g.mean,
    unit: g.unit,
    confidence: "high",
    analysis: "GEOMETRY_MEAN",
  }));

  // 2. Einzelmesswerte bleiben vollständig erhalten und nachvollziehbar.
  const singleResults: ImportedResult[] = readings
    .filter((r) => r.value != null)
    .map((r) => ({
      sourceName: r.element,
      normalizedName: `geom_single_${normalized(r.element)}`,
      aliases: [r.element],
      value: r.value as number,
      unit: r.unit,
      confidence: "medium",
      analysis: "GEOMETRY_SINGLE",
    }));

  // 3. Nachvollziehbarkeit der Mittelwertbildung (keine Ergebniswerte).
  const headerMap: Record<string, string> = { ...header };
  for (const g of groups) {
    headerMap[`Mittelwert ${g.name}`] =
      `gültige Werte: ${g.validCount} · nicht erkannte Werte: ${g.invalidCount} · ` +
      `Mittelwert: ${g.mean}${g.unit ? ` ${g.unit}` : ""} · Einzelwerte: ` +
      g.members.map((m) => `${m.element}=${m.value ?? "—"}`).join(", ");
  }

  return {
    source: "Geometrievermessung",
    instrumentFamily: "Geometrievermessung",
    sourceFileName: file.name,
    parserVersion: GEOMETRY_PARSER_VERSION,
    sampleInformation: {
      sampleName: header["Prüfling"] ?? header["Bauteil"] ?? header["Probe"] ?? undefined,
    },
    analyses: ([
      { type: "GEOMETRY_MEAN" as const, results: meanResults, series: [] },
      { type: "GEOMETRY_SINGLE" as const, results: singleResults, series: [] },
    ]).filter((a) => a.results.length > 0),
    warnings,
    unrecognized: [],
    measurementType: "GEOMETRY",
    headerMap,
  };
}

export const geometryImporter: FileImporter = {
  id: GEOMETRY_IMPORTER_ID,
  label: "Geometrievermessung (CSV)",
  extensions: [".csv", ".txt"],
  detect: (file) => {
    const head = decodeCsvText(file.buffer.slice(0, 8192));
    if (/#FORMAT:\s*NETZSCH/i.test(head)) return false;
    const cells = head.split(/\r?\n/).flatMap(splitRow).map(norm);
    return cells.some((c) => c.startsWith("messelement")) && cells.some((c) => c === "messwert" || c.startsWith("istwert"));
  },
  parse: parseGeometryMeasurement,
};
