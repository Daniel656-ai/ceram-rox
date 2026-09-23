/**
 * Abschnitte (Teilprozessschritte) innerhalb einer Rezeptur / Rohstoffliste.
 *
 * Der gespeicherte Feldwert bleibt eine flache Liste. Neben den bestehenden
 * Rohstoffzeilen ist zusätzlich ein Abschnittseintrag `{ kind: "section" }`
 * erlaubt, der den Beginn eines neuen Teilprozessschritts markiert und dessen
 * Zugabezeit trägt. Bestehende Werte ohne Abschnitte bleiben unverändert
 * lesbar – sie ergeben genau einen impliziten Abschnitt.
 */

export interface RecipeMaterialRow {
  raw_material_id: string;
  quantity: number | string;
  unit: string;
  note?: string;
  kind?: undefined;
}

export interface RecipeSectionMarker {
  kind: "section";
  /** Freie Bezeichnung; leer = automatische Nummerierung „Teilprozessschritt N“. */
  label?: string;
  /** Zugabezeit in Minuten ab Prozessstart. */
  offset_minutes?: number | string | null;
}

export type RecipeEntry = RecipeMaterialRow | RecipeSectionMarker;

export interface RecipeSection {
  /** Index des Abschnittseintrags in der flachen Liste, -1 beim impliziten ersten Abschnitt. */
  markerIndex: number;
  label?: string;
  offset_minutes?: number | string | null;
  /** Rohstoffzeilen mit ihrem Index in der flachen Liste. */
  rows: Array<{ index: number; row: RecipeMaterialRow }>;
}

export function isSectionEntry(e: unknown): e is RecipeSectionMarker {
  return !!e && typeof e === "object" && (e as any).kind === "section";
}

/** Gruppiert die flache Liste in Abschnitte; Reihenfolge bleibt erhalten. */
export function groupRecipeSections(entries: RecipeEntry[] | undefined): RecipeSection[] {
  const list = Array.isArray(entries) ? entries : [];
  const sections: RecipeSection[] = [{ markerIndex: -1, rows: [] }];
  list.forEach((e, index) => {
    if (isSectionEntry(e)) {
      sections.push({ markerIndex: index, label: e.label, offset_minutes: e.offset_minutes ?? null, rows: [] });
    } else {
      sections[sections.length - 1].rows.push({ index, row: e as RecipeMaterialRow });
    }
  });
  // Impliziten ersten Abschnitt nur behalten, wenn er Zeilen enthält oder es der einzige ist.
  if (sections.length > 1 && sections[0].rows.length === 0) sections.shift();
  return sections;
}

/** Enthält der Wert mindestens einen ausdrücklichen Abschnittswechsel? */
export function hasSections(entries: RecipeEntry[] | undefined): boolean {
  return (Array.isArray(entries) ? entries : []).some(isSectionEntry);
}

/** Hängt einen neuen Abschnittswechsel ans Ende der Liste an. */
export function appendSection(entries: RecipeEntry[] | undefined, offsetMinutes: number | string | null = ""): RecipeEntry[] {
  const list = Array.isArray(entries) ? [...entries] : [];
  list.push({ kind: "section", offset_minutes: offsetMinutes });
  return list;
}

/** Fügt eine neue Rohstoffzeile am Ende des Abschnitts `sectionIdx` ein. */
export function appendRowToSection(entries: RecipeEntry[] | undefined, sectionIdx: number): RecipeEntry[] {
  const list = Array.isArray(entries) ? [...entries] : [];
  const sections = groupRecipeSections(list);
  const section = sections[sectionIdx];
  const empty: RecipeMaterialRow = { raw_material_id: "", quantity: "", unit: "", note: "" };
  if (!section) {
    list.push(empty);
    return list;
  }
  const insertAt = section.rows.length > 0
    ? section.rows[section.rows.length - 1].index + 1
    : section.markerIndex + 1;
  list.splice(insertAt, 0, empty);
  return list;
}

/**
 * Entfernt den Abschnittswechsel an `markerIndex`; dessen Rohstoffzeilen
 * bleiben erhalten und gehören danach zum vorangehenden Abschnitt.
 */
export function removeSectionMarker(entries: RecipeEntry[] | undefined, markerIndex: number): RecipeEntry[] {
  const list = Array.isArray(entries) ? [...entries] : [];
  if (markerIndex < 0 || !isSectionEntry(list[markerIndex])) return list;
  list.splice(markerIndex, 1);
  return list;
}

/** Aktualisiert einen Abschnittseintrag (Bezeichnung / Zugabezeit). */
export function updateSectionMarker(
  entries: RecipeEntry[] | undefined,
  markerIndex: number,
  patch: Partial<RecipeSectionMarker>
): RecipeEntry[] {
  const list = Array.isArray(entries) ? [...entries] : [];
  const current = list[markerIndex];
  if (!isSectionEntry(current)) return list;
  list[markerIndex] = { ...current, ...patch, kind: "section" };
  return list;
}

/** Anzeigename eines Abschnitts. */
export function sectionTitle(section: RecipeSection, position: number): string {
  return section.label?.trim() || `Teilprozessschritt ${position + 1}`;
}
