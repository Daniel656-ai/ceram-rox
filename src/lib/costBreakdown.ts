/**
 * Zentrale Kostenaufschlüsselung eines Projekts.
 *
 * WICHTIG: Diese Datei ändert KEINE bestehende Berechnung. Sie verwendet exakt
 * dieselbe Logik wie die Projektübersicht:
 *   Personal  = (actual_duration_hours bei abgeschlossenen Aufgaben, sonst Σ work_logs.hours)
 *               × measurement_services.hourly_rate
 *   Material  = project_consumables.total_cost + project_knetung_materials.total_cost
 *               + project_expenses.total_price (nach Kategorie aufgeteilt)
 * Es entstehen dadurch keine doppelten Kosten – Zeiteinträge (project_time_entries)
 * fließen bewusst NUR als Stunden ein, nie als zusätzliche Kosten.
 */

export type CostKind = "personnel" | "material" | "subcontract" | "other";

export type CostPosition = {
  id: string;
  kind: CostKind;
  taskKey: string | null; // measurement_number
  taskLabel: string;
  serviceName: string;
  personId: string | null;
  hours: number;
  rate: number;
  amount: number;
  note?: string;
};

export type TaskCost = {
  key: string;
  measurementId: string;
  measurementNumber: string;
  serviceName: string;
  personId: string | null;
  hours: number;
  rate: number;
  personnel: number;
  material: number;
  other: number;
  total: number;
  budget: number | null;
  positions: CostPosition[];
};

export type GroupCost = { key: string; label: string; hours: number; avgRate: number; total: number };

export type CostBreakdown = {
  positions: CostPosition[];
  tasks: TaskCost[];
  byPerson: GroupCost[];
  byService: GroupCost[];
  totals: {
    personnelHours: number;
    personnelAvgRate: number;
    personnel: number;
    material: number;
    subcontract: number;
    other: number;
    sum: number;
  };
  issues: string[];
};

const SUBCONTRACT_RE = /extern|fremd/i;
const OTHER_RE = /sonstige|reise|transport|versand|zertifiz|dokumentation|entsorgung|maschinen|gerät|geraet|personalaufwand/i;

function classifyExpense(categoryName: string | null | undefined): CostKind {
  const n = categoryName || "";
  if (SUBCONTRACT_RE.test(n)) return "subcontract";
  if (OTHER_RE.test(n)) return "other";
  return "material";
}

export function measurementHours(m: any): { hours: number; source: "actual" | "worklogs" } {
  const workLogHours = (m.work_logs || []).reduce((s: number, wl: any) => s + Number(wl.hours || 0), 0);
  const useActual = m.status === "completed" && m.actual_duration_hours != null;
  return { hours: useActual ? Number(m.actual_duration_hours) : workLogHours, source: useActual ? "actual" : "worklogs" };
}

export function buildCostBreakdown(input: {
  measurements: any[];
  timeEntries: any[];
  consumables: any[];
  knetung: any[];
  expenses: any[];
}): CostBreakdown {
  const { measurements, timeEntries, consumables, knetung, expenses } = input;
  const positions: CostPosition[] = [];
  const tasks = new Map<string, TaskCost>();
  const issues: string[] = [];

  for (const m of measurements) {
    const rate = Number(m.measurement_services?.hourly_rate || 0);
    const serviceName = m.measurement_services?.service_name || "–";
    const { hours, source } = measurementHours(m);
    const cost = hours * rate;
    const plannedHours = Number(m.planned_hours ?? m.processing_time_hours ?? 0);

    const task: TaskCost = {
      key: m.measurement_number || m.id,
      measurementId: m.id,
      measurementNumber: m.measurement_number || "–",
      serviceName,
      personId: m.assigned_to || null,
      hours,
      rate,
      personnel: cost,
      material: 0,
      other: 0,
      total: cost,
      budget: plannedHours > 0 && rate > 0 ? plannedHours * rate : null,
      positions: [],
    };

    if (source === "worklogs" && (m.work_logs || []).length > 0) {
      for (const wl of m.work_logs) {
        const p: CostPosition = {
          id: `wl-${wl.id}`,
          kind: "personnel",
          taskKey: task.key,
          taskLabel: task.measurementNumber,
          serviceName,
          personId: wl.user_id || null,
          hours: Number(wl.hours || 0),
          rate,
          amount: Number(wl.hours || 0) * rate,
          note: wl.comment || undefined,
        };
        positions.push(p);
        task.positions.push(p);
      }
    } else if (hours > 0) {
      const p: CostPosition = {
        id: `m-${m.id}`,
        kind: "personnel",
        taskKey: task.key,
        taskLabel: task.measurementNumber,
        serviceName,
        personId: m.assigned_to || null,
        hours,
        rate,
        amount: cost,
        note: source === "actual" ? "Ist-Dauer bei Abschluss" : undefined,
      };
      positions.push(p);
      task.positions.push(p);
    }

    if (hours > 0 && rate <= 0) issues.push(`${task.measurementNumber}: Kein Stundensatz an der Dienstleistung hinterlegt.`);
    if (m.status === "completed" && hours <= 0) issues.push(`${task.measurementNumber}: Abgeschlossen, aber keine Stunden erfasst.`);

    tasks.set(task.key, task);
  }

  const attach = (p: CostPosition, measurementId: string | null) => {
    positions.push(p);
    if (!measurementId) return;
    const task = Array.from(tasks.values()).find((tk) => tk.measurementId === measurementId);
    if (!task) return;
    p.taskKey = task.key;
    p.taskLabel = task.measurementNumber;
    task.positions.push(p);
    if (p.kind === "material") task.material += p.amount;
    else task.other += p.amount;
    task.total = task.personnel + task.material + task.other;
  };

  for (const c of consumables as any[]) {
    attach(
      {
        id: `con-${c.id}`,
        kind: "material",
        taskKey: null,
        taskLabel: "–",
        serviceName: "–",
        personId: null,
        hours: 0,
        rate: 0,
        amount: Number(c.total_cost || 0),
        note: c.consumables?.name || c.name || "Verbrauchsmaterial",
      },
      c.order_measurement_id || null
    );
  }

  for (const k of knetung as any[]) {
    attach(
      {
        id: `kn-${k.id}`,
        kind: "material",
        taskKey: null,
        taskLabel: "–",
        serviceName: "–",
        personId: null,
        hours: 0,
        rate: 0,
        amount: Number(k.total_cost || 0),
        note: k.raw_materials?.material_name || "Rohstoff (Knetung)",
      },
      k.order_measurement_id || null
    );
  }

  for (const e of expenses as any[]) {
    const cat = e.project_expense_categories?.name_de as string | undefined;
    positions.push({
      id: `exp-${e.id}`,
      kind: classifyExpense(cat),
      taskKey: null,
      taskLabel: "–",
      serviceName: "–",
      personId: null,
      hours: 0,
      rate: 0,
      amount: Number(e.total_price || 0),
      note: [e.name, cat].filter(Boolean).join(" · "),
    });
  }

  // Zeiteinträge, die auf einen Auftrag gebucht wurden, sind Personalstunden
  // dieses Auftrags. Sie stammen aus einer anderen Quelle als die Arbeitszeit-
  // protokolle (work_logs) und werden daher genau einmal gezählt.
  const timeByOrder = new Map<string, number>();
  for (const e of timeEntries as any[]) {
    if (!e?.order_id) continue;
    timeByOrder.set(e.order_id, (timeByOrder.get(e.order_id) || 0) + Number(e.duration_minutes || 0) / 60);
  }
  for (const [orderId, hours] of timeByOrder) {
    if (hours <= 0) continue;
    const orderTasks = measurements.filter((m: any) => m.order_id === orderId);
    if (orderTasks.length === 0) continue; // Auftrag gehört nicht zu diesem Projekt
    const rate = orderTasks.length === 1 ? Number(orderTasks[0].measurement_services?.hourly_rate || 0) : 0;
    const first = orderTasks[0];
    const key = first.measurement_number || first.id;
    const task = tasks.get(key);
    const p: CostPosition = {
      id: `te-${orderId}`,
      kind: "personnel",
      taskKey: orderTasks.length === 1 ? key : null,
      taskLabel: orderTasks.length === 1 ? task?.measurementNumber || "–" : "–",
      serviceName: orderTasks.length === 1 ? task?.serviceName || "–" : "Auftragszeiten (Zeiterfassung)",
      personId: null,
      hours,
      rate,
      amount: hours * rate,
      note: "Zeiterfassung auf Auftrag",
    };
    positions.push(p);
    if (orderTasks.length === 1 && task) {
      task.positions.push(p);
      task.hours += hours;
      task.personnel += p.amount;
      task.total = task.personnel + task.material + task.other;
    }
  }

  const unassignedTimeEntries = (timeEntries as any[]).filter((e) => !e.work_package_id && !e.order_id).length;
  if (unassignedTimeEntries > 0) {
    issues.push(`${unassignedTimeEntries} Zeiteintrag/Zeiteinträge ohne Zuordnung zu Auftrag oder Arbeitspaket.`);
  }

  const sumBy = (kind: CostKind) => positions.filter((p) => p.kind === kind).reduce((s, p) => s + p.amount, 0);
  const personnel = sumBy("personnel");
  const material = sumBy("material");
  const subcontract = sumBy("subcontract");
  const other = sumBy("other");
  const personnelHours = positions.filter((p) => p.kind === "personnel").reduce((s, p) => s + p.hours, 0);

  const group = (keyFn: (p: CostPosition) => string | null): GroupCost[] => {
    const map = new Map<string, { hours: number; total: number }>();
    for (const p of positions.filter((x) => x.kind === "personnel")) {
      const k = keyFn(p);
      if (!k) continue;
      const cur = map.get(k) || { hours: 0, total: 0 };
      cur.hours += p.hours;
      cur.total += p.amount;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, label: key, hours: v.hours, avgRate: v.hours > 0 ? v.total / v.hours : 0, total: v.total }))
      .sort((a, b) => b.total - a.total);
  };

  return {
    positions,
    tasks: Array.from(tasks.values()).sort((a, b) => b.total - a.total),
    byPerson: group((p) => p.personId),
    byService: group((p) => p.serviceName),
    totals: {
      personnelHours,
      personnelAvgRate: personnelHours > 0 ? personnel / personnelHours : 0,
      personnel,
      material,
      subcontract,
      other,
      sum: personnel + material + subcontract + other,
    },
    issues,
  };
}
