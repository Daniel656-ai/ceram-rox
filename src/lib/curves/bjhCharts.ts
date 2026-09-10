/**
 * Feste Diagrammzuordnung der BJH-Auswertung.
 *
 * Die vier Diagramme gehören fachlich zur BJH-Auswertung und sind nicht frei
 * konfigurierbar. Sie greifen ausschließlich auf die EINMAL importierten und
 * gespeicherten Messpunkte des Datensatzes zu – es werden keine Messdaten
 * dupliziert, aggregiert, gerundet oder neu berechnet.
 */
import { channelIndex, type MeasurementDataset, type CurvePoint } from "./dataset";

export type BjhChartId =
  | "incremental_pore_volume"
  | "incremental_pore_area"
  | "differential_pore_volume"
  | "differential_pore_area";

export interface BjhChartDefinition {
  id: BjhChartId;
  title: string;
  /** Erwartete Y-Größe laut Importprofil. */
  yLabel: string;
  /** Fachlich vorgesehene Einheit (nur Anzeige, falls die Datei keine liefert). */
  yUnit: string | null;
  /** Erkennung der zugehörigen importierten Kurve. */
  test: RegExp;
}

export const BJH_CHART_DEFINITIONS: BjhChartDefinition[] = [
  {
    id: "incremental_pore_volume",
    title: "Incremental Pore Volume vs. Pore Size Diameter",
    yLabel: "Incremental Pore Volume",
    yUnit: "cm³/g",
    test: /incremental\s+pore\s+volume/i,
  },
  {
    id: "incremental_pore_area",
    title: "Incremental Pore Area vs. Pore Size Diameter",
    yLabel: "Incremental Pore Area",
    yUnit: "m²/g",
    test: /incremental\s+pore\s+area/i,
  },
  {
    id: "differential_pore_volume",
    title: "Differential Pore Volume vs. Pore Size Diameter",
    yLabel: "Differential Pore Volume",
    yUnit: null,
    test: /(differential|dv\/d)\s*.*pore\s+volume|dv\s*\/\s*dlog/i,
  },
  {
    id: "differential_pore_area",
    title: "Differential Pore Area vs. Pore Size Diameter",
    yLabel: "Differential Pore Area",
    yUnit: null,
    test: /(differential|da\/d)\s*.*pore\s+area|da\s*\/\s*dlog/i,
  },
];

const X_TEST = /pore\s*(size|width|diameter)/i;

export interface BjhChartSeries {
  /** Kanal des Datensatzes (gemeinsame Datenbasis). */
  key: string;
  label: string;
  unit: string | null;
  points: CurvePoint[];
}

export interface BjhChart {
  definition: BjhChartDefinition;
  xLabel: string;
  xUnit: string | null;
  series: BjhChartSeries[];
}

/** X-Kanal (Porengröße) des Datensatzes. */
export function bjhSizeChannelKey(dataset: MeasurementDataset): string | null {
  const c = dataset.channels.find((ch) => X_TEST.test(ch.label));
  return c?.key ?? null;
}

/**
 * Erzeugt die vier BJH-Diagramme aus den gespeicherten Messpunkten.
 * Liefert nur Diagramme, zu denen tatsächlich importierte Kurven vorliegen.
 */
export function buildBjhCharts(dataset: MeasurementDataset | null | undefined): BjhChart[] {
  if (!dataset || dataset.rows.length === 0) return [];
  const xKey = bjhSizeChannelKey(dataset);
  if (!xKey) return [];
  const xi = channelIndex(dataset, xKey);
  const xChannel = dataset.channels[xi];

  const charts: BjhChart[] = [];
  for (const def of BJH_CHART_DEFINITIONS) {
    const series: BjhChartSeries[] = [];
    dataset.channels.forEach((ch, idx) => {
      if (idx === xi || !def.test.test(ch.label)) return;
      // Differential darf nicht als Incremental gelesen werden und umgekehrt.
      if (def.id.startsWith("incremental") && /differential|d[va]\s*\//i.test(ch.label)) return;
      if (def.id.startsWith("differential") && /incremental/i.test(ch.label)) return;
      const points: CurvePoint[] = [];
      for (const row of dataset.rows) {
        const x = row[xi];
        const y = row[idx];
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      }
      if (points.length === 0) return;
      points.sort((a, b) => a.x - b.x);
      series.push({ key: ch.key, label: ch.label, unit: ch.unit ?? def.yUnit, points });
    });
    if (series.length > 0) {
      charts.push({
        definition: def,
        xLabel: xChannel?.label ?? "Pore Size Diameter",
        xUnit: xChannel?.unit ?? "nm",
        series,
      });
    }
  }
  return charts;
}

export const hasBjhCharts = (dataset: MeasurementDataset | null | undefined) =>
  buildBjhCharts(dataset).length > 0;
