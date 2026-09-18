/**
 * Zentrale Suchlogik für Rohstoffe.
 *
 * Fachliche Struktur bleibt unverändert: Rohstoff → LOT → MRS-Nummer.
 * Die MRS-Nummer ist LOT-bezogen (`raw_material_batches.mrs_number`) und wird
 * hier nur zusätzlich für die Suche am übergeordneten Rohstoff sichtbar gemacht.
 * Es werden keine Daten verändert und keine Felder neu angelegt.
 */

export interface SearchableBatch {
  batch_number?: string | null;
  mrs_number?: string | null;
}

export interface SearchableRawMaterial {
  material_name?: string | null;
  material_number?: string | null;
  other_designation?: string | null;
  cas_number?: string | null;
  eg_number?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  description?: string | null;
  /** Altbestand: MRS am Rohstoff (wird weiter mitdurchsucht, aber nicht mehr gepflegt). */
  mrs_number?: string | null;
  raw_material_batches?: SearchableBatch[] | null;
}

/** Alle durchsuchbaren Texte eines Rohstoffs inkl. seiner LOTs (LOT-Nummer + MRS-Nummer). */
export function rawMaterialSearchHaystack(m: SearchableRawMaterial | null | undefined): string {
  if (!m) return "";
  const parts: Array<unknown> = [
    m.material_name,
    m.material_number,
    m.other_designation,
    m.cas_number,
    m.eg_number,
    m.manufacturer,
    m.supplier,
    m.description,
    m.mrs_number,
  ];
  for (const b of m.raw_material_batches ?? []) {
    parts.push(b?.batch_number, b?.mrs_number);
  }
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== "")
    .join(" ")
    .toLowerCase();
}

/** Teilstring-Suche (case-insensitive) über Rohstoff- und LOT-Daten. */
export function matchesRawMaterialSearch(
  m: SearchableRawMaterial | null | undefined,
  query: string | null | undefined
): boolean {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  return rawMaterialSearchHaystack(m).includes(q);
}

/** LOTs eines Rohstoffs, die zum Suchbegriff passen (LOT-Nummer oder MRS-Nummer). */
export function matchingBatches(
  m: SearchableRawMaterial | null | undefined,
  query: string | null | undefined
): SearchableBatch[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q || !m?.raw_material_batches) return [];
  return m.raw_material_batches.filter(
    (b) =>
      (b?.batch_number ?? "").toLowerCase().includes(q) ||
      (b?.mrs_number ?? "").toLowerCase().includes(q)
  );
}
