import type { ResultRecord } from "@/hooks/useResultsDatabase";
import { resultLabel } from "@/hooks/useResultsDatabase";

/**
 * Robuste Konvertierung eines Ergebniswertes in eine Zahl.
 * Unterstützt deutsches Komma, Tausenderpunkte und angehängte Einheiten.
 * Die Originaldarstellung bleibt unverändert – hier wird nur interpretiert.
 */
export function parseNumericValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Führende Zahl inkl. Vorzeichen/Exponent extrahieren, Einheit abtrennen
  const match = s.match(/^[+-]?[\d.,\s']*\d(?:[eE][+-]?\d+)?/);
  if (!match) return null;
  s = match[0].replace(/[\s']/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Letztes Trennzeichen ist das Dezimaltrennzeichen
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const parts = s.split(",");
    // 1,250,5 -> unklar; 1,250 mit 3 Nachkommastellen als Tausender behandeln
    if (parts.length > 2) s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    else s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Einheit aus einem Textwert extrahieren (falls im Wert enthalten). */
export function extractUnit(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^[+-]?[\d.,\s']*\d(?:[eE][+-]?\d+)?\s*(.+)$/);
  return m?.[1]?.trim() || null;
}

export interface ChartPointSource {
  /** Zusammenführungsschlüssel: gemeinsame Probe (Fallback: Messung). */
  key: string;
  sampleNumber: string;
  sampleName: string;
  orderNumber: string;
  serviceNames: string[];
  projectName: string;
  createdByName: string;
  completedAt: string | null;
  /** Offizielle numerische Ergebnisse, zusammengeführt über die Probe. */
  values: Record<string, number>;
}

export interface NumericParameterOption {
  /** Interner Schlüssel = fachliches Label des offiziellen Ergebnisses. */
  key: string;
  /** Anzeige inkl. Einheit, wenn vorhanden. */
  label: string;
  unit: string | null;
  count: number;
}

/**
 * Führt die offiziellen Ergebnisse der Ergebnisdatenbank über die gemeinsame
 * Probe zusammen. Keine Kreuzkombination: pro Probe entsteht genau ein Datensatz.
 */
export function buildChartSources(records: ResultRecord[]): ChartPointSource[] {
  const map = new Map<string, ChartPointSource>();
  for (const r of records) {
    const key = r.sampleNumber || r.measurementId;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        sampleNumber: r.sampleNumber || "–",
        sampleName: r.sampleName || "",
        orderNumber: r.orderNumber || "–",
        serviceNames: [],
        projectName: r.projectName || "",
        createdByName: r.createdByName || "",
        completedAt: r.completedAt,
        values: {},
      };
      map.set(key, entry);
    }
    if (r.serviceName && !entry.serviceNames.includes(r.serviceName)) entry.serviceNames.push(r.serviceName);
    if (r.completedAt && (!entry.completedAt || r.completedAt > entry.completedAt)) entry.completedAt = r.completedAt;
    for (const o of r.outputResults) {
      if (o.is_official !== true) continue;
      const num = parseNumericValue(o.value ?? o.remarks);
      if (num == null) continue;
      entry.values[resultLabel(o)] = num;
    }
  }
  return Array.from(map.values());
}

/** Alle numerisch darstellbaren offiziellen Ergebnisparameter – dynamisch erkannt. */
export function collectNumericParameters(records: ResultRecord[]): NumericParameterOption[] {
  const map = new Map<string, NumericParameterOption>();
  for (const r of records) {
    for (const o of r.outputResults) {
      if (o.is_official !== true) continue;
      const num = parseNumericValue(o.value ?? o.remarks);
      if (num == null) continue;
      const key = resultLabel(o);
      const unit = o.unit || extractUnit(o.remarks) || null;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.unit && unit) existing.unit = unit;
      } else {
        map.set(key, { key, label: key, unit, count: 1 });
      }
    }
  }
  return Array.from(map.values())
    .map((o) => ({ ...o, label: o.unit ? `${o.key} – ${o.unit}` : o.key }))
    .sort((a, b) => a.key.localeCompare(b.key, "de"));
}

export const CATEGORY_AXES = [
  { key: "__sample__", label: "Probe" },
  { key: "__order__", label: "Auftrag" },
  { key: "__service__", label: "Dienstleistung" },
  { key: "__project__", label: "Projekt" },
  { key: "__date__", label: "Datum" },
] as const;

export function isCategoryAxis(key: string): boolean {
  return CATEGORY_AXES.some((c) => c.key === key);
}

export function categoryValue(src: ChartPointSource, key: string): string {
  switch (key) {
    case "__sample__": return src.sampleName ? `${src.sampleNumber} (${src.sampleName})` : src.sampleNumber;
    case "__order__": return src.orderNumber;
    case "__service__": return src.serviceNames.join(", ") || "–";
    case "__project__": return src.projectName || "–";
    case "__date__": return src.completedAt ? new Date(src.completedAt).toLocaleDateString("de-DE") : "–";
    default: return "–";
  }
}

export interface ChartPoint {
  x: number | string;
  y: number;
  group: string;
  label: string;
}

export function buildChartPoints(
  sources: ChartPointSource[],
  xAxis: string,
  yAxis: string,
  groupBy: string,
): ChartPoint[] {
  if (!xAxis || !yAxis) return [];
  const points: ChartPoint[] = [];
  for (const s of sources) {
    const y = s.values[yAxis];
    if (y == null) continue;
    const x = isCategoryAxis(xAxis) ? categoryValue(s, xAxis) : s.values[xAxis];
    if (x == null) continue;
    points.push({
      x,
      y,
      group:
        groupBy === "project" ? s.projectName || "–"
        : groupBy === "service" ? s.serviceNames.join(", ") || "–"
        : groupBy === "creator" ? s.createdByName || "–"
        : "Alle",
      label: s.sampleNumber,
    });
  }
  return points;
}
