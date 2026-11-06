/**
 * Zentrale SLA-Ampelberechnung (Phase 1).
 *
 * Reine TypeScript-Funktionen: keine Datenbank-, Netzwerk- oder
 * Seiteneffekte. Web und Tauri Desktop nutzen ausschließlich diese Logik.
 *
 * Verbindliche Regeln:
 * - Geschäftszeitzone ist Europe/Vienna; das aktuelle Kalenderdatum wird
 *   unabhängig von der Client-Zeitzone in dieser Zone ermittelt.
 * - measurement_orders.due_date ist ein reiner DATE-Wert (YYYY-MM-DD) und
 *   wird niemals über new Date(due_date).getTime() in UTC umgerechnet.
 * - Der Bearbeitungsstatus beeinflusst die Farbe nicht; ausschließlich
 *   status === 'completed' beendet die Überwachung einer Dienstleistung.
 */

export type SlaColor = "green" | "yellow" | "red" | "neutral" | "completed";

export interface SlaServiceInput {
  /** Status der Aufgabe (order_measurements.status). */
  status: string | null | undefined;
  /** measurement_services.sla_monitoring_enabled */
  monitoringEnabled: boolean | null | undefined;
  /** measurement_services.sla_yellow_warning_days (Kalendertage, >= 0) */
  warningDays: number | null | undefined;
}

export interface SlaResult {
  color: SlaColor;
  /** Kalendertage bis zur Fälligkeit (negativ = Verzug); null ohne Datum. */
  daysUntilDue: number | null;
  /** Wirksame Vorwarnzeit in Kalendertagen; null wenn nicht überwacht. */
  warningDays: number | null;
}

export const SLA_TIMEZONE = "Europe/Vienna";

/**
 * Aktuelles Kalenderdatum in Europe/Vienna als YYYY-MM-DD.
 * Unabhängig von der Zeitzone des ausführenden Geräts.
 */
export function viennaTodayISO(now: Date = new Date()): string {
  // en-CA liefert direkt das ISO-Format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SLA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Kalendertage zwischen zwei DATE-Strings (YYYY-MM-DD): to - from. */
export function diffCalendarDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ampel einer einzelnen Dienstleistung.
 *
 * - completed: Aufgabe abgeschlossen (Überwachung beendet).
 * - neutral: Überwachung deaktiviert oder kein Fälligkeitsdatum.
 * - red: Fälligkeit mindestens einen Kalendertag zurück.
 * - yellow: Fälligkeit heute oder innerhalb der Vorwarnzeit.
 * - green: Fälligkeit außerhalb der Vorwarnzeit.
 */
export function computeServiceSla(
  service: SlaServiceInput,
  dueDate: string | null | undefined,
  today: string = viennaTodayISO(),
): SlaResult {
  if (service.status === "completed") {
    return { color: "completed", daysUntilDue: null, warningDays: null };
  }
  const enabled = service.monitoringEnabled === true;
  const warningDays =
    typeof service.warningDays === "number" && service.warningDays >= 0
      ? Math.floor(service.warningDays)
      : 0;
  if (!enabled || !dueDate || !DATE_RE.test(dueDate)) {
    return { color: "neutral", daysUntilDue: null, warningDays: enabled ? warningDays : null };
  }
  const daysUntilDue = diffCalendarDays(today, dueDate);
  const color: SlaColor =
    daysUntilDue < 0 ? "red" : daysUntilDue <= warningDays ? "yellow" : "green";
  return { color, daysUntilDue, warningDays };
}

/**
 * Auftrags- bzw. Probenampel: Aggregation ausschließlich über überwachte
 * offene Dienstleistungen.
 *
 * 1. Mindestens eine rote Dienstleistung → rot.
 * 2. Sonst mindestens eine gelbe → gelb.
 * 3. Sonst mindestens eine überwachte offene → grün.
 * 4. Keine überwachte offene Dienstleistung → neutral.
 * 5. Kein Fälligkeitsdatum → neutral.
 * 6. Alle vorhandenen Dienstleistungen abgeschlossen (und mindestens eine
 *    vorhanden) → abgeschlossen.
 *
 * Eine leere Liste wird niemals als abgeschlossen interpretiert.
 * Nicht überwachte Dienstleistungen beeinflussen die Aggregation nicht.
 */
export function aggregateSla(
  services: SlaServiceInput[],
  dueDate: string | null | undefined,
  today: string = viennaTodayISO(),
): SlaResult {
  if (services.length === 0) {
    return { color: "neutral", daysUntilDue: null, warningDays: null };
  }
  if (services.every((s) => s.status === "completed")) {
    return { color: "completed", daysUntilDue: null, warningDays: null };
  }
  if (!dueDate || !DATE_RE.test(dueDate)) {
    return { color: "neutral", daysUntilDue: null, warningDays: null };
  }
  const monitored = services.filter(
    (s) => s.status !== "completed" && s.monitoringEnabled === true,
  );
  if (monitored.length === 0) {
    return { color: "neutral", daysUntilDue: null, warningDays: null };
  }
  const results = monitored.map((s) => computeServiceSla(s, dueDate, today));
  if (results.some((r) => r.color === "red")) {
    const worst = Math.min(...results.map((r) => r.daysUntilDue ?? 0));
    return { color: "red", daysUntilDue: worst, warningDays: null };
  }
  if (results.some((r) => r.color === "yellow")) {
    const nearest = Math.min(...results.map((r) => r.daysUntilDue ?? 0));
    return { color: "yellow", daysUntilDue: nearest, warningDays: null };
  }
  const nearest = Math.min(...results.map((r) => r.daysUntilDue ?? 0));
  return { color: "green", daysUntilDue: nearest, warningDays: null };
}

/** Hilfs-Mapping: order_measurements-Zeile → SlaServiceInput. */
export function slaInputFromMeasurement(m: any): SlaServiceInput {
  return {
    status: m?.status ?? null,
    monitoringEnabled: m?.measurement_services?.sla_monitoring_enabled === true,
    warningDays: m?.measurement_services?.sla_yellow_warning_days ?? null,
  };
}
