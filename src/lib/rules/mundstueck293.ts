/**
 * ROX – Automatisches Mundstück 293/1 (Raumgewicht / Wasseraufnahme / Schwindung).
 *
 * Reine Planungsfunktion. Die Zuordnung MS-Auswahl → „Mundstück MS“ erfolgt
 * (wie in der Firmendatenbank) ausschließlich über die Reihenfolge. Deshalb:
 * - Auto-Einträge werden nur am ENDE angehängt (zuerst RW/WA, dann Schwindung).
 * - Fällt ein Auto-Eintrag weg, wird die Zeile an derselben Position in
 *   „Mundstück MS“ mit entfernt – hat sie Werte, bleibt beides erhalten und
 *   der Auto-Eintrag wird als „verwaist – bitte prüfen“ markiert.
 * - Vom Auftraggeber gewählte 293/1-Einträge (ohne `auto`) bleiben unberührt.
 */

export const MS_AUSWAHL_KEY = "ms_auswahl_1";
export const MUNDSTUECK_KEY = "mundstueck_ms_1";
export const BRENNEN_KEY = "brennen_1";
export const MS_293 = "293_1";
export const ZWECK_RW = "Raumgewicht / Wasseraufnahme";
export const ZWECK_SW = "Schwindung";
export const AUTO_HINT = "automatisch – wegen gebuchter Leistung";
export const ORPHAN_HINT = "verwaist – bitte prüfen";
/** Für den Auftraggeber gesperrte Felder in Auto-Einträgen. */
export const AUTO_LOCKED_KEYS = ["anzahl", "laenge"];

type Row = Record<string, any>;

export function isAutoRow(r: Row | null | undefined): boolean {
  return !!r && r.auto === true && (r.zweck === ZWECK_RW || r.zweck === ZWECK_SW);
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Erkennt die gebuchten Leistungen am Namen (IDs weichen zwischen Web/Firma ab). */
export function bookedFlags(serviceNames: Array<string | null | undefined>) {
  const ns = serviceNames.filter(Boolean).map((n) => norm(String(n)));
  return {
    rw: ns.some((n) => n === "raumgewicht" || n === "wasseraufnahme"),
    sw: ns.some((n) => n === "schwindung"),
  };
}

/** Anzahl ausgefüllter Brenntemperatur-Zeilen. */
export function countBrennen(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) =>
    r && typeof r === "object" &&
    Object.values(r as Row).some((v) => v != null && String(v).trim() !== "")
  ).length;
}

export function rwAnzahl(brennen: number): number {
  return brennen <= 0 ? 1 : Math.floor(brennen / 2) + 1;
}

/** Hat eine Zeile von „Mundstück MS“ eingetragene Werte (Feld „ms“ zählt nicht)? */
export function hasValues(r: Row | null | undefined): boolean {
  if (!r) return false;
  return Object.entries(r).some(([k, v]) => k !== "ms" && v != null && String(v).trim() !== "" &&
    !(Array.isArray(v) && v.length === 0));
}

export interface Plan293Input {
  msAuswahl: Row[];
  mundstueck: Row[];
  brennenCount: number;
  booked: { rw: boolean; sw: boolean };
}

export interface Plan293Result {
  msAuswahl: Row[];
  mundstueck: Row[];
  changed: boolean;
}

export function planMundstueck293(input: Plan293Input): Plan293Result {
  const ms = (input.msAuswahl ?? []).map((r) => ({ ...(r ?? {}) }));
  const mund = (input.mundstueck ?? []).map((r) => ({ ...(r ?? {}) }));
  const desired: Record<string, Row> = {};
  if (input.booked.rw) desired[ZWECK_RW] = { anzahl: rwAnzahl(input.brennenCount), laenge: 200 };
  if (input.booked.sw) desired[ZWECK_SW] = { anzahl: 3, laenge: 150 };

  const outMs: Row[] = [];
  const outMund: Row[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < ms.length; i++) {
    const r = ms[i];
    const hasMund = i < mund.length;
    const m = hasMund ? mund[i] : undefined;
    if (!isAutoRow(r)) {
      outMs.push(r);
      if (hasMund) outMund.push(m!);
      continue;
    }
    const want = desired[r.zweck];
    if (want && !seen.has(r.zweck)) {
      seen.add(r.zweck);
      const next: Row = { ...r, ms: MS_293, anzahl: want.anzahl, laenge: want.laenge };
      delete next.verwaist;
      outMs.push(next);
      if (hasMund) outMund.push(m!);
      continue;
    }
    // Nicht mehr benötigt (oder Duplikat): nur entfernen, wenn keine Werte erfasst sind.
    if (hasValues(m)) {
      outMs.push({ ...r, verwaist: true });
      outMund.push(m!);
    }
    // sonst: ms[i] und mund[i] gemeinsam entfallen lassen → nichts verrutscht.
  }

  for (const zweck of [ZWECK_RW, ZWECK_SW]) {
    const want = desired[zweck];
    if (!want || seen.has(zweck)) continue;
    // Mundstück-MS auf Länge der MS-Auswahl auffüllen (neue Zeilen mit „ms“).
    while (outMund.length < outMs.length) {
      outMund.push({ ms: outMs[outMund.length]?.ms ?? null });
    }
    outMs.push({ ms: MS_293, anzahl: want.anzahl, laenge: want.laenge, zweck, auto: true });
    outMund.push({ ms: MS_293 });
  }

  const changed =
    JSON.stringify(outMs) !== JSON.stringify(input.msAuswahl ?? []) ||
    JSON.stringify(outMund) !== JSON.stringify(input.mundstueck ?? []);
  return { msAuswahl: outMs, mundstueck: outMund, changed };
}
