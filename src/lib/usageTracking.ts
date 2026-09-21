import { api } from "@/lib/api";
import { runtimeVariant } from "@/lib/usageModule";
import type { UsageEventInput } from "@/lib/api/usageEvents";

/**
 * Zentrale, generische Nutzungserfassung für die gesamte Anwendung.
 *
 * Grundsätze:
 * - keine feste Modulliste: Modul, Funktion und Aktion sind freie Angaben
 *   des aufrufenden Bereichs. Ein zukünftiges Modul ruft lediglich
 *   trackUsage({ module, feature, action }) auf – weder diese Datei noch
 *   die Datenstruktur müssen dafür geändert werden.
 * - keine fachlichen Inhalte (keine Auftrags-, Kunden- oder Messdaten).
 * - blockiert niemals Navigation, Formulare oder fachliche Prozesse;
 *   Fehler (fehlende Struktur, offline) werden still ignoriert.
 * - Rollen werden bewusst NICHT mitgeschrieben: erfasst wird die
 *   tatsächliche Nutzung. Die Rollen eines Benutzers sind später über
 *   die Benutzerkennung auswertbar.
 */

export interface TrackUsageParams {
  /** Modul, z. B. "labor" oder "fertigungsunterlagen". */
  module: string;
  /** Konkrete Funktion innerhalb des Moduls, z. B. "m3_liste". */
  feature?: string;
  /** Konkrete Aktion, Standard: "used". */
  action?: string;
}

const FLUSH_DELAY_MS = 3000;
const MAX_BUFFER = 20;

let buffer: UsageEventInput[] = [];
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Wird von der gemeinsamen Hülle für angemeldete Seiten gesetzt. */
export function setUsageUser(id: string | null) {
  userId = id;
}

/**
 * Funktion und Aktion werden im vorhandenen Feld "action" zusammengeführt
 * ("feature.action"). Bestehende Ereignisse wie "module_opened" bleiben
 * dadurch unverändert gültig und auswertbar.
 */
export function composeAction(feature: string | undefined, action: string): string {
  const f = (feature ?? "").trim();
  return f ? `${f}.${action}` : action;
}

/** Zerlegt einen gespeicherten action-Wert wieder in Funktion und Aktion. */
export function parseAction(value: string): { feature: string | null; action: string } {
  const i = value.indexOf(".");
  if (i <= 0) return { feature: null, action: value };
  return { feature: value.slice(0, i), action: value.slice(i + 1) };
}

export function buildUsageEvent(
  params: TrackUsageParams & { user_id: string },
): UsageEventInput {
  return {
    occurred_at: new Date().toISOString(),
    module: params.module,
    action: composeAction(params.feature, params.action ?? "used"),
    user_id: params.user_id,
    variant: runtimeVariant(),
  };
}

export async function flushUsage(): Promise<void> {
  if (buffer.length === 0) return;
  const pending = buffer;
  buffer = [];
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    await api.usageEvents.insertBatch(pending);
  } catch {
    /* still verwerfen – kein Retry, kein Fehlerdialog */
  }
}

/** Zentrale Tracking-Funktion für jedes Modul. */
export function trackUsage(params: TrackUsageParams): void {
  if (!userId || !params.module) return;
  buffer.push(buildUsageEvent({ ...params, user_id: userId }));
  if (buffer.length >= MAX_BUFFER) {
    void flushUsage();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => { timer = null; void flushUsage(); }, FLUSH_DELAY_MS);
  }
}

/** Nur für Tests. */
export function __usageBuffer(): UsageEventInput[] {
  return buffer;
}
export function __resetUsage(): void {
  buffer = [];
  userId = null;
  if (timer) { clearTimeout(timer); timer = null; }
}
