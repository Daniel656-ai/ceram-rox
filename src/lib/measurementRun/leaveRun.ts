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

// ---- Einheitlicher Verlassen-Dialog (Zurück-Button + „Durchlauf verlassen") ----

/** Ziel nach dem Verlassen: vorherige Seite, sonst (Direktaufruf) /auftraege. */
export function leaveDestination(historyIdx: unknown): -1 | "/auftraege" {
  return typeof historyIdx === "number" && historyIdx > 0 ? -1 : "/auftraege";
}

/** Umfang für den Dialogtext: Anzahl + Bezeichnung bei genau einer Aufgabe. */
export function leaveDialogScope(
  releasableIds: string[],
  labelOf: (id: string) => string | null | undefined
): { count: number; singleLabel: string | null } {
  const count = releasableIds.length;
  return { count, singleLabel: count === 1 ? labelOf(releasableIds[0]) ?? null : null };
}

export type LeaveChoice = "keep" | "release";
export type LeaveOutcome =
  | { ok: true; result?: Awaited<ReturnType<typeof releaseRun>> }
  | { ok: false; stage: "save" | "release"; message?: string; result?: Awaited<ReturnType<typeof releaseRun>> };

/**
 * Führt die Dialogentscheidung aus. Erst sichern (Fehler → nichts weiter),
 * „Behalten" ruft niemals den Server zur Freigabe auf, „Freigeben" nutzt
 * ausschließlich `releaseRun`. Fehlgeschlagene Freigaben → ok:false (keine Navigation).
 */
export async function performLeave(opts: {
  choice: LeaveChoice;
  flush: () => Promise<void>;
  runIds: string[];
  userId: string;
  loadState: (ids: string[]) => Promise<RunState[]>;
  release: (id: string) => Promise<boolean>;
}): Promise<LeaveOutcome> {
  try {
    await opts.flush();
  } catch (e) {
    return { ok: false, stage: "save", message: (e as Error)?.message };
  }
  if (opts.choice === "keep") return { ok: true };
  try {
    const result = await releaseRun(opts);
    if (result.failed.length > 0) return { ok: false, stage: "release", result };
    return { ok: true, result };
  } catch (e) {
    return { ok: false, stage: "release", message: (e as Error)?.message };
  }
}
