import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface Args {
  /** Nur innerhalb eines aktiven Messdurchlaufs und bei bearbeitbarer Messung. */
  enabled: boolean;
  /** Erst nach dem Laden der gespeicherten Werte beobachten. */
  ready: boolean;
  /** Aktuelle Formularwerte – jede Änderung erhöht den Änderungszähler. */
  values: unknown;
  /** Speichert den jeweils NEUESTEN Stand (liest zum Aufrufzeitpunkt). */
  save: () => Promise<void>;
  delayMs?: number;
}

/**
 * Autosave für den temporären Messdurchlauf.
 *
 * - Es läuft immer höchstens EIN Speichervorgang; Änderungen während des
 *   Speicherns führen danach zu genau einem weiteren Lauf mit dem neuesten
 *   Stand (kein Überholen älterer Stände).
 * - Ein Änderungszähler stellt sicher, dass nur tatsächlich gesicherte Stände
 *   als „gespeichert" gelten.
 * - Ohne Benutzereingabe (direkt nach dem Laden) wird nichts gespeichert.
 * - `flush()` speichert sofort und wartet – für den Probenwechsel.
 */
export function useMeasurementAutosave({ enabled, ready, values, save, delayMs = 1500 }: Args) {
  const [state, setState] = useState<AutosaveState>("idle");
  const version = useRef(0);
  const savedVersion = useRef(0);
  const baselineTaken = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const flush = useCallback(async (): Promise<void> => {
    if (!enabledRef.current) return;
    if (running.current) {
      await running.current;
      if (savedVersion.current >= version.current) return;
    }
    if (savedVersion.current >= version.current) return;
    const loop = (async () => {
      while (savedVersion.current < version.current) {
        const v = version.current;
        setState("saving");
        await saveRef.current();
        savedVersion.current = v;
      }
      setState("saved");
    })();
    running.current = loop;
    try {
      await loop;
    } catch (err) {
      setState("error");
      throw err;
    } finally {
      running.current = null;
    }
  }, []);

  // Änderungen zählen (erste Wertbelegung nach dem Laden ist keine Eingabe).
  useEffect(() => {
    if (!enabled || !ready) return;
    if (!baselineTaken.current) {
      baselineTaken.current = true;
      return;
    }
    version.current += 1;
    setState("pending");
    const timer = setTimeout(() => {
      flush().catch(() => { /* Status zeigt Fehler; erneuter Versuch bei nächster Eingabe/Wechsel */ });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [values, enabled, ready, delayMs, flush]);

  // Beim Verlassen der Seite offenen Stand noch sichern.
  useEffect(() => () => {
    if (enabledRef.current && savedVersion.current < version.current) {
      void flush().catch(() => {});
    }
  }, [flush]);

  const hasUnsaved = () => savedVersion.current < version.current;

  return { state, flush, hasUnsaved };
}
