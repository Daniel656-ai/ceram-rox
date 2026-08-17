/**
 * Ableitung der „Gebuchten Dienstleistungen" eines Projekts.
 *
 * Es werden ausschließlich bestehende Daten aggregiert:
 * Projekt → Auftrag → Aufgabe (order_measurements) → Dienstleistung.
 * Es entstehen keine eigenen Dienstleistungs-Datensätze auf Projektebene.
 * Stunden/Kosten folgen exakt derselben Formel wie die Projekt-Kostenlogik
 * (Ist-Dauer bei erledigten Aufgaben, sonst Summe der Arbeitszeitprotokolle).
 */

export type BookedServiceStatus =
  | "planned"
  | "open"
  | "in_progress"
  | "partially_completed"
  | "completed"
  | "cancelled";

export interface BookedServiceRow {
  key: string;
  orderId: string;
  orderNumber: string;
  serviceId: string | null;
  serviceName: string;
  sampleCount: number;
  measurementCount: number;
  completedCount: number;
  status: BookedServiceStatus;
  startDate: string | null;
  completedDate: string | null;
  hours: number;
  cost: number;
  measurementIds: string[];
}

export function measurementHours(m: any): number {
  const workLogHours = (m.work_logs || []).reduce(
    (s: number, wl: any) => s + (wl.hours || 0),
    0
  );
  const useActual = m.status === "completed" && m.actual_duration_hours != null;
  return useActual ? Number(m.actual_duration_hours) : workLogHours;
}

function minDate(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return new Date(b) < new Date(a) ? b : a;
}

function maxDate(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return new Date(b) > new Date(a) ? b : a;
}

/**
 * orders: Ergebnis von api.projects.listOrdersWithDetails()
 * timeEntries: project_time_entries des Projekts. Einträge mit `order_id` werden
 * dem jeweiligen Auftrag zugeordnet (Stunden + Kosten mit dem Stundensatz der
 * Dienstleistung). Sie stammen aus einer anderen Quelle als die Arbeitszeit-
 * protokolle (work_logs) und werden daher genau einmal gezählt.
 */
export function buildBookedServices(orders: any[], timeEntries: any[] = []): BookedServiceRow[] {
  const rows = new Map<string, BookedServiceRow>();

  for (const order of orders || []) {
    for (const m of order.order_measurements || []) {
      const serviceId = m.service_id ?? null;
      const key = `${order.id}::${serviceId ?? m.id}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          key,
          orderId: order.id,
          orderNumber: order.order_number,
          serviceId,
          serviceName: m.measurement_services?.service_name || "–",
          sampleCount: 0,
          measurementCount: 0,
          completedCount: 0,
          status: "open",
          startDate: null,
          completedDate: null,
          hours: 0,
          cost: 0,
          measurementIds: [],
        };
        rows.set(key, row);
      }

      row.measurementCount++;
      row.measurementIds.push(m.id);
      if (m.status === "completed") {
        row.completedCount++;
        row.completedDate = maxDate(row.completedDate, m.updated_at);
      }

      const firstLog = (m.work_logs || [])
        .map((wl: any) => wl.work_date || wl.created_at)
        .filter(Boolean)
        .sort()[0];
      row.startDate = minDate(row.startDate, m.planned_start_date || firstLog);

      const hours = measurementHours(m);
      row.hours += hours;
      row.cost += hours * (m.measurement_services?.hourly_rate || 0);
    }
  }

  // Probenanzahl je Zeile: eindeutige Proben der zugehörigen Aufgaben,
  // ersatzweise die dem Auftrag zugeordneten Proben.
  for (const order of orders || []) {
    const orderSampleIds = new Set<string>(
      [
        ...((order.order_samples || []).map((os: any) => os.sample_id)),
        order.sample_id,
      ].filter(Boolean)
    );
    for (const row of rows.values()) {
      if (row.orderId !== order.id) continue;
      const ids = new Set<string>();
      for (const m of order.order_measurements || []) {
        if ((m.service_id ?? m.id) !== (row.serviceId ?? m.id)) continue;
        if (row.serviceId && m.service_id !== row.serviceId) continue;
        if (m.sample_id) ids.add(m.sample_id);
      }
      row.sampleCount = ids.size > 0 ? ids.size : orderSampleIds.size;
    }
  }

  for (const row of rows.values()) {
    if (row.measurementCount === 0) row.status = "planned";
    else if (row.completedCount === row.measurementCount) row.status = "completed";
    else if (row.completedCount > 0) row.status = "partially_completed";
    else if (row.measurementIds.length > 0 && row.hours > 0) row.status = "in_progress";
    else row.status = "open";
  }

  // Status „in Bearbeitung" hat Vorrang, sobald eine Aufgabe aktiv ist.
  for (const order of orders || []) {
    for (const m of order.order_measurements || []) {
      if (m.status !== "in_progress") continue;
      const key = `${order.id}::${m.service_id ?? m.id}`;
      const row = rows.get(key);
      if (row && row.status !== "completed" && row.status !== "partially_completed") {
        row.status = "in_progress";
      }
    }
  }

  // Zeiterfassung, die direkt auf einen Auftrag gebucht wurde, fließt in die
  // Dienstleistungszeilen dieses Auftrags ein (einmalig, keine Doppelzählung).
  const orderIds = new Set((orders || []).map((o: any) => o.id));
  const timeByOrder = new Map<string, number>();
  for (const e of timeEntries || []) {
    if (!e?.order_id || !orderIds.has(e.order_id)) continue;
    timeByOrder.set(
      e.order_id,
      (timeByOrder.get(e.order_id) || 0) + Number(e.duration_minutes || 0) / 60
    );
  }

  for (const [orderId, hours] of timeByOrder) {
    if (hours <= 0) continue;
    const order = (orders || []).find((o: any) => o.id === orderId);
    const orderRows = Array.from(rows.values()).filter((r) => r.orderId === orderId);
    if (orderRows.length === 1) {
      const r = orderRows[0];
      const rate = r.hours > 0 ? r.cost / r.hours : 0;
      r.hours += hours;
      r.cost += hours * rate;
      if (r.status === "planned" || r.status === "open") r.status = "in_progress";
      continue;
    }
    // Mehrere oder keine Dienstleistungen: transparente eigene Zeile je Auftrag.
    const key = `${orderId}::__time__`;
    rows.set(key, {
      key,
      orderId,
      orderNumber: order?.order_number || "–",
      serviceId: null,
      serviceName: "Auftragszeiten (Zeiterfassung)",
      sampleCount: 0,
      measurementCount: 0,
      completedCount: 0,
      status: "in_progress",
      startDate: null,
      completedDate: null,
      hours,
      cost: 0,
      measurementIds: [],
    });
  }

  return Array.from(rows.values()).sort(
    (a, b) =>
      a.orderNumber?.localeCompare(b.orderNumber || "") ||
      a.serviceName.localeCompare(b.serviceName)
  );
}

/** Stunden aus Zeiterfassung, die KEINEM Auftrag des Projekts zugeordnet sind. */
export function unlinkedTimeEntryHours(orders: any[], timeEntries: any[]): number {
  const orderIds = new Set((orders || []).map((o: any) => o.id));
  return (timeEntries || [])
    .filter((e: any) => !e?.order_id || !orderIds.has(e.order_id))
    .reduce((s: number, e: any) => s + Number(e.duration_minutes || 0) / 60, 0);
}

export const BOOKED_SERVICE_STATUS_LABEL: Record<BookedServiceStatus, string> = {
  planned: "geplant",
  open: "offen",
  in_progress: "in Bearbeitung",
  partially_completed: "teilweise erledigt",
  completed: "erledigt",
  cancelled: "abgebrochen",
};
