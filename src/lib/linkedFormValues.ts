/**
 * ROX – Auflösung der Wertquelle „Wert aus verknüpftem Formular“.
 * ===============================================================
 *
 * Reine Leselogik über den bereits bestehenden Ergebnisspeicher
 * (`measurement_results.result_name`). Es entsteht KEIN zweiter Speicherort,
 * keine Datenkopie und keine neue Struktur.
 *
 * Zwei Schreibweisen existieren im Bestand:
 *  - einfaches Formularfeld:      `form:<form_id>:<field_key>`
 *  - Ergebnis eines Messdatenblocks (messungsbezogen):
 *                                 `form:<form_id>:<block>[<messung>].<field_key>`
 *
 * Verknüpfungen werden am Feldschlüssel konfiguriert (`D`, `ti`, `d` …).
 * Deshalb wird ein messungsbezogenes Ergebnis zusätzlich unter seinem reinen
 * Feldschlüssel bereitgestellt. Der exakte Schlüssel bleibt unverändert
 * erhalten und hat immer Vorrang – bestehende Verknüpfungen normaler
 * Formularfelder verhalten sich unverändert.
 */

export interface LinkedResultRow {
  result_name?: string | null;
  value?: unknown;
  remarks?: unknown;
  measured_at?: string | null;
  is_official?: boolean | null;
}

export interface LinkedMeasurementRow {
  id?: string | null;
  sample_id?: string | null;
  updated_at?: string | null;
  measurement_results?: LinkedResultRow[] | null;
}

/** Zerlegt `<block>[<messung>].<field_key>` – sonst `null`. */
export function parseInstanceResultKey(
  key: string,
): { blockKey: string; instanceId: string; fieldKey: string } | null {
  const m = /^(.+)\[(.*)\]\.(.+)$/.exec(key);
  if (!m) return null;
  const [, blockKey, instanceId, fieldKey] = m;
  if (!blockKey || !fieldKey) return null;
  return { blockKey, instanceId, fieldKey };
}

const timeValue = (...candidates: Array<string | null | undefined>): number => {
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (Number.isFinite(t)) return t;
  }
  return 0;
};

interface AliasCandidate {
  value: unknown;
  official: boolean;
  time: number;
}

/**
 * Baut die Zuordnung `form_id -> { field_key: Wert }` für die Wertverknüpfung.
 *
 * Priorisierung des zusätzlichen (messungsbezogenen) Feldschlüssels:
 *  1. ein exakt gespeicherter einfacher Feldschlüssel gewinnt immer
 *  2. ein ausdrücklich offizielles Ergebnis vor einem nicht offiziellen
 *  3. bei gleichem Status das zuletzt aktualisierte Ergebnis
 */
export function buildLinkedFormValues(
  rows: LinkedMeasurementRow[] | null | undefined,
  opts: { sampleId?: string | null; excludeMeasurementId?: string | null } = {},
): Record<string, Record<string, unknown>> {
  const { sampleId, excludeMeasurementId } = opts;
  const out: Record<string, Record<string, unknown>> = {};
  /** form_id -> field_key -> bester messungsbezogener Kandidat */
  const aliases = new Map<string, Map<string, AliasCandidate>>();
  /** form_id -> Feldschlüssel, die exakt (einfach) gespeichert sind */
  const exact = new Map<string, Set<string>>();

  for (const m of rows ?? []) {
    if (excludeMeasurementId && m.id === excludeMeasurementId) continue;
    if (sampleId && m.sample_id && m.sample_id !== sampleId) continue;
    for (const r of m.measurement_results ?? []) {
      const name = String(r.result_name ?? "");
      if (!name.startsWith("form:")) continue;
      const rest = name.slice("form:".length);
      const idx = rest.indexOf(":");
      if (idx <= 0) continue;
      const formId = rest.slice(0, idx);
      const storedKey = rest.slice(idx + 1);
      const value = r.value != null ? r.value : r.remarks;
      if (value == null || value === "") continue;

      // Unveränderte bisherige Ablage: exakter Schlüssel.
      (out[formId] ??= {})[storedKey] = value;

      const inst = parseInstanceResultKey(storedKey);
      if (!inst) {
        (exact.get(formId) ?? exact.set(formId, new Set()).get(formId)!).add(storedKey);
        continue;
      }

      const byField = aliases.get(formId) ?? aliases.set(formId, new Map()).get(formId)!;
      const candidate: AliasCandidate = {
        value,
        official: r.is_official === true,
        time: timeValue(r.measured_at, m.updated_at),
      };
      const prev = byField.get(inst.fieldKey);
      const better =
        !prev ||
        (candidate.official && !prev.official) ||
        (candidate.official === prev.official && candidate.time >= prev.time);
      if (better) byField.set(inst.fieldKey, candidate);
    }
  }

  // Zusätzlicher, reiner Feldschlüssel – niemals über einen exakt
  // gespeicherten Wert hinweg.
  for (const [formId, byField] of aliases) {
    const target = (out[formId] ??= {});
    const exactKeys = exact.get(formId);
    for (const [fieldKey, candidate] of byField) {
      if (exactKeys?.has(fieldKey)) continue;
      if (target[fieldKey] != null && target[fieldKey] !== "") continue;
      target[fieldKey] = candidate.value;
    }
  }

  return out;
}
