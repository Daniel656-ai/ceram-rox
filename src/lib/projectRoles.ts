/** Mehrfachrollen pro Person und Projekt (z. B. owner + leader). */
export type ProjectRole = "owner" | "leader" | "member";
const ORDER: ProjectRole[] = ["owner", "leader", "member"];

export function rolesOfUser(members: { user_id: string; role: string }[], userId?: string | null): ProjectRole[] {
  if (!userId) return [];
  const set = new Set(members.filter((m) => m.user_id === userId).map((m) => m.role));
  return ORDER.filter((r) => set.has(r));
}

/** Höchstwertige Rolle (owner > leader > member) oder null. */
export function primaryRole(roles: string[]): ProjectRole | null {
  return ORDER.find((r) => roles.includes(r)) ?? null;
}

export function isLeaderOrOwner(roles: string[]): boolean {
  return roles.includes("owner") || roles.includes("leader");
}

/** Personen, die die gewählte Rolle im Projekt bereits haben – nur diese werden ausgeschlossen. */
export function excludedForRole(members: { user_id: string; role: string }[], role: string): string[] {
  return members.filter((m) => m.role === role).map((m) => m.user_id);
}
