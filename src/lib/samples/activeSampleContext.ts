/**
 * Eindeutiger Probenkontext für Aufgabenbearbeitung und Messdatenimport.
 *
 * Maßgeblich ist ausschließlich die stabile Proben-ID der jeweiligen
 * Dienstleistung (order_measurements.sample_id) – nie der Name, die Position
 * eines Tabs oder die erste Probe des Auftrags. Kann die Probe nicht eindeutig
 * bestimmt werden, bleibt der Kontext erkennbar „nicht aufgelöst“; es wird
 * keine andere Probe still eingesetzt.
 *
 * Hinweis: Diese Prüfungen laufen im Frontend. Sie ersetzen keine
 * serverseitige Absicherung.
 */

export interface TaskSampleInfo {
  id: string;
  sampleNumber: string | null;
  sampleName: string | null;
}

export type ResolvedTaskSample =
  | ({ status: "resolved" } & TaskSampleInfo)
  | { status: "unresolved"; reason: "missing" | "mismatch" };

/** Probe einer Dienstleistung aus `api.measurements.get` (Top-Level-Relation). */
export function resolveTaskSample(measurement: unknown): ResolvedTaskSample {
  const m = (measurement ?? {}) as {
    sample_id?: string | null;
    samples?: { id?: string | null; sample_number?: string | null; sample_name?: string | null } | null;
  };
  const id = m.sample_id ?? null;
  if (!id) return { status: "unresolved", reason: "missing" };
  const rel = m.samples ?? null;
  if (!rel || rel.id !== id) return { status: "unresolved", reason: "mismatch" };
  return {
    status: "resolved",
    id,
    sampleNumber: rel.sample_number ?? null,
    sampleName: rel.sample_name ?? null,
  };
}

/**
 * Probe auf Auftragsebene: nur wenn der Auftrag genau eine Probe hat.
 * Bei mehreren Proben bleibt sie unaufgelöst (null).
 */
export function resolveOrderLevelSampleId(order: unknown): string | null {
  const o = (order ?? {}) as {
    sample_id?: string | null;
    sample_ids?: Array<string | null> | null;
    samples?: { id?: string | null } | null;
    order_samples?: Array<{ sample_id?: string | null }> | null;
    order_measurements?: Array<{ sample_id?: string | null }> | null;
  };
  const ids = new Set<string>();
  for (const id of o.sample_ids ?? []) if (id) ids.add(id);
  for (const r of o.order_samples ?? []) if (r?.sample_id) ids.add(r.sample_id);
  for (const r of o.order_measurements ?? []) if (r?.sample_id) ids.add(r.sample_id);
  const own = o.samples?.id ?? o.sample_id ?? null;
  if (own) ids.add(own);
  return ids.size === 1 ? [...ids][0] : null;
}

// ---------------------------------------------------------------------------
// Aktive Dienstleistung (für Abbruch bei Wechsel während eines Imports)
// ---------------------------------------------------------------------------

export interface ActiveTaskContext {
  orderMeasurementId: string;
  sampleId: string | null;
}

let active: ActiveTaskContext | null = null;

export function setActiveTaskContext(ctx: ActiveTaskContext): void {
  active = { ...ctx };
}

/** Entfernt den aktiven Kontext nur, wenn er noch zu dieser Dienstleistung gehört. */
export function clearActiveTaskContext(orderMeasurementId: string): void {
  if (active?.orderMeasurementId === orderMeasurementId) active = null;
}

export function getActiveTaskContext(): ActiveTaskContext | null {
  return active ? { ...active } : null;
}

export interface ImportSnapshot {
  orderMeasurementId: string;
  sampleId: string | null;
}

/** ok=false immer mit verständlicher Meldung; ok=true mit leerer Meldung. */
export interface ContextCheck {
  ok: boolean;
  message: string;
}

const OK: ContextCheck = { ok: true, message: "" };

/**
 * Vor dem Speichern: Die beim Importstart festgehaltene Dienstleistung/Probe
 * muss eindeutig und noch aktiv sein.
 */
export function verifyImportContext(
  snapshot: ImportSnapshot | null,
  current: ActiveTaskContext | null,
): ContextCheck {
  if (!snapshot?.orderMeasurementId) {
    return { ok: false, message: "Import abgebrochen: keine Dienstleistung zugeordnet." };
  }
  if (!snapshot.sampleId) {
    return {
      ok: false,
      message: "Import abgebrochen: Die Probe dieser Dienstleistung ist nicht eindeutig bestimmt.",
    };
  }
  if (!current || current.orderMeasurementId !== snapshot.orderMeasurementId) {
    return {
      ok: false,
      message: "Import abgebrochen: Die aktive Dienstleistung wurde während des Imports gewechselt.",
    };
  }
  if (current.sampleId !== snapshot.sampleId) {
    return {
      ok: false,
      message: "Import abgebrochen: Die Probe der aktiven Dienstleistung stimmt nicht mit dem Import überein.",
    };
  }
  return OK;
}

// ---------------------------------------------------------------------------
// Probennummer in Dateiinhalten (Format PJJNNNN, optional mit Suffix)
// ---------------------------------------------------------------------------

const SAMPLE_NO = /(?<![A-Za-z0-9])P\d{6}(?:-\d+)?(?![A-Za-z0-9])/gi;
/** Probennummer mit nicht-numerischem Zusatz (z. B. P260712-B, P260712_X). */
const SAMPLE_NO_INVALID_SUFFIX = /(?<![A-Za-z0-9])P\d{6}(?:-\d*[A-Za-z_][A-Za-z0-9_]*|_[A-Za-z0-9_]+)(?![A-Za-z0-9])/gi;

export interface SampleIdentifier {
  /** ROX-Stammprobennummer PJJNNNN (Großschreibung). */
  base: string;
  /** Numerischer Versuchszusatz inkl. Bindestrich, z. B. "-2897". */
  suffix: string | null;
  /** Originale Gerätebezeichnung (getrimmt, Großschreibung). */
  raw: string;
}

/**
 * Zerlegt eine Probenbezeichnung in Stammprobennummer und optionalen
 * numerischen Zusatz. Nur "-<Ziffern>" wird toleriert; alles andere → null.
 */
export function parseSampleIdentifier(raw: string | null | undefined): SampleIdentifier | null {
  const trimmed = String(raw ?? "").trim().toUpperCase();
  const m = trimmed.match(/^(P\d{6})(?:-(\d+))?$/);
  if (!m) return null;
  return { base: m[1], suffix: m[2] ? `-${m[2]}` : null, raw: trimmed };
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (value == null || depth > 6) return;
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number") return;
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out, depth + 1));
  else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(k);
      collectStrings(v, out, depth + 1);
    }
  }
}

/** Eindeutige Probennummern (Großschreibung) aus beliebigen Dateiinhalten. */
export function extractSampleNumbers(sources: unknown[]): string[] {
  const texts: string[] = [];
  sources.forEach((s) => collectStrings(s, texts));
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(SAMPLE_NO)) found.add(m[0].toUpperCase());
  return [...found];
}

/**
 * Enthält die Datei eine Probennummer, muss sie eindeutig der ausgewählten
 * Probe entsprechen. Ohne Probennummer in der Datei ist keine Aussage
 * möglich – dann entscheidet allein der Dienstleistungskontext.
 */
export function verifyFileSampleNumber(
  sources: unknown[],
  expectedSampleNumber: string | null | undefined,
): ContextCheck {
  const texts: string[] = [];
  sources.forEach((s) => collectStrings(s, texts));
  const invalid = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(SAMPLE_NO_INVALID_SUFFIX)) invalid.add(m[0].toUpperCase());
  if (invalid.size > 0) {
    return {
      ok: false,
      message: `Import abgebrochen: Unzulässiger Zusatz an der Probennummer (${[...invalid].join(", ")}).`,
    };
  }
  const found = extractSampleNumbers(sources);
  if (found.length === 0) return OK;
  // Mehrere Schreibweisen derselben Stammprobe (P260712, P260712-2897) sind kein Konflikt.
  const bases = new Map<string, string[]>();
  for (const f of found) {
    const id = parseSampleIdentifier(f);
    if (!id) continue;
    bases.set(id.base, [...(bases.get(id.base) ?? []), id.raw]);
  }
  if (bases.size > 1) {
    return {
      ok: false,
      message: `Import abgebrochen: Die Datei enthält mehrere Probennummern (${found.join(", ")}).`,
    };
  }
  const [base, raws] = [...bases.entries()][0];
  const expected = (expectedSampleNumber ?? "").trim().toUpperCase();
  if (!expected) {
    return {
      ok: false,
      message: "Import abgebrochen: Die Probennummer der Dienstleistung ist unbekannt.",
    };
  }
  const expectedBase = parseSampleIdentifier(expected)?.base ?? expected;
  if (base !== expectedBase) {
    return {
      ok: false,
      message: `Import abgebrochen: Die Datei gehört zu Probe ${raws.join(", ")}, ausgewählt ist ${expected}.`,
    };
  }
  return OK;
}
