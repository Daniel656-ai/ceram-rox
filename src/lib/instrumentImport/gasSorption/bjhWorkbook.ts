/**
 * Auswertung einer BJH-/Porengrößenverteilungs-Auswertung im Tabellenformat
 * (.xlsx-Report des Gasadsorptionsgerätes).
 *
 * Zwei Informationsquellen werden gelesen – beide bezeichnungsbasiert, nicht
 * positionsbasiert:
 *   1. Arbeitsblatt: Kennwerte („BET Surface Area =“, „Total BJH Pore Volume =“ …)
 *      inklusive der Bereichstabellen „Volume (25 - 10nm)“ / „Area (…)“ mit %-Anteil.
 *   2. Diagramme der Arbeitsmappe: die dort hinterlegten Wertepaare der
 *      Porengrößenverteilung (Pore Size Diameter gegen Incremental/Differential
 *      Pore Volume bzw. Pore Area). Diese Rohdaten sind die einzige vollständige
 *      Quelle der Verteilung und werden unverändert übernommen.
 *
 * Es werden ausschließlich tatsächlich vorhandene Werte übernommen – nichts
 * berechnet, nichts gerundet, nichts geraten.
 */
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import type { ImportedResult, ImportedSeries } from "../types";
import { channelKey, type MeasurementChannel, type MeasurementDataset } from "@/lib/curves/dataset";

export const BJH_WORKBOOK_PARSER_VERSION = "1.0.0-bjh-workbook";

export interface BjhWorkbookExtract {
  results: ImportedResult[];
  series: ImportedSeries[];
  dataset: MeasurementDataset | null;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

const normalizeUnit = (u: string | null | undefined): string | null => {
  const s = String(u ?? "").trim();
  if (!s) return null;
  return s.replace(/(?<=[a-zA-Z])2\b/g, "²").replace(/(?<=[a-zA-Z])3\b/g, "³");
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Kennwerte, die als reguläre Ergebniswerte des Messfalls BJH gelten. */
const KEY_PARAMETERS: Array<{
  test: RegExp;
  normalizedName: string;
  displayName: string;
  aliases: string[];
  unit: string;
}> = [
  {
    test: /bet\s+surface\s+area/i,
    normalizedName: "bet_surface_area",
    displayName: "BET Surface Area",
    aliases: ["BET Surface Area", "BET Oberfläche", "Spezifische Oberfläche-BET", "bet_surface_area", "BET"],
    unit: "m²/g",
  },
  {
    test: /bjh\s+average/i,
    normalizedName: "bjh_average_pore_width",
    displayName: "BJH Average Pore Width",
    aliases: [
      "BJH Average Pore Width", "BJH Average (4V/A)", "BJH mittlere Porenweite",
      "Mittlere Porenweite", "bjh_average_pore_width",
    ],
    unit: "nm",
  },
  {
    test: /total\s+bjh\s+pore\s+volume/i,
    normalizedName: "bjh_total_pore_volume",
    displayName: "Total BJH Pore Volume",
    aliases: ["Total BJH Pore Volume", "BJH Porenvolumen", "Gesamtporenvolumen BJH", "bjh_total_pore_volume"],
    unit: "cm³/g",
  },
  {
    test: /total\s+bjh\s+pore\s+area/i,
    normalizedName: "bjh_total_pore_area",
    displayName: "Total BJH Pore Area",
    aliases: ["Total BJH Pore Area", "BJH Porenfläche", "BJH Porenoberfläche", "bjh_total_pore_area"],
    unit: "m²/g",
  },
];

/* ------------------------------------------------------------------ */
/* Arbeitsblatt: Kennwerte und Bereichstabelle                         */
/* ------------------------------------------------------------------ */

type Grid = unknown[][];

function sheetGrids(buffer: ArrayBuffer): Grid[] {
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map(
    (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) as Grid
  );
}

interface RowReading {
  label: string;
  value: number;
  unit: string | null;
  percent: number | null;
}

/** Liest „Bezeichnung =  Wert  Einheit  [Anteil %]“ aus einer Tabellenzeile. */
function readRow(row: unknown[]): RowReading | null {
  const labelIdx = row.findIndex((c) => typeof c === "string" && /\S/.test(c) && /=\s*$/.test(c));
  if (labelIdx < 0) return null;
  const label = String(row[labelIdx]).replace(/\s*=\s*$/, "").trim();
  if (!label) return null;

  const rest = row.slice(labelIdx + 1);
  const values: number[] = [];
  const units: string[] = [];
  for (const cell of rest) {
    if (cell == null || cell === "") continue;
    const n = num(cell);
    if (n != null && !(typeof cell === "string" && /^[a-z²³%/]+$/i.test(cell))) {
      if (values.length === units.length) values.push(n);
      continue;
    }
    if (typeof cell === "string") units.push(cell.trim());
  }
  if (values.length === 0) return null;

  return {
    label,
    value: values[0],
    unit: normalizeUnit(units[0] ?? null),
    percent: values.length > 1 ? values[1] : null,
  };
}

function readWorkbookResults(grids: Grid[]): { results: ImportedResult[]; missing: string[] } {
  const results: ImportedResult[] = [];
  const seen = new Set<string>();

  for (const grid of grids) {
    for (const row of grid) {
      const reading = readRow(row ?? []);
      if (!reading) continue;

      const key = KEY_PARAMETERS.find((p) => p.test.test(reading.label));
      if (key) {
        if (seen.has(key.normalizedName)) continue;
        seen.add(key.normalizedName);
        results.push({
          sourceName: key.displayName,
          normalizedName: key.normalizedName,
          aliases: key.aliases,
          value: reading.value,
          unit: reading.unit ?? key.unit,
          confidence: "high",
          analysis: key.normalizedName === "bet_surface_area" ? "BET" : "BJH",
        });
        continue;
      }

      // Bereichstabelle der Porenverteilung: „Volume (25 - 10nm)“ / „Area (<2,5nm)“
      const range = reading.label.match(/^(volume|area)\s*\((.+)\)$/i);
      if (!range) continue;
      const kind = range[1].toLowerCase() === "volume" ? "volume" : "area";
      const base = `bjh_${kind}_${slug(range[2])}`;
      if (seen.has(base)) continue;
      seen.add(base);
      results.push({
        sourceName: reading.label,
        normalizedName: base,
        aliases: [reading.label],
        value: reading.value,
        unit: reading.unit,
        confidence: "high",
        analysis: "BJH",
      });
      if (reading.percent != null) {
        results.push({
          sourceName: `${reading.label} %`,
          normalizedName: `${base}_percent`,
          aliases: [`${reading.label} %`],
          value: reading.percent,
          unit: "%",
          confidence: "high",
          analysis: "BJH",
        });
      }
    }
  }

  const missing = KEY_PARAMETERS.filter((p) => !seen.has(p.normalizedName)).map((p) => p.displayName);
  return { results, missing };
}

/* ------------------------------------------------------------------ */
/* Diagramme: Verteilungsdaten                                         */
/* ------------------------------------------------------------------ */

const textOf = (xml: string) =>
  [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("").trim();

const litPoints = (block: string): number[] => {
  const out: number[] = [];
  for (const m of block.matchAll(/<c:pt idx="(\d+)"[^>]*>\s*<c:v>([^<]*)<\/c:v>/g)) {
    const v = Number(m[2]);
    out[Number(m[1])] = Number.isFinite(v) ? v : NaN;
  }
  return out;
};

/** Trennt „V [cm3/g]“ in Bezeichnung und Einheit. */
function splitAxis(title: string): { label: string; unit: string | null } {
  const m = title.match(/^(.*?)\s*\[([^\]]*)\]\s*$/);
  if (!m) return { label: title.trim(), unit: null };
  return { label: m[1].trim(), unit: normalizeUnit(m[2]) };
}

function readChartSeries(buffer: ArrayBuffer): ImportedSeries[] {
  const bytes = new Uint8Array(buffer);
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return [];

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => /^xl\/charts\/chart\d+\.xml$/.test(f.name) });
  } catch {
    return [];
  }

  const series: ImportedSeries[] = [];
  for (const name of Object.keys(files).sort()) {
    const xml = strFromU8(files[name]);
    const titles = [...xml.matchAll(/<c:title>[\s\S]*?<\/c:title>/g)].map((m) => textOf(m[0]));
    const chartTitle = titles[0] ?? "";
    const [xTitleRaw, yTitleRaw] = [titles[1] ?? "", titles[2] ?? ""];
    const vs = chartTitle.split(/\s+vs\.?\s+/i);
    const xAxis = splitAxis(xTitleRaw || (vs[1] ?? "Pore Size Diameter"));
    const yAxis = splitAxis(yTitleRaw || (vs[0] ?? chartTitle));
    const yName = (vs[0] ?? chartTitle).trim();
    const xName = (vs[1] ?? xAxis.label ?? "Pore Size Diameter").trim();

    for (const block of xml.split("<c:ser>").slice(1)) {
      const seriesName = block.match(/<c:tx>\s*<c:v>([^<]*)<\/c:v>/)?.[1]?.trim() ?? "";
      const xBlock = block.match(/<c:xVal>[\s\S]*?<\/c:xVal>/)?.[0];
      const yBlock = block.match(/<c:yVal>[\s\S]*?<\/c:yVal>/)?.[0];
      if (!xBlock || !yBlock) continue;
      const xs = litPoints(xBlock);
      const ys = litPoints(yBlock);
      const points = xs
        .map((x, i) => ({ x, y: ys[i] }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (points.length === 0) continue;
      series.push({
        name: seriesName ? `${yName} (${seriesName})` : yName,
        xLabel: xName,
        xUnit: xAxis.unit,
        yLabel: yName,
        yUnit: yAxis.unit,
        points,
      });
    }
  }
  return series;
}

/* ------------------------------------------------------------------ */
/* Datensatz (Tabelle/Grafik)                                          */
/* ------------------------------------------------------------------ */

/** Führt alle Verteilungskurven über die Porengröße zu einem Datensatz zusammen. */
export function distributionDataset(series: ImportedSeries[]): MeasurementDataset | null {
  if (series.length === 0) return null;
  const xLabel = series[0].xLabel || "Pore Size Diameter";
  const xUnit = series[0].xUnit ?? null;

  const channels: MeasurementChannel[] = [
    { key: channelKey(xLabel), label: xLabel, unit: xUnit },
    ...series.map((s) => ({ key: channelKey(s.name), label: s.name, unit: s.yUnit ?? null })),
  ];

  const rows = new Map<number, number[]>();
  series.forEach((s, i) => {
    for (const p of s.points) {
      const row = rows.get(p.x) ?? [p.x, ...series.map(() => NaN)];
      row[i + 1] = p.y;
      rows.set(p.x, row);
    }
  });

  const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r);
  return { channels, rows: sorted };
}

/* ------------------------------------------------------------------ */
/* Einstieg                                                            */
/* ------------------------------------------------------------------ */

export function parseBjhWorkbook(file: { name: string; buffer: ArrayBuffer }): BjhWorkbookExtract | null {
  let grids: Grid[];
  try {
    grids = sheetGrids(file.buffer);
  } catch {
    return null;
  }

  const { results, missing } = readWorkbookResults(grids);
  const series = readChartSeries(file.buffer);
  if (results.length === 0 && series.length === 0) return null;

  const warnings: string[] = [];
  if (missing.length > 0) {
    warnings.push(
      `Folgende BJH-Kennwerte konnten in der Datei nicht eindeutig erkannt werden: ${missing.join(", ")}. ` +
        "Bitte die Werte prüfen und bei Bedarf manuell ergänzen."
    );
  }
  if (series.length === 0) {
    warnings.push(
      "In dieser Datei wurden keine Verteilungsdaten (Porengröße gegen Porenvolumen bzw. Porenfläche) gefunden. " +
        "Tabelle und Diagramme der Porenverteilung können daher nicht erzeugt werden."
    );
  }

  return { results, series, dataset: distributionDataset(series), warnings };
}
