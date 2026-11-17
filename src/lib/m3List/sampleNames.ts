import { articlePrefix } from "./orderLabel";

export interface M3SampleNamePlan {
  /** Eindeutige Probennamen: erste 9 Stellen der Artikelnummer + "-" + Elementnummer. */
  names: string[];
  /** Anzahl Zeilen ohne verwertbare Elementnummer (keine Probe erzeugt). */
  skippedRows: number;
  /** true, wenn keine Artikelnummer vorhanden ist (dann entstehen keine Namen). */
  missingArticle: boolean;
}

/**
 * Probennamen aus der m³-Liste: `<erste 9 Zeichen Artikelnummer>-<Elementnummer>`,
 * z. B. "0040-6129-00340". Eine Probe je Zeile mit Elementnummer; doppelte Namen
 * werden nur einmal angelegt.
 */
export function buildM3SampleNames(
  articleNumber: string | null | undefined,
  rows: ReadonlyArray<Record<string, unknown>>
): M3SampleNamePlan {
  const prefix = articlePrefix(articleNumber);
  const names: string[] = [];
  let skippedRows = 0;
  for (const r of rows) {
    const el = r.element_number == null ? "" : String(r.element_number).trim();
    if (!el || el === "—") {
      skippedRows++;
      continue;
    }
    if (!prefix) continue;
    const name = `${prefix}-${el}`;
    if (!names.includes(name)) names.push(name);
  }
  return { names, skippedRows, missingArticle: !prefix };
}
