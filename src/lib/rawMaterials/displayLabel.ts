/**
 * Reine Anzeige-Auflösung für Rohstoff-Referenzen: „Rohstoffcode – Rohstoffname“.
 * Ändert nie den gespeicherten Wert; die interne ID bleibt technischer Schlüssel.
 */
export interface RawMaterialLookup {
  id: string;
  material_name?: string | null;
  material_number?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const looksLikeId = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s.trim());

export const formatCodeName = (code?: string | null, name?: string | null): string => {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  if (c && n) return `${c} – ${n}`;
  return c || n;
};

export interface RawMaterialDisplay {
  label: string;
  /** true, wenn eine ID nicht mehr im Rohstoffstamm aufgelöst werden konnte */
  unresolved: boolean;
}

/**
 * @param id      gespeicherte Rohstoff-ID (falls vorhanden)
 * @param name    gespeicherter Name (Snapshot)
 * @param code    gespeicherter Code (Snapshot)
 */
export function resolveRawMaterialDisplay(
  input: { id?: string | null; name?: string | null; code?: string | null },
  byId: Map<string, RawMaterialLookup>,
): RawMaterialDisplay | null {
  // Ein reiner ID-String im Namensfeld wird als ID behandelt.
  let id = input.id ?? null;
  let name = input.name ?? null;
  if (!id && looksLikeId(name)) { id = name!.trim(); name = null; }
  if (looksLikeId(name)) name = null;

  if (id) {
    const m = byId.get(id);
    if (m) {
      const label = formatCodeName(m.material_number, m.material_name);
      if (label) return { label, unresolved: false };
    }
    const snap = formatCodeName(input.code, name);
    if (snap) return { label: snap, unresolved: !m };
    return { label: `Rohstoff nicht im Stamm (ID ${id.slice(0, 8)}…)`, unresolved: true };
  }
  const label = formatCodeName(input.code, name);
  return label ? { label, unresolved: false } : null;
}
