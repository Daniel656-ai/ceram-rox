/**
 * Schutz der Spiegel-Effekte (verknüpfte Felder / Stammdatenreferenzen).
 *
 * Gespiegelte Felder sind schreibgeschützte Anzeigen: Ihr Wert wird aus einer
 * Quelle (anderes Feld, Workflow-Schritt, verknüpftes Formular, Stammdaten)
 * in den eigenen Feldschlüssel übernommen. Solange die Quelle lädt oder nicht
 * eindeutig aufgelöst ist, darf ein bereits gespeicherter eigener Wert NIEMALS
 * überschrieben werden – sonst löscht der nächste Speicherlauf die zugehörige
 * Ergebniszeile (leere Werte gelten dort als bewusstes Leeren).
 *
 * Unterscheidung der Zustände (Anforderung: technisch unterscheidbar):
 * - Quelle lädt noch / Abfrage nicht abgeschlossen  → nicht schreiben
 * - Referenz ungültig / Stammdatenwert nicht auflösbar → nicht schreiben
 * - Quelle geladen und eindeutig aufgelöst (auch leer) → spiegeln erlaubt
 */

export interface MirrorDecision {
  /** Darf der eigene Feldwert überschrieben werden? */
  write: boolean;
  /** Zu schreibender Wert (nur relevant, wenn write === true). */
  value: string;
}

/**
 * Verknüpfter Wert (LinkedFieldControl).
 *
 * - `sameForm`: Quelle ist ein Feld desselben Formulars → synchron verfügbar,
 *   kein Ladezustand, Spiegeln wie bisher.
 * - `sourcesReady`: Die asynchronen Quelldaten (Workflow-Schrittdaten /
 *   verknüpfte Formulare) wurden erfolgreich geladen. Erst dann darf der
 *   eigene Wert überschrieben werden – auch mit einem leeren Quellwert
 *   („geladen und leer" ist eine eindeutige Auflösung).
 */
export function linkedMirrorDecision(opts: {
  interactive: boolean;
  sameForm: boolean;
  sourcesReady: boolean;
  srcRaw: unknown;
  ownRaw: unknown;
}): MirrorDecision {
  const next = opts.srcRaw == null ? "" : String(opts.srcRaw);
  if (!opts.interactive) return { write: false, value: next };
  if (!opts.sameForm && !opts.sourcesReady) return { write: false, value: next };
  if ((opts.ownRaw ?? "") === next) return { write: false, value: next };
  return { write: true, value: next };
}

/**
 * Stammdatenreferenz (MasterDataFieldControl).
 *
 * Gespiegelt wird erst, wenn der Katalog erfolgreich geladen wurde
 * (`catalogReady`) UND die Referenz eindeutig aufgelöst ist (`resolved`).
 * Eine ungültige Referenz oder ein fehlender Stammdatenwert überschreibt
 * den eigenen gespeicherten Wert nicht – der Hinweis wird weiterhin angezeigt.
 */
export function masterDataMirrorDecision(opts: {
  interactive: boolean;
  catalogReady: boolean;
  resolved: boolean;
  value: unknown;
  ownRaw: unknown;
}): MirrorDecision {
  const next = opts.value == null ? "" : String(opts.value);
  if (!opts.interactive) return { write: false, value: next };
  if (!opts.catalogReady || !opts.resolved) return { write: false, value: next };
  if ((opts.ownRaw ?? "") === next) return { write: false, value: next };
  return { write: true, value: next };
}
