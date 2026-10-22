/**
 * Zurückpfeil der Dienstleistungsbearbeitung (nur TaskExecutionPage).
 * „Behalten": speichern, Zuweisung bleibt. „Freigeben": erst speichern, dann
 * nur die eigene(n) offene(n) Aufgabe(n) – einzeln oder des aktuellen
 * Durchlaufs – über die bestehende Freigabe (serverseitig erneut geprüft).
 * Speicherfehler → keine Freigabe, keine Navigation (Fehler wird geworfen).
 */
import { releaseRun, type RunState } from "./leaveRun";

export type BackChoice = "keep" | "release";

/** Dialog nur bei eigener, bearbeitbarer, nicht abgeschlossener Aufgabe. */
export function needsBackDialog(o: {
  canEdit: boolean; status: string | undefined; assignedTo: string | null | undefined; userId: string | undefined;
}): boolean {
  return !!o.userId && o.canEdit && o.status !== "completed" && o.assignedTo === o.userId;
}

export async function leaveTask(opts: {
  choice: BackChoice;
  measurementId: string;
  /** Durchlauf-IDs; leer = Einzelbearbeitung. */
  runIds: string[];
  userId: string;
  save: () => Promise<void>;
  loadState: (ids: string[]) => Promise<RunState[]>;
  release: (id: string) => Promise<boolean>;
}): Promise<{ released: string[]; skipped: string[]; failed: string[] }> {
  await opts.save(); // wirft bei Fehler → Aufrufer bleibt auf der Seite
  if (opts.choice === "keep") return { released: [], skipped: [], failed: [] };
  const ids = opts.runIds.length > 0 ? opts.runIds : [opts.measurementId];
  return releaseRun({ runIds: ids, userId: opts.userId, loadState: opts.loadState, release: opts.release });
}

/** Sicheres Ziel: im Durchlauf nie history-back (könnte andere Probe sein). */
export function backTarget(inRun: boolean, historyIdx: number | undefined): -1 | "/auftraege" {
  if (inRun) return "/auftraege";
  return typeof historyIdx === "number" && historyIdx > 0 ? -1 : "/auftraege";
}
