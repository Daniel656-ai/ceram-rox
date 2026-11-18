import { normalizePriority } from "@/lib/orders/priority";
import { resolveOrderKind } from "@/lib/orders/orderKind";
import type { FormState } from "@/lib/orders/createOrderFlow";

/**
 * Bearbeiten-Modus der Seite „Auftrag erstellen“ (Aufgabe 012, Stufe 1): reine Logik ohne Oberfläche.
 *
 *  - snapshotFromOrder / formStateFromOrder: bestehender Auftrag -> Maskenstand (derselbe Zustand wie ein Entwurf)
 *  - diffOrderEdit: EINE Stelle, die „was hat sich geändert?“ weiß (Ausgangsstand ↔ aktueller Stand)
 *  - deriveLocks: Sperr-Angaben der Datenbank (order_edit_facts) für die Maske
 * Die Datenbankfunktion apply_order_changes prüft alle Sperren erneut serverseitig.
 */

/** Antwort der Datenbankfunktion order_edit_facts. */
export interface OrderEditFacts {
  order_id: string;
  order_number: string | null;
  order_type: string;
  order_kind: string | null;
  status: string;
  workflow_status: string | null;
  project_id: string | null;
  created_by: string | null;
  updated_at: string;
  is_billed: boolean;
  is_master: boolean;
  can_edit: boolean;
  internal: boolean;
  locked: boolean;
  started: boolean;
  type_locked: boolean;
  project_locked: boolean;
  measurements: Array<{
    measurement_id: string;
    measurement_number: string | null;
    service_id: string | null;
    service_name: string | null;
    sample_id: string | null;
    status: string;
    untouched: boolean;
    blockers: string[];
    counts: Record<string, number>;
  }>;
  samples: Array<{
    sample_id: string;
    sample_number: string | null;
    sample_name: string | null;
    locked: boolean;
    reasons: string[];
  }>;
}

/** Änderungspaket für die Datenbankfunktion apply_order_changes. */
export interface OrderChanges {
  expected_updated_at?: string;
  header?: {
    order_type?: string;
    project_id?: string | null;
    priority?: string;
    due_date?: string | null;
    notes?: string | null;
  };
  samples?: { add?: string[]; remove?: string[] };
  /** Stufe 3a: Dienstleistungen (alle Aufgaben) entfernen – serverseitig streng geprüft. */
  services?: { remove?: string[] };
  template?: {
    form_definition_id: string | null;
    values: Record<string, unknown>;
    experiment_number?: string | null;
  };
}

/** Die änderbaren Teile eines Auftrags (Ausgangsstand und aktueller Stand haben dieselbe Form). */
export interface EditSnapshot {
  orderType: string;
  projectId: string;
  priority: string;
  dueDate: string;
  notes: string;
  sampleIds: string[];
  templateFormId: string | null;
  templateValues: Record<string, unknown>;
  isBilled: boolean;
}

const dateOnly = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : "");

/** Stand eines bestehenden Auftrags (Auftragsdaten wie von api.orders.get geliefert). */
export function snapshotFromOrder(order: any): EditSnapshot {
  const fromJoin: string[] = ((order?.order_samples ?? []) as any[])
    .map((os) => os.sample_id as string)
    .filter(Boolean);
  const sampleIds = fromJoin.length > 0 ? fromJoin : order?.sample_id ? [order.sample_id as string] : [];
  const tpl = (order?.shared_form_data as { template?: { values?: Record<string, unknown>; form_definition_id?: string } } | null)?.template;
  return {
    orderType: order?.order_type ?? "",
    projectId: order?.project_id ?? "",
    priority: normalizePriority(order?.priority),
    dueDate: dateOnly(order?.due_date),
    notes: order?.notes ?? "",
    sampleIds,
    templateFormId: tpl?.form_definition_id ?? null,
    templateValues: (tpl?.values ?? {}) as Record<string, unknown>,
    isBilled: order?.is_billed === true,
  };
}

/** Maskenstand eines bestehenden Auftrags (Dienstleistungs-Karten bleiben in Stufe 1 schreibgeschützt und leer). */
export function formStateFromOrder(order: any): FormState & { isBilled: boolean } {
  const s = snapshotFromOrder(order);
  return {
    selectedProjectId: s.projectId,
    orderType: s.orderType,
    orderKind: resolveOrderKind(order) === "pilot_plant" ? "pilot_plant" : "labor",
    priority: s.priority,
    dueDate: s.dueDate,
    notes: s.notes,
    measurements: [],
    selectedSampleIds: s.sampleIds,
    processTemplateId: "__none__",
    measurementParams: {},
    measurementFormValues: {},
    dynamicValues: s.templateValues as Record<string, any>,
    dynamicFormId: s.templateFormId,
    serviceTab: { active: null, order: [] },
    isBilled: s.isBilled,
  };
}

const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Stabile, schlüsselsortierte Darstellung ohne leere Werte – damit „nicht angefasst“ nie als Änderung gilt. */
export function canonicalValues(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      return Object.fromEntries(
        Object.entries(x as Record<string, unknown>)
          .filter(([, val]) => !isEmptyValue(val))
          .map(([k, val]) => [k, norm(val)] as const)
          .sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return x;
  };
  return JSON.stringify(norm(v));
}

export interface EditDiff {
  /** null = nichts geändert. */
  changes: OrderChanges | null;
  /** Verrechnet-Kennzeichen (nur Kunde) – läuft über die bestehende eigene Funktion set_order_billed. */
  billedChange: boolean | null;
  reasonRequired: boolean;
  /** Warum eine Begründung nötig ist (für den Hinweistext). */
  reasonWhy: string[];
  /** Verständliche Zeilen für „Was wird geändert?“ */
  lines: string[];
  /** Mindestlänge der Begründung (5 beim Entfernen von Dienstleistungen, sonst 1). */
  reasonMinLength: number;
}

export interface DiffContext {
  started: boolean;
  /** Versuchsnummer aus dem Auftragsformular (nur gesetzt, wenn eindeutig bestimmbar). */
  experimentNumber?: string | null;
  expectedUpdatedAt?: string;
  /** Zum Entfernen vorgemerkte Dienstleistungen (Stufe 3a). */
  removeServices?: Array<{ id: string; name: string; tasks?: number }>;
  labels?: {
    orderType?: (v: string) => string;
    project?: (id: string) => string;
    sample?: (id: string) => string;
    priority?: (v: string) => string;
  };
}

/** Berechnet die Änderungen zwischen Ausgangsstand und aktuellem Stand (reine Funktion, getestet). */
export function diffOrderEdit(base: EditSnapshot, cur: EditSnapshot, ctx: DiffContext): EditDiff {
  const L = {
    orderType: ctx.labels?.orderType ?? ((v: string) => v),
    project: ctx.labels?.project ?? ((id: string) => id || "kein Projekt"),
    sample: ctx.labels?.sample ?? ((id: string) => id),
    priority: ctx.labels?.priority ?? ((v: string) => v),
  };
  const header: NonNullable<OrderChanges["header"]> = {};
  const lines: string[] = [];
  const why: string[] = [];

  if (cur.orderType !== base.orderType) {
    header.order_type = cur.orderType;
    lines.push(`Auftragstyp: ${L.orderType(base.orderType)} → ${L.orderType(cur.orderType)}`);
    why.push("Auftragstyp geändert");
  }
  if (cur.projectId !== base.projectId) {
    header.project_id = cur.projectId || null;
    lines.push(`Projekt: ${L.project(base.projectId)} → ${L.project(cur.projectId)}`);
    why.push("Projekt geändert");
  }
  if (cur.priority !== base.priority) {
    header.priority = cur.priority;
    lines.push(`Priorität: ${L.priority(base.priority)} → ${L.priority(cur.priority)}`);
  }
  if (cur.dueDate !== base.dueDate) {
    header.due_date = cur.dueDate || null;
    lines.push(`Fälligkeit: ${base.dueDate || "–"} → ${cur.dueDate || "–"}`);
  }
  if (cur.notes.trim() !== base.notes.trim()) {
    header.notes = cur.notes.trim() ? cur.notes : null;
    lines.push("Anmerkungen geändert");
  }

  const add = cur.sampleIds.filter((id) => !base.sampleIds.includes(id));
  const remove = base.sampleIds.filter((id) => !cur.sampleIds.includes(id));
  if (add.length) lines.push(`Probe(n) hinzugefügt: ${add.map(L.sample).join(", ")}`);
  if (remove.length) {
    lines.push(`Probe(n) entfernt: ${remove.map(L.sample).join(", ")}`);
    why.push("Probe entfernt");
  }

  let template: OrderChanges["template"];
  if (canonicalValues(cur.templateValues) !== canonicalValues(base.templateValues)) {
    template = { form_definition_id: cur.templateFormId ?? base.templateFormId, values: cur.templateValues };
    if (ctx.experimentNumber) template.experiment_number = ctx.experimentNumber;
    lines.push("Auftragsformular geändert");
    if (ctx.started) why.push("Auftragsformular eines begonnenen Auftrags geändert");
  }

  const removeServices = ctx.removeServices ?? [];
  if (removeServices.length) {
    lines.push(
      `Dienstleistung(en) entfernt: ${removeServices
        .map((s) => (s.tasks ? `${s.name} (${s.tasks} ${s.tasks === 1 ? "Aufgabe" : "Aufgaben"})` : s.name))
        .join(", ")}`,
    );
    why.push("Dienstleistung entfernt");
  }

  // Verrechnet gilt nur für Kunden; der Wechsel weg von „Kunde“ setzt es serverseitig zurück.
  let billedChange: boolean | null = null;
  if (cur.orderType === "customer") {
    const baseBilled = base.orderType === "customer" ? base.isBilled : false;
    if (cur.isBilled !== baseBilled) {
      billedChange = cur.isBilled;
      lines.push(`Verrechnet: ${baseBilled ? "ja" : "nein"} → ${cur.isBilled ? "ja" : "nein"}`);
    }
  } else if (base.orderType === "customer" && base.isBilled) {
    lines.push("Verrechnet-Kennzeichen wird entfernt (kein Kundenauftrag mehr)");
  }

  const hasServerChanges =
    Object.keys(header).length > 0 || add.length > 0 || remove.length > 0 || !!template || removeServices.length > 0;
  const changes: OrderChanges | null = hasServerChanges
    ? {
        ...(ctx.expectedUpdatedAt ? { expected_updated_at: ctx.expectedUpdatedAt } : {}),
        ...(Object.keys(header).length ? { header } : {}),
        ...(add.length || remove.length ? { samples: { ...(add.length ? { add } : {}), ...(remove.length ? { remove } : {}) } } : {}),
        ...(template ? { template } : {}),
        ...(removeServices.length ? { services: { remove: removeServices.map((s) => s.id) } } : {}),
      }
    : null;

  return {
    changes, billedChange, reasonRequired: why.length > 0, reasonWhy: why, lines,
    /** Beim Entfernen von Dienstleistungen verlangt die Datenbank mindestens 5 Zeichen. */
    reasonMinLength: removeServices.length ? 5 : 1,
  };
}

/** Sperr-Angaben für die Maske, abgeleitet aus order_edit_facts. */
export interface OrderLocks {
  canEdit: boolean;
  /** Warum nichts bearbeitbar ist (nur gesetzt, wenn canEdit false). */
  blockedReason: string | null;
  typeLocked: boolean;
  projectLocked: boolean;
  lockedSampleIds: Set<string>;
  started: boolean;
}

export function deriveLocks(facts: OrderEditFacts | null | undefined): OrderLocks {
  if (!facts) {
    return { canEdit: false, blockedReason: null, typeLocked: true, projectLocked: true, lockedSampleIds: new Set(), started: false };
  }
  let blockedReason: string | null = null;
  if (!facts.can_edit) {
    blockedReason = facts.locked
      ? "Der Auftrag ist abgeschlossen und schreibgeschützt."
      : facts.internal
        ? "Interne Prüfaufträge werden in der Prüfmittelüberwachung bearbeitet."
        : "Nur der Ersteller und Master dürfen diesen Auftrag bearbeiten.";
  }
  return {
    canEdit: facts.can_edit,
    blockedReason,
    typeLocked: !facts.can_edit || facts.type_locked,
    projectLocked: !facts.can_edit || facts.project_locked,
    lockedSampleIds: new Set(facts.samples.filter((s) => s.locked).map((s) => s.sample_id)),
    started: facts.started,
  };
}

/** Text zu einem Sperrgrund einer Aufgabe (Anzeige in den schreibgeschützten Dienstleistungs-Karten). */
export const BLOCKER_TEXT: Record<string, string> = {
  order_locked: "Auftrag gesperrt",
  status_not_open: "Aufgabe bereits begonnen",
  results: "Ergebnisse vorhanden",
  raw_data: "Rohdaten vorhanden",
  corrections: "Korrekturen vorhanden",
  work_logs: "Arbeitszeit gebucht",
  documents: "Dokumente vorhanden",
  uploads: "Dateien hochgeladen",
};

/* ---- Anzeige im Verlauf des Auftrags ---- */

const FIELD_LABELS: Record<string, string> = {
  order_type: "Auftragstyp",
  project_id: "Projekt",
  due_date: "Fälligkeit",
  notes: "Anmerkungen",
  priority: "Priorität",
  status: "Status",
  samples_added: "Proben hinzugefügt",
  samples_removed: "Proben entfernt",
  services_removed: "Dienstleistungen entfernt",
  template: "Auftragsformular",
};
const TYPE_LABELS: Record<string, string> = { customer: "Kunde", production: "Produktion", rnd: "F&E", internal: "Intern" };

/** Lesbare Bezeichnung eines Feldnamens aus order_audit_log. */
export const auditFieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

/** Lesbarer Wert eines Audit-Eintrags (nur dort nötig, wo der gespeicherte Wert technisch ist). */
export function auditValueLabel(field: string, value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (field === "order_type") return TYPE_LABELS[value] ?? value;
  return value;
}

/** Text zu einem Aktivitäts-Ereignis „order_updated“ (Bearbeiten-Modus), z. B. „Auftragstyp, Proben (+P2 −P1) · „Grund““. */
export function describeOrderUpdate(meta: Record<string, any> | null | undefined): string {
  const m = meta ?? {};
  const fields: string[] = Array.isArray(m.fields) ? m.fields : [];
  const added: string[] = Array.isArray(m.samples_added) ? m.samples_added : [];
  const removed: string[] = Array.isArray(m.samples_removed) ? m.samples_removed : [];
  const parts = fields
    .filter((f) => f !== "samples_added" && f !== "samples_removed" && f !== "services_removed")
    .map((f) => auditFieldLabel(f));
  if (added.length || removed.length) {
    parts.push(
      `Proben (${[added.length ? `+${added.join(", +")}` : "", removed.length ? `−${removed.join(", −")}` : ""].filter(Boolean).join(" ")})`,
    );
  }
  const svc: string[] = Array.isArray(m.services_removed) ? m.services_removed : [];
  if (svc.length) parts.push(`Dienstleistung(en) entfernt (${svc.join(", ")})`);
  const reason = typeof m.reason === "string" && m.reason.trim() ? ` · „${m.reason.trim()}“` : "";
  return `${parts.join(", ") || "Auftrag"}${reason}`;
}

/* ---- Dienstleistungen entfernen (Stufe 3a) ---- */

export interface ServiceRemovalInfo {
  serviceId: string;
  name: string;
  /** Aufgaben dieser Dienstleistung (je Probe eine). */
  tasks: Array<{ id: string; number: string | null; sample: string | null; untouched: boolean; blockers: string[] }>;
  /** Alle Aufgaben unberührt und Auftrag bearbeitbar. */
  removable: boolean;
  /** Warum nicht entfernbar (nur bei removable = false). */
  blockedReason: string | null;
  /** Dienstleistungen, die mit entfernt werden müssen (Folgeaufgaben aus Regeln). */
  requires: string[];
}

/**
 * Pro Dienstleistung: Aufgaben, Sperrstatus (aus order_edit_facts) und Folgeaufgaben (Regeln,
 * order_measurements.source_measurement_id). Die Datenbank prüft alles erneut.
 */
export function serviceRemovalInfo(
  facts: OrderEditFacts | null | undefined,
  measurements: Array<{ id: string; service_id?: string | null; source_measurement_id?: string | null; measurement_services?: { service_name?: string | null } | null; samples?: { sample_number?: string | null } | null; measurement_number?: string | null }>,
): ServiceRemovalInfo[] {
  const factById = new Map((facts?.measurements ?? []).map((m) => [m.measurement_id, m]));
  const byService = new Map<string, ServiceRemovalInfo>();
  const serviceOfTask = new Map<string, string>();
  for (const m of measurements ?? []) {
    const sid = m.service_id ?? m.id;
    serviceOfTask.set(m.id, sid);
    if (!byService.has(sid)) {
      byService.set(sid, {
        serviceId: sid, name: m.measurement_services?.service_name || factById.get(m.id)?.service_name || "Dienstleistung",
        tasks: [], removable: true, blockedReason: null, requires: [],
      });
    }
    const f = factById.get(m.id);
    byService.get(sid)!.tasks.push({
      id: m.id, number: m.measurement_number ?? null, sample: m.samples?.sample_number ?? null,
      untouched: f ? f.untouched : false, blockers: f?.blockers ?? [],
    });
  }
  for (const m of measurements ?? []) {
    const src = m.source_measurement_id ? serviceOfTask.get(m.source_measurement_id) : undefined;
    const own = serviceOfTask.get(m.id)!;
    if (src && src !== own) {
      const base = byService.get(src)!;
      if (!base.requires.includes(own)) base.requires.push(own);
    }
  }
  for (const info of byService.values()) {
    if (!facts?.can_edit) { info.removable = false; info.blockedReason = "Der Auftrag kann nicht bearbeitet werden."; continue; }
    const touched = info.tasks.filter((t) => !t.untouched);
    if (touched.length) {
      info.removable = false;
      info.blockedReason = "Bereits in Bearbeitung: " + [...new Set(touched.flatMap((t) => t.blockers.map((b) => BLOCKER_TEXT[b] ?? b)))].join(", ");
    }
  }
  return [...byService.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Menge der zu entfernenden Dienstleistungen nach dem (De-)Markieren einer Dienstleistung; hält die Folgeaufgaben-Regel ein. */
export function toggleServiceRemoval(current: string[], serviceId: string, infos: ServiceRemovalInfo[]): string[] {
  const byId = new Map(infos.map((i) => [i.serviceId, i]));
  const set = new Set(current);
  if (set.has(serviceId)) {
    set.delete(serviceId);
    // Wer ohne diese Dienstleistung nicht mehr allein entfernt werden darf, geht ebenfalls zurück.
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...set]) {
        if ((byId.get(id)?.requires ?? []).some((r) => !set.has(r))) { set.delete(id); changed = true; }
      }
    }
  } else {
    const stack = [serviceId];
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      for (const r of byId.get(id)?.requires ?? []) stack.push(r);
    }
  }
  return [...set];
}

/** Prüft die Auswahl vor dem Speichern: alles entfernbar, Folgeaufgaben dabei, mindestens eine Dienstleistung bleibt. */
export function validateServiceRemoval(selected: string[], infos: ServiceRemovalInfo[]): string | null {
  if (selected.length === 0) return null;
  const byId = new Map(infos.map((i) => [i.serviceId, i]));
  for (const id of selected) {
    const i = byId.get(id);
    if (!i) return "Eine Dienstleistung gehört nicht mehr zum Auftrag. Bitte die Seite neu laden.";
    if (!i.removable) return `„${i.name}“ kann nicht entfernt werden: ${i.blockedReason ?? "gesperrt"}`;
    if (i.requires.some((r) => !selected.includes(r))) return `„${i.name}“ hat Folgeaufgaben, die mit entfernt werden müssen.`;
  }
  if (infos.every((i) => selected.includes(i.serviceId))) return "Es muss mindestens eine Dienstleistung im Auftrag bleiben.";
  return null;
}
