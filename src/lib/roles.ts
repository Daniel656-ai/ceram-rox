/**
 * Mehrfachrollen: Ein Benutzer kann mehrere bestehende Rollen gleichzeitig
 * besitzen. Es entsteht KEINE kombinierte Rolle – die vorhandenen Rollen
 * bleiben eigenständig und unabhängig voneinander zuweisbar.
 *
 * Für bestehende Prüfungen, die weiterhin mit genau einer Basisrolle
 * arbeiten, wird die Rolle mit dem größten Funktionsumfang als
 * "primäre" Rolle verwendet. Dadurch verhält sich ein Benutzer mit nur
 * einer Rolle exakt wie bisher, und bei mehreren Rollen überschreibt
 * keine Rolle die andere – der Benutzer erhält die Summe.
 */
export type BaseRole = "master" | "durchfuehrer" | "auftraggeber";

const PRECEDENCE: BaseRole[] = ["master", "durchfuehrer", "auftraggeber"];

export function primaryRole(roles: readonly string[]): BaseRole | null {
  for (const r of PRECEDENCE) if (roles.includes(r)) return r;
  return null;
}

/** Eindeutige Basisrollen in stabiler Reihenfolge. */
export function normalizeRoles(roles: readonly (string | null | undefined)[]): BaseRole[] {
  const set = new Set(roles.filter(Boolean) as string[]);
  return PRECEDENCE.filter((r) => set.has(r));
}

/** Vereinigung der Berechtigungen mehrerer Rollen – ohne Duplikate. */
export function mergePermissions(lists: readonly (readonly string[])[]): string[] {
  return Array.from(new Set(lists.flat()));
}
