import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Schutz ungespeicherter Eingaben für „Ansicht aktualisieren".
 *
 * Seiten mit Autosave registrieren hier ihren vorhandenen Speicher-/Flush-
 * Mechanismus. Vor dem Neuladen wird jeder registrierte Schutz ausgeführt;
 * schlägt einer fehl, wird NICHT aktualisiert (Eingaben bleiben erhalten).
 * Ein Schutz muss werfen, wenn das Speichern nicht bestätigt ist.
 */
type Guard = () => Promise<void>;
const guards = new Set<{ current: Guard }>();

export function useRefreshGuard(guard: Guard) {
  const ref = useRef(guard);
  ref.current = guard;
  useEffect(() => {
    guards.add(ref);
    return () => { guards.delete(ref); };
  }, []);
}

export class UnsavedInputError extends Error {}

/**
 * Lädt ausschließlich die aktiven (sichtbaren) Abfragen neu – reine
 * Leseoperation, kein Seiten-Reload, kein Neustart der Desktop-App.
 */
export async function refreshCurrentView(qc: QueryClient): Promise<void> {
  for (const g of Array.from(guards)) {
    try {
      await g.current();
    } catch (e) {
      throw new UnsavedInputError(e instanceof Error ? e.message : String(e));
    }
  }
  await qc.refetchQueries({ type: "active" }, { throwOnError: true });
}

/** Nur für Tests. */
export function _guardCount() {
  return guards.size;
}
