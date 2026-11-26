/** Independent m³ working inputs. Never writes to the release or to results. */
import { diameterTolerance, freeTolerance, innerWallTolerance, lengthTolerance } from './calculations';

export const M3_TOLERANCES = [
  { key: 'length_tolerance', source: 'length_tolerance', label: 'Längentoleranz' },
  // The release catalogue explicitly labels cross_section_mm as Querschnitt D.
  { key: 'diameter_tolerance', source: 'cross_section_tolerance', label: 'Querschnitt-/Durchmessertoleranz' },
  { key: 'inner_wall_tolerance', source: 'inner_wall_tolerance', label: 'Innenwandtoleranz' },
] as const;
const owns = (v: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(v, key);

export function initializeM3Tolerances(stored: Record<string, unknown>, release: Record<string, unknown> | null, cells: number | null): Record<string, unknown> {
  const next = { ...stored };
  const legacy = owns(stored, 'tolerance_variant') || owns(stored, 'tolerance_free');
  const variant = Number(stored.tolerance_variant ?? 1);
  const legacyValues: Record<string, unknown> = {
    length_tolerance: (stored.tolerance_free === true ? freeTolerance(stored.tol_length_plus, stored.tol_length_minus) : null) ?? lengthTolerance(variant),
    diameter_tolerance: (stored.tolerance_free === true ? freeTolerance(stored.tol_diameter_plus, stored.tol_diameter_minus) : null) ?? diameterTolerance(variant),
    inner_wall_tolerance: innerWallTolerance(cells),
  };
  for (const { key, source } of M3_TOLERANCES) {
    // Own null/empty values are intentional; neither a later release nor legacy settings replace them.
    if (!owns(stored, key)) next[key] = legacy ? legacyValues[key] : release?.[source] ?? '';
  }
  return next;
}

/** Keep native text editing states, but never treat blanks/invalid states as zero. */
export function parseM3Decimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const text = String(value).trim().replace('−', '-').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Accept symmetric/asymmetric mm expressions, retaining the exact original text. */
export function validM3Tolerance(value: unknown): boolean {
  if (value == null || String(value).trim() === '') return true;
  const text = String(value).trim().replace(/−/g, '-').replace(/\s+/g, '').replace(/\[?mm\]?$/i, '').replace(/^\((.*)\)$/, '$1').replace(/,/g, '.');
  const n = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  return new RegExp(`^(?:[+-]?${n}|(?:±|\\+/-)${n}|\\+${n}/-${n})$`).test(text);
}

export function canonicalM3(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(value));
}

export function validateM3Inputs(values: Record<string, unknown>, original: Record<string, unknown> = {}): void {
  for (const { key, label } of M3_TOLERANCES) {
    // Historical release expressions remain inspectable; changing one requires a valid expression.
    if (values[key] !== original[key] && !validM3Tolerance(values[key])) throw new Error(`${label}: Bitte eine gültige Toleranz in mm eingeben, z. B. +0,02/-0,05 mm.`);
  }
  const numbers = ['delivery_volume_m3', 'av_nox', 'av_sox', 'spare_elements', 'mounting_frames'];
  const check = (v: unknown, name: string) => {
    if (v != null && String(v).trim() !== '' && (parseM3Decimal(v) == null || (parseM3Decimal(v) ?? 0) < 0)) throw new Error(`${name}: Bitte eine gültige, nicht negative Zahl eingeben.`);
  };
  for (const key of numbers) check(values[key], key);
  if (Array.isArray(values.m3_rows)) values.m3_rows.forEach((row, i) => check(row?.volume_m3, `m³-Zeile ${i + 1}`));
}
