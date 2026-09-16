/**
 * ROX – Fachlogik der m³-Liste
 * ============================
 *
 * Die Berechnungen entsprechen 1:1 der fachlichen Excel-Vorlage
 * („m³-Liste", F5, Rev. 4-11/23). Die Excel-Datei ist ausschließlich fachliche
 * Vorlage – zur Laufzeit wird sie nicht benötigt.
 *
 * Alle Konstanten (Querschnitt, Druckprüfung, RSM-Maximum, Laborkat-Zuschlag,
 * Rundungsschritt) werden von außen übergeben und stammen aus der vorhandenen
 * ROX-Konstantenmechanik (globale Felder mit Quelle „Konstante"). Es gibt hier
 * bewusst keine Ersatzwerte.
 */

export interface M3Constants {
  /** Querschnitt eines Elements in m (Excel: 0,15 × 0,15 m). */
  crossSectionM: number;
  /** Länge je Druckprüfung in mm (Excel: 150 mm, zweimal). */
  pressureTestMm: number;
  /** Maximale RSM-Länge in mm (Excel: 350 mm). */
  rsmMaxMm: number;
  /** Zuschlag Laborkat-Länge in mm (Excel: +50 mm). */
  laborKatAddMm: number;
  /** Rundungsschritt der Elementanzahl je m³-Zeile (Excel: 10). */
  elementRounding: number;
}

/** Excel-ROUND: kaufmännisch, von der Null weg. */
export const excelRound = (value: number, digits = 0): number => {
  const f = Math.pow(10, digits);
  return (Math.sign(value) * Math.round(Math.abs(value) * f)) / f;
};

export const excelRoundUp = (value: number): number => Math.ceil(value - 1e-9);

/** Volumen eines Elements in m³ (Querschnitt × Länge). */
const elementVolume = (lengthMm: number, c: M3Constants) =>
  c.crossSectionM * c.crossSectionM * (lengthMm / 1000);

/** Excel P2: Anzahl der Elemente eines m³. */
export function elementsPerCubicMeter(lengthMm: number, c: M3Constants): number | null {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return null;
  const v = elementVolume(lengthMm, c);
  return v > 0 ? 1 / v : null;
}

/** Excel I10: Elementanzahl je m³-Zeile, gerundet auf den Rundungsschritt. */
export function elementCountForRow(
  volumeM3: number,
  lengthMm: number,
  c: M3Constants
): number | null {
  if (!Number.isFinite(volumeM3) || !Number.isFinite(lengthMm) || lengthMm <= 0) return null;
  const step = c.elementRounding || 1;
  return excelRound(volumeM3 / elementVolume(lengthMm, c) / step) * step;
}

/** Excel M5: zu kennzeichnende Elemente = (Ersatzelemente + Einbaurahmen) + 10 %. */
export function markingElements(spareElements: number, mountingFrames: number): number {
  const sum = (Number(spareElements) || 0) + (Number(mountingFrames) || 0);
  return excelRound(sum * 1.1);
}

/** Excel N6: Anzahl der zu kennzeichnenden m³-Zeilen. */
export function markingRows(marking: number, perCubicMeter: number | null): number | null {
  if (!perCubicMeter || perCubicMeter <= 0) return null;
  return excelRoundUp(marking / perCubicMeter);
}

export interface LaborKatResult {
  /** Excel N9: Laborkat-Länge = Länge + Zuschlag. */
  laborKatLengthMm: number;
  /** Excel N10: RSM-Länge (MIN). */
  rsmMinMm: number;
  /** Excel N11: RSM-Länge (MAX). */
  rsmMaxMm: number;
  /** Excel N12/N13: je Druckprüfung. */
  pressureTestMm: number;
  /** Excel N14: notwendige Länge. */
  requiredLengthMm: number;
  /** Excel N15: Anzahl Labor-KAT. */
  count: number;
}

/** Excel N8–N15: Labor-KAT-Berechnung. */
export function laborKat(lengthMm: number, c: M3Constants): LaborKatResult | null {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return null;
  const rsmMin = lengthMm <= c.rsmMaxMm ? lengthMm : c.rsmMaxMm;
  const required = rsmMin + c.pressureTestMm + c.pressureTestMm;
  return {
    laborKatLengthMm: lengthMm + c.laborKatAddMm,
    rsmMinMm: rsmMin,
    rsmMaxMm: c.rsmMaxMm,
    pressureTestMm: c.pressureTestMm,
    requiredLengthMm: required,
    count: excelRoundUp(required / lengthMm),
  };
}

/* -------------------------------------------------------------
 * Zellenzahl
 * ----------------------------------------------------------- */

/** Excel Q8 (Plausibilitätsprüfung): Zellenzahl aus Stellen 3–4 der Auftragsnummer. */
export function cellCountFromOrderNumber(orderNumber: string | null | undefined): number | null {
  const s = String(orderNumber ?? "");
  if (s.length < 4) return null;
  const n = Number(s.slice(2, 4));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fachliche Quelle: Zellkonfiguration / Zellularität der Fertigungsfreigabe. */
export function cellCountFromConfiguration(config: unknown): number | null {
  if (config == null) return null;
  if (typeof config === "number") return Number.isFinite(config) ? config : null;
  const m = String(config).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* -------------------------------------------------------------
 * NOx / SOx – Zuordnungstabellen 10 … 75 Zellen (Excel Q10/Q11/Q13/Q14)
 * ----------------------------------------------------------- */

const NOX_TARGET_N: Record<number, number> = {
  10: 2, 13: 3, 15: 3, 16: 3, 18: 3, 20: 3, 21: 3, 22: 3,
  25: 4, 30: 4, 35: 4, 38: 4, 40: 5, 50: 5, 60: 9, 75: 10,
};
const NOX_EXPECTED_L: Record<number, number> = {
  10: 235, 13: 130, 15: 155, 16: 165, 18: 180, 20: 200, 21: 220, 22: 230,
  25: 150, 30: 170, 35: 210, 38: 220, 40: 150, 50: 185, 60: 150, 75: 142,
};
const SOX_TARGET_N: Record<number, number> = {
  10: 0, 13: 3, 15: 4, 16: 4, 18: 4, 20: 4, 21: 4, 22: 4,
  25: 5, 30: 5, 35: 5, 38: 5, 40: 6, 50: 6, 60: 7, 75: 0,
};
const SOX_EXPECTED_L: Record<number, number> = {
  10: 0, 13: 330, 15: 320, 16: 240, 18: 275, 20: 280, 21: 300, 22: 320,
  25: 240, 30: 270, 35: 330, 38: 350, 40: 270, 50: 320, 60: 290, 75: 0,
};

export interface MicroResult {
  /** Soll-n laut Zuordnungstabelle. */
  targetN: number;
  /** Erwartete Länge laut Zuordnungstabelle. */
  expectedLengthMm: number;
  /** Prüfung auf Länge. */
  nByLength: number;
  /** Prüfung auf AV. */
  nByAv: number;
  /** Ergebnis (Excel MAX). */
  n: number;
  /** Anzeigetext „Mikro = n x n Zellen". */
  label: string;
}

function micro(
  cells: number | null,
  lengthMm: number,
  avValue: number | null,
  avLimit: number,
  targets: Record<number, number>,
  expected: Record<number, number>
): MicroResult | null {
  if (cells == null || !(cells in targets)) return null;
  const targetN = targets[cells];
  const expectedLengthMm = expected[cells];
  const nByLength = lengthMm < expectedLengthMm ? targetN + 1 : targetN;
  const nByAv = avValue != null && avValue < avLimit ? targetN + 1 : targetN;
  const n = Math.max(nByLength, nByAv);
  return { targetN, expectedLengthMm, nByLength, nByAv, n, label: `Mikro = ${n}x${n} Zellen` };
}

/** Excel S10/S12/S14: NOx-n. AV-Grenze 25. */
export const noxMicro = (cells: number | null, lengthMm: number, avNox: number | null) =>
  micro(cells, lengthMm, avNox, 25, NOX_TARGET_N, NOX_EXPECTED_L);

/** Excel S11/S13/S15: SOx-n. AV-Grenze 10. */
export const soxMicro = (cells: number | null, lengthMm: number, avSox: number | null) =>
  micro(cells, lengthMm, avSox, 10, SOX_TARGET_N, SOX_EXPECTED_L);

/* -------------------------------------------------------------
 * Toleranzen (Excel I4, C6, R19)
 * ----------------------------------------------------------- */

export const lengthTolerance = (variant: number) =>
  variant === 1 ? "(+3/-3) [mm]" : "(+0/-3) [mm]";

export const diameterTolerance = (variant: number) =>
  variant === 1 ? "(+/-2) [mm]" : "(+2/-2) [mm]";

export const innerWallTolerance = (cells: number | null) =>
  cells != null && cells > 29 ? "(+0/-0,05) [mm]" : "(+0/-0,1) [mm]";

/* -------------------------------------------------------------
 * Laborprüfungen (Excel A10 / O21 / O22 / O23)
 * ----------------------------------------------------------- */

export interface LabScopeResult {
  tests: string[];
  text: string;
  /** SOx entfällt trotz Anforderung, weil die Liefermenge > 20 m³ ist. */
  soxDroppedByVolume: boolean;
}

export function labScope(args: {
  soxRequired: boolean;
  deliveryVolumeM3: number | null;
  cells: number | null;
}): LabScopeResult {
  const overVolume = (args.deliveryVolumeM3 ?? 0) > 20;
  const withSox = args.soxRequired && !overVolume;
  const tests = ["Geo", "NOx"];
  if (withSox) tests.push("SOx");
  tests.push("BET", "PV", "DP");
  if (args.cells != null && args.cells < 35) tests.push("A");
  tests.push("CA");
  return {
    tests,
    text: tests.join(", "),
    soxDroppedByVolume: args.soxRequired && overVolume,
  };
}

/** Manuelle Kopiervorlagen der Excel-Vorlage (Bench bleibt manuell). */
export const BENCH_TEMPLATES = {
  withoutSox: "Geo, NOx, BET, PV, DP, A, CA + Bench",
  withSox: "Geo, NOx, SOx, BET, PV, DP, A, CA + Bench",
} as const;
