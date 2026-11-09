/**
 * Hydration- und Server-Sync-Schutz für die Dienstleistungsbearbeitung
 * (TaskExecutionPage).
 *
 * Grundregeln (Implementierungsfreigabe 09.11.2026):
 * - Die initiale Hydration erfolgt ausschließlich aus dem frisch abgerufenen
 *   Datenbankstand, nie aus einem möglicherweise veralteten Query-Cache.
 * - Spätere Hintergrund-Updates des Serverstands werden nur übernommen, wenn
 *   keine ungespeicherten lokalen Eingaben vorliegen.
 * - Bei ungespeicherten Eingaben haben lokale Eingaben Vorrang; ein
 *   abweichender Serverstand wird als erkennbarer Konflikt gemeldet, niemals
 *   stillschweigend überschrieben.
 *
 * Reine Funktionen ohne Seiteneffekte – die React-Anbindung liegt in
 * `src/pages/TaskExecutionPage.tsx`.
 */

/** Baut die initialen Formularwerte aus den gespeicherten Messergebnissen. */
export function extractInitialValues(measurement: any): Record<string, unknown> {
  const initial: Record<string, unknown> = {};
  for (const r of measurement?.measurement_results ?? []) {
    const key = r?.result_name;
    if (!key) continue;
    if (r.value != null) initial[key] = String(r.value);
    else if (r.remarks != null) {
      // Wiederholbare / komplexe Werte wurden als JSON in remarks abgelegt.
      try {
        initial[key] = JSON.parse(r.remarks);
      } catch {
        initial[key] = r.remarks;
      }
    }
  }
  return initial;
}

/**
 * Stabile Serialisierung mit sortierten Schlüsseln. Zahlen werden wie bei der
 * Hydration als Zeichenkette verglichen ("5" ≡ 5), damit ein eigener
 * Speicherstand nicht als inhaltliche Abweichung erscheint.
 */
function stableStringify(v: unknown): string {
  if (typeof v === "number") return JSON.stringify(String(v));
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** Inhaltlicher Gleichheitsvergleich zweier Wertetaschen. */
export function valuesEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  return stableStringify(a) === stableStringify(b);
}

export interface ServerSyncInput {
  /** Initiale Hydration bereits abgeschlossen? */
  initialized: boolean;
  /** Ungespeicherte lokale Benutzereingaben vorhanden? */
  dirty: boolean;
  /** Aktuell angezeigte Formularwerte. */
  currentValues: Record<string, unknown>;
  /** Zuletzt übernommener Serverstand (null vor der ersten Hydration). */
  lastServerValues: Record<string, unknown> | null;
  /** Frisch eingetroffener Serverstand. */
  serverValues: Record<string, unknown>;
}

export type ServerSyncAction =
  | "hydrate" // erstmalige Befüllung aus dem frischen Serverstand
  | "adopt" // Hintergrund-Update übernehmen (keine lokalen Eingaben)
  | "conflict" // Serverstand abweichend, lokale Eingaben haben Vorrang
  | "none"; // nichts zu tun

export interface ServerSyncDecision {
  action: ServerSyncAction;
}

/**
 * Entscheidet, wie ein (neu) eingetroffener Serverstand zu behandeln ist.
 *
 * - Noch nicht hydriert → immer aus dem Serverstand initialisieren.
 * - Serverstand unverändert gegenüber dem zuletzt übernommenen → nichts tun
 *   (verhindert Fehlkonflikte durch eigene Saves oder Fokus-Refetches).
 * - Serverstand inhaltlich gleich den angezeigten Werten (z. B. eigener
 *   Autosave) → still als neuen Serverstand merken, ohne die Anzeige
 *   anzufassen (kein erneuter Autosave-Zyklus).
 * - Echte Serveränderung ohne lokale Eingaben → übernehmen.
 * - Echte Serveränderung mit ungespeicherten Eingaben → Konflikt melden,
 *   lokale Eingaben bleiben unangetastet.
 */
export function resolveServerSync(input: ServerSyncInput): ServerSyncDecision {
  if (!input.initialized) return { action: "hydrate" };
  if (
    input.lastServerValues &&
    valuesEqual(input.serverValues, input.lastServerValues)
  ) {
    return { action: "none" };
  }
  if (valuesEqual(input.serverValues, input.currentValues)) {
    return { action: "none" };
  }
  if (!input.dirty) return { action: "adopt" };
  return { action: "conflict" };
}
