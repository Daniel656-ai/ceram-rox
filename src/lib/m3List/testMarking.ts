/**
 * TEST-Kennzeichnung der m³-Liste – reine Arbeitsanweisung.
 * Keine Chargenermittlung. Berechtigung hier NUR in der Oberfläche
 * (keine serverseitige Absicherung, keine revisionssichere Speicherung).
 *
 * Zuordnung: Die gekennzeichnete m³-Zeile erhält beim Markieren eine stabile
 * Zeilen-ID (`__m3_row_id`) in den vorhandenen Formularwerten. Die
 * Kennzeichnung verweist auf diese ID – nicht auf die Position. Sortieren,
 * Löschen oder Verschieben anderer Zeilen ändert die Zuordnung daher nicht.
 * Hinweis: Dies identifiziert die m³-Zeile (Charge), kein einzelnes Element.
 */
export const TEST_MARKING_ROLES = ["Administrator", "Messdienstleister", "Teamleiter", "PMO"] as const;
/** Altwert (Position) – nur noch lesend, wird nicht mehr geschrieben. */
export const TEST_MARKING_KEY = "test_charge_row_index";
export const TEST_MARKING_ROW_ID_KEY = "test_charge_row_id";
/** Mehrfachauswahl: stabile Zeilen-IDs aller gekennzeichneten m³-Zeilen. */
export const TEST_MARKING_ROW_IDS_KEY = "test_charge_row_ids";
export const M3_ROW_ID_FIELD = "__m3_row_id";

const norm = (s: string) => s.trim().toLowerCase();

export function canUseTestMarking(customRoleNames: string[]): boolean {
  const allowed = TEST_MARKING_ROLES.map(norm);
  return customRoleNames.some((n) => allowed.includes(norm(n)));
}

export function readTestMarkingIndex(stored: Record<string, unknown>): number | null {
  const v = stored[TEST_MARKING_KEY];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

export type TestMarkingStatus = "none" | "ok" | "legacy_index" | "missing" | "ambiguous";

export interface TestMarkingResolution {
  rowIndex: number | null;
  status: TestMarkingStatus;
}

/** Ermittelt die gekennzeichnete Zeile ausschließlich über die stabile Zeilen-ID. */
export function resolveTestMarking(
  stored: Record<string, unknown>,
  rows: Record<string, unknown>[]
): TestMarkingResolution {
  const id = stored[TEST_MARKING_ROW_ID_KEY];
  if (typeof id === "string" && id) {
    const hits = rows.map((r, i) => (r?.[M3_ROW_ID_FIELD] === id ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 1) return { rowIndex: hits[0], status: "ok" };
    // Mehrfach (z. B. durch Duplizieren einer Zeile) → nicht raten.
    return { rowIndex: null, status: hits.length > 1 ? "ambiguous" : "missing" };
  }
  // Alte, positionsbasierte Kennzeichnung wird bewusst NICHT einer Zeile
  // zugeordnet – die Position kann sich seit dem Speichern geändert haben.
  if (readTestMarkingIndex(stored) != null) return { rowIndex: null, status: "legacy_index" };
  return { rowIndex: null, status: "none" };
}

/**
 * Setzt oder entfernt die Kennzeichnung. Vergibt der Zeile bei Bedarf eine
 * stabile ID; vorhandene IDs werden nie überschrieben (außer bei Duplikaten).
 */
export function applyTestMarking(
  stored: Record<string, unknown>,
  rowsKey: string,
  rowIndex: number | null,
  newId: () => string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...stored };
  delete next[TEST_MARKING_KEY];
  if (rowIndex == null) {
    next[TEST_MARKING_ROW_ID_KEY] = null;
    return next;
  }
  const rows = Array.isArray(stored[rowsKey]) ? [...(stored[rowsKey] as Record<string, unknown>[])] : [];
  if (rowIndex < 0 || rowIndex >= rows.length) return stored;
  const row = { ...(rows[rowIndex] ?? {}) };
  let id = typeof row[M3_ROW_ID_FIELD] === "string" ? (row[M3_ROW_ID_FIELD] as string) : "";
  const duplicate = id && rows.some((r, i) => i !== rowIndex && r?.[M3_ROW_ID_FIELD] === id);
  if (!id || duplicate) {
    id = newId();
    row[M3_ROW_ID_FIELD] = id;
    rows[rowIndex] = row;
    next[rowsKey] = rows;
  }
  next[TEST_MARKING_ROW_ID_KEY] = id;
  return next;
}

/**
 * Liest die gekennzeichneten Zeilen-IDs. Abwärtskompatibel: Fehlt das Array,
 * gilt die bisherige Einzel-ID als einelementige Auswahl. Ungültige Einträge
 * (keine nicht-leeren Strings) werden verworfen, Duplikate entfernt.
 */
export function readTestMarkingRowIds(stored: Record<string, unknown>): string[] {
  const raw = stored[TEST_MARKING_ROW_IDS_KEY];
  if (Array.isArray(raw)) {
    return [...new Set(raw.filter((v): v is string => typeof v === "string" && v.length > 0))];
  }
  const single = stored[TEST_MARKING_ROW_ID_KEY];
  return typeof single === "string" && single ? [single] : [];
}

export interface TestMarkingRowsResolution {
  /** Aufgelöste Zeilenpositionen (aufsteigend, ohne Duplikate). */
  rowIndices: number[];
  status: TestMarkingStatus;
}

/**
 * Ermittelt alle gekennzeichneten Zeilen ausschließlich über stabile Zeilen-IDs.
 * Nicht mehr vorhandene IDs werden ignoriert; gar keine Auflösung trotz
 * gespeicherter IDs gilt als „missing", eine mehrdeutige ID als „ambiguous".
 */
export function resolveTestMarkingRows(
  stored: Record<string, unknown>,
  rows: Record<string, unknown>[]
): TestMarkingRowsResolution {
  const ids = readTestMarkingRowIds(stored);
  if (ids.length) {
    const indices = new Set<number>();
    let ambiguous = false;
    for (const id of ids) {
      const hits = rows.map((r, i) => (r?.[M3_ROW_ID_FIELD] === id ? i : -1)).filter((i) => i >= 0);
      if (hits.length > 1) ambiguous = true;
      else if (hits.length === 1) indices.add(hits[0]);
    }
    if (ambiguous) return { rowIndices: [], status: "ambiguous" };
    if (!indices.size) return { rowIndices: [], status: "missing" };
    return { rowIndices: [...indices].sort((a, b) => a - b), status: "ok" };
  }
  if (readTestMarkingIndex(stored) != null) return { rowIndices: [], status: "legacy_index" };
  return { rowIndices: [], status: "none" };
}

/**
 * Markiert oder entmarkiert genau eine Zeile unabhängig von den übrigen.
 * Vergibt der Zeile bei Bedarf eine stabile ID; vorhandene IDs werden nie
 * überschrieben (außer bei Duplikaten). Der Altschlüssel
 * `test_charge_row_id` bleibt synchron zur ersten ausgewählten ID.
 */
export function toggleTestMarkingRow(
  stored: Record<string, unknown>,
  rowsKey: string,
  rowIndex: number,
  checked: boolean,
  newId: () => string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...stored };
  delete next[TEST_MARKING_KEY];
  const rows = Array.isArray(stored[rowsKey]) ? [...(stored[rowsKey] as Record<string, unknown>[])] : [];
  if (rowIndex < 0 || rowIndex >= rows.length) return stored;

  let ids = readTestMarkingRowIds(stored);
  if (checked) {
    const row = { ...(rows[rowIndex] ?? {}) };
    let id = typeof row[M3_ROW_ID_FIELD] === "string" ? (row[M3_ROW_ID_FIELD] as string) : "";
    const duplicate = id && rows.some((r, i) => i !== rowIndex && r?.[M3_ROW_ID_FIELD] === id);
    if (!id || duplicate) {
      id = newId();
      row[M3_ROW_ID_FIELD] = id;
      rows[rowIndex] = row;
      next[rowsKey] = rows;
    }
    if (!ids.includes(id)) ids = [...ids, id];
  } else {
    const rowId = rows[rowIndex]?.[M3_ROW_ID_FIELD];
    ids = typeof rowId === "string" ? ids.filter((v) => v !== rowId) : ids.filter((_, i) => i !== ids.indexOf(String(rowId)));
  }
  next[TEST_MARKING_ROW_IDS_KEY] = ids;
  next[TEST_MARKING_ROW_ID_KEY] = ids[0] ?? null;
  return next;
}

/**
 * Dynamischer Hinweistext für eine oder mehrere gekennzeichnete Zeilen.
 * Erwartet 0-basierte Zeilenpositionen; die Anzeige zählt ab 1.
 */
export function buildTestNotice(rowIndices: number[]): string | null {
  const nums = [...new Set(rowIndices.filter((i) => i >= 0))].sort((a, b) => a - b).map((i) => i + 1);
  if (!nums.length) return null;
  const list = nums.length === 1 ? String(nums[0]) : `${nums.slice(0, -1).join(", ")} und ${nums[nums.length - 1]}`;
  return nums.length === 1
    ? `TEST: Bitte die komplette Charge der m³-Zeile ${list} mit einem zusätzlichen Stempel ‚TEST …‘ versehen!`
    : `TEST: Bitte die kompletten Chargen der m³-Zeilen ${list} mit einem zusätzlichen Stempel ‚TEST …‘ versehen!`;
}
