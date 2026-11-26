import { normalizeSamplingKey, NO_MEASUREMENT_CODE, serviceNamesForCode } from '@/lib/samplingCodeMap';
import type { M3SamplePlanEntry } from './sampleNumber';

export const ROW_SERVICES_KEY = 'row_lab_tests_selected';
export function hasRowServiceOverride(row: Record<string, unknown>): boolean { return row[ROW_SERVICES_KEY] != null; }
export function effectiveRowServices(row: Record<string, unknown>, standard: string[]): string[] {
  const value = row[ROW_SERVICES_KEY];
  if (value != null && (!Array.isArray(value) || value.some(c => typeof c !== 'string'))) throw new Error('Individuelle Messungsauswahl ist ungültig. Bitte die Zeile prüfen.');
  const codes = (value == null ? standard : value) as string[];
  const seen = new Set<string>();
  return codes.map(c => c.trim()).filter(c => { const k = normalizeSamplingKey(c); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}
export function rowServicesDescription(row: Record<string, unknown>, standard: string[]): string | null {
  if (!hasRowServiceOverride(row)) return null;
  const codes = effectiveRowServices(row, standard);
  return `Individuelle Messungen (Planung): ${codes.join(', ') || 'keine'}`;
}
export type ResolvedM3Service = { id: string; code: string; service_name: string };
/** Resolves every planned row before the caller performs any write. No workflow expansion here. */
export async function planM3RowServices(plan: M3SamplePlanEntry[], rows: Record<string, unknown>[], standard: string[], resolve: (codes: string[]) => Promise<{ matched: ResolvedM3Service[]; missing: string[] }>) {
  const result = [];
  const errors: string[] = [];
  for (const p of plan) {
    const codes = effectiveRowServices(rows[p.rowIndex] ?? {}, standard);
    const r = await resolve(codes);
    if (r.missing.length) errors.push(`Zeile ${p.rowIndex + 1}: ${r.missing.join(', ')}`);
    // Legacy Bench requires both services. The existing resolver may otherwise return only one half.
    if (codes.some(c => normalizeSamplingKey(c) === 'bench')) {
      const bench = await resolve(['Bench']);
      if (bench.missing.length || new Set(bench.matched.map(m => m.id)).size < serviceNamesForCode('Bench').length)
        errors.push(`Zeile ${p.rowIndex + 1}: Bench ist nicht vollständig zugeordnet.`);
    }
    const ids = new Set<string>();
    result.push({ ...p, services: r.matched.filter(m => { if (ids.has(m.id)) return false; ids.add(m.id); return true; }) });
    if (codes.some(c => normalizeSamplingKey(c) === normalizeSamplingKey(NO_MEASUREMENT_CODE)) && codes.length > 1) errors.push(`Zeile ${p.rowIndex + 1}: „Keine Messung notwendig“ darf nicht mit Messungen kombiniert werden.`);
  }
  if (errors.length) throw new Error(`Beprobungsauftrag nicht erstellt. Nicht auflösbare oder inaktive Messungen: ${errors.join(' · ')}`);
  return result;
}
