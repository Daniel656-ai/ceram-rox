/**
 * Identifikation einer Fertigungsfreigabe aus dem Dateinamen.
 *
 *   0075-6106.pdf        → Variante 0075, Auftrag 6106, Rev. 0 (Neuanlage)
 *   0075-6106_Rev1.pdf   → Variante 0075, Auftrag 6106, Revision 1
 *   0075-6107.pdf        → anderer Auftrag → NEUE Fertigungsfreigabe, keine Revision
 *
 * Reihenfolge der Erkennung (verbindlich):
 *   1. Variante + Auftragsnummer (Dateiname, sonst Dokumenttext)
 *   2. Revisionskennung (_RevX)
 *   3. Inhaltliche Änderungen (rot / durchgestrichen) – nur zur Plausibilisierung
 *
 * Reine Funktionen, keine Datenbankzugriffe.
 */

export interface ReleaseDocumentIdentity {
  /** kombinierte Kennung, z. B. "0075-6106" */
  releaseNumber: string | null;
  /** Zelligkeit / Artikelvariante, z. B. "0075" */
  variantCode: string | null;
  /** Auftragsnummer, z. B. "6106" */
  orderNumber: string | null;
  /** Revisionsnummer aus "_RevX"; null ohne Kennung */
  revisionNumber: number | null;
  /** true, wenn der Dateiname eine Revisionskennung trägt */
  hasRevisionTag: boolean;
  /** woher die Kennung stammt */
  source: "filename" | "text" | "none";
}

export type ReleaseMatchState =
  /** keine bestehende Freigabe zur Kennung → Neuanlage */
  | "new"
  /** _RevX + bestehende Freigabe gefunden → Revision */
  | "revision"
  /** bestehende Freigabe gefunden, Datei trägt aber keine _RevX-Kennung → als Revision behandelt, Hinweis */
  | "revision_without_tag"
  /** _RevX vorhanden, aber keine bestehende Freigabe → KEINE automatische Neuanlage, Zuordnung prüfen */
  | "revision_unmatched"
  /** _RevX ist nicht neuer als der bestehende Stand → nicht speicherbar */
  | "revision_conflict"
  /** Benutzer hat trotz Warnung ausdrücklich „neu anlegen“ gewählt */
  | "new_forced";

const EMPTY: ReleaseDocumentIdentity = {
  releaseNumber: null, variantCode: null, orderNumber: null,
  revisionNumber: null, hasRevisionTag: false, source: "none",
};

/** Dateiname → Kennung. Toleriert Pfade, Groß-/Kleinschreibung, "Rev1", "Rev_1", "Rev. 1", "Revision 1". */
export function parseReleaseFileName(fileName: string | null | undefined): ReleaseDocumentIdentity {
  if (!fileName) return { ...EMPTY };
  const base = fileName.split(/[\\/]/).pop()!.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const m = base.match(/(\d{3,5})\s*[-_]\s*(\d{3,5})/);
  if (!m) return { ...EMPTY };
  const rest = base.slice((m.index ?? 0) + m[0].length);
  const rev = rest.match(/(?:^|[\s._(-])(?:rev(?:ision)?|änderung|aenderung)[\s._\-]*0*(\d{1,3})\b/i);
  return {
    releaseNumber: `${m[1]}-${m[2]}`,
    variantCode: m[1],
    orderNumber: m[2],
    revisionNumber: rev ? Number.parseInt(rev[1], 10) : null,
    hasRevisionTag: !!rev,
    source: "filename",
  };
}

/** Kennung aus dem Dokumenttext (Fallback, wenn der Dateiname nichts hergibt). */
export function identityFromText(releaseNumber: string | null | undefined, revisionNumber: number | null | undefined): ReleaseDocumentIdentity {
  const rn = (releaseNumber ?? "").trim();
  const m = rn.match(/^(\d{3,5})-(\d{3,5})$/);
  if (!rn) return { ...EMPTY };
  return {
    releaseNumber: rn,
    variantCode: m?.[1] ?? null,
    orderNumber: m?.[2] ?? null,
    revisionNumber: Number.isFinite(revisionNumber as number) && (revisionNumber as number) > 0 ? Number(revisionNumber) : null,
    hasRevisionTag: Number.isFinite(revisionNumber as number) && (revisionNumber as number) > 0,
    source: "text",
  };
}

export interface MatchDecision {
  state: ReleaseMatchState;
  isRevision: boolean;
  /** Revisionsnummer, die beim Speichern verwendet wird */
  revisionNumber: number;
  /** Hinweise für den Benutzer (nicht blockierend) */
  warnings: string[];
  /** blockierender Grund (Speichern nicht möglich) */
  blocker: string | null;
}

/**
 * Entscheidungslogik Neuanlage vs. Revision – ausschließlich anhand der
 * Kennung (Variante + Auftrag) und der Revisionskennung. Inhaltliche
 * Abweichungen (Stückzahl, Termin, Verpackung …) spielen hier KEINE Rolle.
 */
export function decideMatch(
  identity: ReleaseDocumentIdentity,
  existingRow: Record<string, unknown> | null,
): MatchDecision {
  const warnings: string[] = [];
  const existing = existingRow
    ? {
        revision_number: Number(existingRow.revision_number) || 0,
        release_number: (existingRow.release_number as string | null) ?? null,
      }
    : null;
  const currentRev = existing ? existing.revision_number : null;

  if (identity.hasRevisionTag) {
    const tagged = identity.revisionNumber ?? 0;
    if (!existing) {
      return {
        state: "revision_unmatched",
        isRevision: true,
        revisionNumber: tagged,
        warnings,
        blocker:
          `Revision erkannt (Rev. ${tagged}), aber die zugehörige ursprüngliche Fertigungsfreigabe ` +
          `${identity.releaseNumber ?? ""} wurde nicht gefunden. Bitte Zuordnung prüfen. Fehlercode: REVISION_UNMATCHED.`,
      };
    }
    const expected = (currentRev ?? 0) + 1;
    if (tagged <= (currentRev ?? 0)) {
      return {
        state: "revision_conflict",
        isRevision: true,
        revisionNumber: tagged,
        warnings,
        blocker:
          `Die Datei trägt Rev. ${tagged}, der aktuelle Stand von ${existing.release_number ?? identity.releaseNumber ?? ""} ` +
          `ist aber bereits Rev. ${currentRev}. Eine ältere oder gleiche Revision kann nicht importiert werden. Fehlercode: REVISION_NOT_NEWER.`,
      };
    }
    if (tagged !== expected) {
      warnings.push(
        `Die Datei trägt Rev. ${tagged}, erwartet wäre Rev. ${expected} (aktuell Rev. ${currentRev}). ` +
          `Der Vergleich erfolgt gegen den aktuell gültigen Stand Rev. ${currentRev}.`,
      );
    }
    return { state: "revision", isRevision: true, revisionNumber: tagged, warnings, blocker: null };
  }

  if (!existing) {
    return { state: "new", isRevision: false, revisionNumber: identity.revisionNumber ?? 0, warnings, blocker: null };
  }

  // Gleiche Kennung, aber keine Revisionskennung im Dateinamen:
  // gleicher Auftrag → Revision des bestehenden Stands, mit Hinweis.
  warnings.push(
    `Für ${existing.release_number ?? identity.releaseNumber ?? "diese Kennung"} existiert bereits eine Fertigungsfreigabe (Rev. ${currentRev}), ` +
      `der Dateiname trägt jedoch keine Revisionskennung (_RevX). Die Datei wird als Rev. ${(currentRev ?? 0) + 1} zugeordnet – bitte prüfen.`,
  );
  return {
    state: "revision_without_tag",
    isRevision: true,
    revisionNumber: (currentRev ?? 0) + 1,
    warnings,
    blocker: null,
  };
}
