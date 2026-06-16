/**
 * Helpers für flexible Zeitsteuerung von Prozessschritten & geplanten Messungen.
 *
 * Zeitmodi:
 *  - relative:  offset_minutes (ab Start der Charge)
 *  - absolute:  absolute_time (HH:mm)
 *  - condition: condition_kind + condition_value/unit oder condition_text
 */

export type StepTimeMode = "relative" | "absolute" | "condition";
export type StepConditionKind =
  | "temperature"
  | "ph"
  | "previous_step"
  | "manual_release"
  | "custom";

export interface StepTimeFields {
  time_mode?: StepTimeMode | null;
  offset_minutes?: number | null;
  absolute_time?: string | null; // "HH:mm" or "HH:mm:ss"
  condition_kind?: StepConditionKind | null;
  condition_value?: number | null;
  condition_unit?: string | null;
  condition_text?: string | null;
}

export type RelativeUnit = "min" | "h" | "hm";

/** Minutes -> {hours, minutes} */
export function splitMinutes(total: number | null | undefined) {
  const t = Math.max(0, Math.round(Number(total ?? 0)));
  return { h: Math.floor(t / 60), m: t % 60 };
}

/** Build minutes from a unit + value(s). */
export function toMinutes(value: string, unit: RelativeUnit, hours?: string): number | null {
  if (unit === "min") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (unit === "h") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 60) : null;
  }
  // hm
  const h = Number(hours || 0);
  const m = Number(value || 0);
  if (!Number.isFinite(h) && !Number.isFinite(m)) return null;
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatRelativeMinutes(total: number | null | undefined): string {
  if (total == null) return "+0 min";
  const { h, m } = splitMinutes(total);
  if (h && m) return `+${h} h ${m} min`;
  if (h) return `+${h} h`;
  return `+${m} min`;
}

export function formatAbsoluteTime(t: string | null | undefined): string {
  if (!t) return "—";
  // Postgres returns "HH:mm:ss"
  return t.slice(0, 5) + " Uhr";
}

const CONDITION_LABELS_DE: Record<StepConditionKind, string> = {
  temperature: "Temperatur erreicht",
  ph: "pH erreicht",
  previous_step: "Vorheriger Schritt beendet",
  manual_release: "Freigabe durch Mitarbeiter",
  custom: "Eigene Bedingung",
};

export function formatCondition(s: StepTimeFields): string {
  if (!s.condition_kind) return "—";
  if (s.condition_kind === "temperature" && s.condition_value != null) {
    return `bei ${s.condition_value} ${s.condition_unit || "°C"}`;
  }
  if (s.condition_kind === "ph" && s.condition_value != null) {
    return `bei pH ${s.condition_value}`;
  }
  if (s.condition_kind === "previous_step") return "nach vorigem Schritt";
  if (s.condition_kind === "manual_release") return "manuelle Freigabe";
  if (s.condition_kind === "custom") return s.condition_text || "Bedingung";
  return CONDITION_LABELS_DE[s.condition_kind];
}

export function formatStepTime(s: StepTimeFields): string {
  const mode = s.time_mode || "relative";
  if (mode === "absolute") return formatAbsoluteTime(s.absolute_time);
  if (mode === "condition") return formatCondition(s);
  return formatRelativeMinutes(s.offset_minutes ?? null);
}

/** Determine if a relative/absolute step is due relative to `now` and `batchStart`. */
export function isStepDue(s: StepTimeFields, batchStart: Date | null, now: Date = new Date()): boolean {
  const mode = s.time_mode || "relative";
  if (mode === "relative") {
    if (!batchStart || s.offset_minutes == null) return false;
    const dueAt = batchStart.getTime() + s.offset_minutes * 60_000;
    return now.getTime() >= dueAt;
  }
  if (mode === "absolute" && s.absolute_time) {
    const [hh, mm] = s.absolute_time.slice(0, 5).split(":").map(Number);
    const due = new Date(now);
    due.setHours(hh, mm, 0, 0);
    return now >= due;
  }
  return false;
}
