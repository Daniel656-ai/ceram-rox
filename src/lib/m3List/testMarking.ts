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
