/**
 * „Durchlauf verlassen": gibt eigene, nicht abgeschlossene Aufgaben frei.
 * Löscht/ändert niemals Ergebnisse oder Status — nur Freigabe über `release`,
 * die serverseitig erneut prüft (Konkurrenzfälle).
 */
export interface RunState { id: string; status: string; assigned_to: string | null }

export function selectReleasable(states: RunState[], userId: string): string[] {
  return states
    .filter((s) => s.status !== "completed" && s.assigned_to === userId)
    .map((s) => s.id);
}

export async function releaseRun(opts: {
  runIds: string[];
  userId: string;
  loadState: (ids: string[]) => Promise<RunState[]>;
  release: (id: string) => Promise<boolean>;
}): Promise<{ released: string[]; skipped: string[]; failed: string[] }> {
  const states = await opts.loadState(opts.runIds);
  const candidates = selectReleasable(states, opts.userId);
  const released: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  for (const id of candidates) {
    try {
      if (await opts.release(id)) released.push(id);
      else skipped.push(id); // zwischenzeitlich abgeschlossen/umgewiesen/freigegeben
    } catch {
      failed.push(id); // erfolgreiche Freigaben bleiben bestehen
    }
  }
  return { released, skipped, failed };
}
