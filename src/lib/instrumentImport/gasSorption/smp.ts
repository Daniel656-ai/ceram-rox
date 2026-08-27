/**
 * Auswertung der Messdatei (.SMP) einer Gasadsorptionsmessung.
 *
 * Die Messdatei ist die primäre Importquelle: sie enthält Probenangaben,
 * Analysebedingungen und – sofern vom Gerät mitgeschrieben – Isothermenpunkte.
 * Eine Reportdatei (.REP) ist NIE Voraussetzung; sie kann optional zusätzlich
 * importiert werden, wenn dort bereits ausgewertete Kennwerte stehen.
 *
 * Analysebedingungen gelten laut Fachvorgabe als Metadaten (Importinformationen)
 * und niemals als Ergebniswerte.
 */
import { extractStrings, scanDoubles } from "../binaryText";
import type { MeasurementDataset } from "@/lib/curves/dataset";

export interface SmpExtract {
  /** Importinformationen (Analysebedingungen, Gerät, Software, Probenangaben). */
  header: Record<string, string>;
  /** Einwaage in g, falls sie sich eindeutig aus der Datei ergibt. */
  sampleMass: number | null;
  /** Isothermenpunkte (p/p0, aufgenommene Menge), falls in der Datei enthalten. */
  isotherm: { x: number; y: number }[];
}

const num = (s: string): number | null => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

const put = (h: Record<string, string>, key: string, value: string) => {
  const v = value.trim();
  if (v && !h[key]) h[key] = v;
};

/**
 * Liest die im Analyseprotokoll der Messdatei enthaltenen Bedingungen.
 * Es werden ausschließlich vorhandene Angaben übernommen – nichts geraten.
 */
export function readSmpConditions(lines: string[]): Record<string, string> {
  const h: Record<string, string> = {};
  for (const line of lines) {
    let m: RegExpMatchArray | null;

    if ((m = line.match(/System volume:\s*([\d.,]+)\s*(\S+)/i))) put(h, "Systemvolumen", `${m[1]} ${m[2]}`);

    if ((m = line.match(/free space on port\s*(\d+)\.\s*Warm:\s*([\d.,]+)\s*(\S+),\s*Cold:\s*([\d.,]+)\s*(\S+)/i))) {
      put(h, "Messport", m[1]);
      put(h, "Free Space (warm)", `${m[2]} ${m[3]}`);
      put(h, "Free Space (kalt)", `${m[4]} ${m[5]}`);
    }

    if ((m = line.match(/Tman\s*=\s*([\d.,]+)\s*(°?\w+)/i))) put(h, "Manifold-Temperatur", `${m[1]} ${m[2]}`);

    if ((m = line.match(/^(.+?)\s*@\s*([\d.,]+)\s*K$/))) {
      put(h, "Adsorptiv", m[1].trim());
      put(h, "Badtemperatur", `${m[2]} K`);
    }

    if ((m = line.match(/analysis\s*\(Serial #\s*([\w-]+)\)/i))) put(h, "Seriennummer", m[1]);
    if ((m = line.match(/^(.*\b(?:Version)\s+[\d.]+)\s*$/i))) put(h, "Software", m[1].trim());
    if ((m = line.match(/([A-Za-z]:\\[^\s]+\.SMP)/i))) put(h, "Quelldatei (Gerät)", m[1]);
    if ((m = line.match(/^Sample Tube\b(.*)$/i))) put(h, "Probenröhrchen", `Sample Tube${m[1]}`);
    if (/inch Sample Tube/i.test(line)) put(h, "Probenröhrchen", line.trim());
    if (/Degas Conditions/i.test(line)) put(h, "Entgasung", line.trim());
  }
  return h;
}

/**
 * Einwaage: in der Messdatei steht sie als IEEE-754-Wert unmittelbar im
 * Probendatenblock (direkt hinter den Beschriftungen Sample/Operator/Bar Code).
 * Es wird nur ein Wert übernommen, wenn er physikalisch plausibel ist.
 */
export function readSmpSampleMass(buffer: ArrayBuffer, lines: { text: string; offset: number }[]): number | null {
  const anchor = lines.find((l) => /^bar code:?$/i.test(l.text)) ?? lines.find((l) => /^submitter:?$/i.test(l.text));
  if (!anchor) return null;
  // Der Wertblock liegt im Probendatensatz direkt vor bzw. nach den Beschriftungen.
  const cands = scanDoubles(buffer, Math.max(0, anchor.offset - 512), anchor.offset + 512)
    .map((d) => d.value)
    .filter((v) => v > 0.0005 && v < 100 && Math.abs(v - Math.round(v)) > 1e-9);
  return cands.length ? cands[0] : null;
}

/**
 * Isothermenpunkte aus Textzeilen (Messdatei-Export, CSV, Reporttabellen).
 * Erkannt werden Zeilen mit relativem Druck (0 <= p/p0 <= 1,1) und Menge.
 */
export function readIsothermPoints(lines: string[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const line of lines) {
    const m = line.match(
      /^\s*([01](?:[.,]\d+)?(?:[eE][+-]?\d+)?)\s*[;,\t| ]\s*([+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?)\s*$/
    );
    if (!m) continue;
    const x = num(m[1]);
    const y = num(m[2]);
    if (x == null || y == null || x < 0 || x > 1.1) continue;
    pts.push({ x, y });
  }
  return pts.length >= 5 ? pts : [];
}

/** Rohdatensatz (Isotherme) im generischen ROX-Kurvenmodell. */
export function isothermDataset(points: { x: number; y: number }[]): MeasurementDataset | undefined {
  if (points.length === 0) return undefined;
  return {
    channels: [
      { key: "relative_pressure", label: "Relativdruck p/p₀", unit: null },
      { key: "quantity_adsorbed", label: "Adsorbierte Menge", unit: "cm³/g STP" },
    ],
    rows: points.map((p) => [p.x, p.y]),
  };
}

/** Vollständige Auswertung der Messdatei. */
export function extractSmp(buffer: ArrayBuffer, lines: string[]): SmpExtract {
  const strings = extractStrings(buffer, 3);
  return {
    header: readSmpConditions(lines),
    sampleMass: readSmpSampleMass(buffer, strings),
    isotherm: readIsothermPoints(lines),
  };
}
