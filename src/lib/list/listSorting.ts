/**
 * Gemeinsame Sortier-Grundlage für Listenansichten.
 *
 * Die Logik ist unverändert aus der Rohstoffliste übernommen
 * (`src/pages/RawMaterialsPage.tsx`) und lediglich herausgelöst, damit
 * Fertigungsfreigaben, m³-Liste und Kundendokumentation exakt dasselbe
 * Verhalten zeigen: Klick auf den Spaltenkopf schaltet auf-/absteigend,
 * Textvergleich natürlich (Zahlen in Texten) und ohne Groß-/Kleinschreibung.
 */
import { useCallback, useEffect, useState } from "react";

export type SortDir = "asc" | "desc";

/** Textvergleich wie in der Rohstoffliste. */
export function compareText(a: unknown, b: unknown): number {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Zahlenvergleich – leere Werte immer ans Ende. */
export function compareNumber(a: unknown, b: unknown): number {
  const na = a === null || a === undefined || a === "" ? null : Number(a);
  const nb = b === null || b === undefined || b === "" ? null : Number(b);
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return compareText(a, b);
  return na - nb;
}

/** Datumsvergleich – leere Werte immer ans Ende. */
export function compareDate(a: unknown, b: unknown): number {
  const ta = a ? new Date(String(a)).getTime() : NaN;
  const tb = b ? new Date(String(b)).getTime() : NaN;
  const va = Number.isFinite(ta) ? ta : null;
  const vb = Number.isFinite(tb) ? tb : null;
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return va - vb;
}

export type SortType = "text" | "number" | "date";

export function compareBy(type: SortType, a: unknown, b: unknown): number {
  if (type === "number") return compareNumber(a, b);
  if (type === "date") return compareDate(a, b);
  return compareText(a, b);
}

export interface SortableColumn<K extends string> {
  key: K;
  type?: SortType;
  /** Wert, der für die Sortierung herangezogen wird. */
  value: (row: never) => unknown;
}

export interface ListSortState<K extends string> {
  sortKey: K;
  sortDir: SortDir;
  toggleSort: (key: K) => void;
  /** Sortiert eine Liste anhand der übergebenen Wert-Auflösung. */
  sortRows: <T>(rows: T[], resolve: (row: T, key: K) => unknown, type?: (key: K) => SortType) => T[];
}

/**
 * Sortierzustand inklusive lokaler Speicherung (wie in der Rohstoffliste).
 * `storageKey` ist optional – ohne Schlüssel wird nichts gespeichert.
 */
export function useListSort<K extends string>(opts: {
  initialKey: K;
  initialDir?: SortDir;
  storageKey?: string;
}): ListSortState<K> {
  const { initialKey, initialDir = "asc", storageKey } = opts;

  const load = () => {
    if (!storageKey) return {} as { sortKey?: K; sortDir?: SortDir };
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  };
  const initial = load();

  const [sortKey, setSortKey] = useState<K>((initial.sortKey as K) ?? initialKey);
  const [sortDir, setSortDir] = useState<SortDir>((initial.sortDir as SortDir) ?? initialDir);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortKey, sortDir }));
    } catch {
      /* Speichern ist optional – Sortierung funktioniert auch ohne. */
    }
  }, [storageKey, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: K) => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          return prev;
        }
        setSortDir("asc");
        return key;
      });
    },
    []
  );

  const sortRows = useCallback(
    <T,>(rows: T[], resolve: (row: T, key: K) => unknown, type?: (key: K) => SortType): T[] => {
      const t = type?.(sortKey) ?? "text";
      const sorted = [...rows].sort((a, b) => compareBy(t, resolve(a, sortKey), resolve(b, sortKey)));
      return sortDir === "asc" ? sorted : sorted.reverse();
    },
    [sortKey, sortDir]
  );

  return { sortKey, sortDir, toggleSort, sortRows };
}
