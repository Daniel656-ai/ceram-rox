/**
 * Persönliche Anzeigefilter für „Meine Aufgaben“ (rein clientseitig, keine Berechtigungswirkung).
 * Die Übernahme bleibt serverseitig an claim_measurement gebunden.
 */
export interface TaskFilterState {
  serviceIds: string[];
  onlyCompetent: boolean;
}

export const DEFAULT_TASK_FILTER: TaskFilterState = { serviceIds: [], onlyCompetent: false };

export const taskFilterStorageKey = (userId: string) => `rox.myTasks.${userId}.filterState`;

/** Defensives Parsen; ungültige Inhalte ergeben den Standard. */
export function parseTaskFilterState(raw: string | null | undefined): TaskFilterState {
  if (!raw) return { ...DEFAULT_TASK_FILTER };
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return { ...DEFAULT_TASK_FILTER };
    const serviceIds: string[] = Array.isArray(v.serviceIds)
      ? Array.from(new Set<string>((v.serviceIds as unknown[]).filter((x: unknown): x is string => typeof x === "string" && x.length > 0)))
      : [];
    return { serviceIds, onlyCompetent: v.onlyCompetent === true };
  } catch {
    return { ...DEFAULT_TASK_FILTER };
  }
}

export function loadTaskFilterState(userId: string | null | undefined): TaskFilterState {
  if (!userId) return { ...DEFAULT_TASK_FILTER };
  try {
    return parseTaskFilterState(localStorage.getItem(taskFilterStorageKey(userId)));
  } catch {
    return { ...DEFAULT_TASK_FILTER };
  }
}

export function saveTaskFilterState(userId: string | null | undefined, state: TaskFilterState): void {
  if (!userId) return;
  try {
    localStorage.setItem(taskFilterStorageKey(userId), JSON.stringify(state));
  } catch {
    /* Speicherfehler dürfen die Ansicht nicht blockieren */
  }
}

/** Entfernt nicht (mehr) vorhandene Dienstleistungs-IDs; solange Dienstleistungen laden, unverändert. */
export function effectiveServiceIds(selected: string[], knownServiceIds: string[] | null): string[] {
  if (!knownServiceIds) return selected;
  const known = new Set(knownServiceIds);
  return selected.filter((id) => known.has(id));
}

export type CompetenceState =
  | { status: "ready"; isMaster: boolean; serviceIds: string[] }
  | { status: "loading" }
  | { status: "error" };

export function isTaskFilterActive(state: TaskFilterState, effectiveIds: string[]): boolean {
  return effectiveIds.length > 0 || state.onlyCompetent;
}

/**
 * Dienstleistungsfilter (ODER) UND Kompetenzfilter.
 * Kompetenz unbekannt (lädt/fehlerhaft) bei aktivem Filter → nichts gilt als qualifiziert.
 */
export function buildTaskServicePredicate(
  effectiveIds: string[],
  onlyCompetent: boolean,
  competence: CompetenceState,
): (serviceId: string | null | undefined) => boolean {
  const selected = new Set(effectiveIds);
  const qualified = competence.status === "ready" ? new Set(competence.serviceIds) : null;
  return (serviceId) => {
    if (selected.size > 0 && (!serviceId || !selected.has(serviceId))) return false;
    if (onlyCompetent) {
      if (competence.status !== "ready") return false;
      if (competence.isMaster) return true;
      if (!serviceId || !qualified!.has(serviceId)) return false;
    }
    return true;
  };
}
