/**
 * TEST-Kennzeichnung der m³-Liste – reine Arbeitsanweisung.
 * Keine Chargenermittlung. Berechtigung hier NUR in der Oberfläche
 * (keine serverseitige Absicherung, keine revisionssichere Speicherung).
 */
export const TEST_MARKING_ROLES = ["Administrator", "Messdienstleister", "Teamleiter", "PMO"] as const;
export const TEST_MARKING_KEY = "test_charge_row_index";

const norm = (s: string) => s.trim().toLowerCase();

export function canUseTestMarking(customRoleNames: string[]): boolean {
  const allowed = TEST_MARKING_ROLES.map(norm);
  return customRoleNames.some((n) => allowed.includes(norm(n)));
}

export function readTestMarkingIndex(stored: Record<string, unknown>): number | null {
  const v = stored[TEST_MARKING_KEY];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}
