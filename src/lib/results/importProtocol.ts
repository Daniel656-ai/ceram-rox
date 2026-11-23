/**
 * Importprotokoll des Messdatenimports (JSON mit `imported_at`) – nur Lesen/Anzeigen.
 */

export interface ImportProtocol {
  importedAt: string | null;
  profile: string | null;
  sample: string | null;
  source: string | null;
  count: number | null;
  hasCurves: boolean;
  rawDatasetId: string | null;
  assignedKeys: string[];
  unassignedCount: number;
  metadata: Array<{ label: string; value: string }>;
  /** Einheiten je Zielfeld (Feldschlüssel -> Einheit). */
  units: Record<string, string | null>;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Liest ein Importprotokoll tolerant (fehlende Felder sind erlaubt). */
export function parseImportProtocol(remarks: string | null | undefined): ImportProtocol | null {
  if (typeof remarks !== "string") return null;
  const t = remarks.trim();
  if (!t.startsWith("{")) return null;
  let p: unknown;
  try {
    p = JSON.parse(t);
  } catch {
    return null;
  }
  if (!isPlainObject(p) || typeof p.imported_at !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const metadata = Array.isArray(p.metadata)
    ? p.metadata
        .filter(isPlainObject)
        .map((m) => ({ label: String(m.label ?? ""), value: String(m.value ?? "") }))
        .filter((m) => m.label || m.value)
    : [];
  const units: Record<string, string | null> = {};
  if (isPlainObject(p.units)) {
    for (const [k, u] of Object.entries(p.units)) units[k] = typeof u === "string" && u.trim() ? u : null;
  }
  return {
    importedAt: str(p.imported_at),
    profile: str(p.profile),
    sample: str(p.sample),
    source: str(p.source),
    count: typeof p.count === "number" ? p.count : null,
    hasCurves: p.has_curves === true,
    rawDatasetId: str(p.raw_dataset_id),
    assignedKeys: Array.isArray(p.keys) ? p.keys.map(String) : [],
    unassignedCount: Array.isArray(p.unassigned) ? p.unassigned.length : 0,
    metadata,
    units,
  };
}
