import { describe, it, expect } from "vitest";
import {
  auditFieldLabel,
  auditValueLabel,
  canonicalValues,
  deriveLocks,
  describeOrderUpdate,
  diffOrderEdit,
  formStateFromOrder,
  snapshotFromOrder,
  type EditSnapshot,
  type OrderEditFacts,
} from "@/lib/orders/orderEdit";

const order = (over: Record<string, unknown> = {}) => ({
  id: "o1", order_type: "customer", project_id: "p1", priority: "normal", due_date: "2026-12-01", notes: "alt",
  is_billed: true, order_kind: "labor", sample_id: "s1",
  order_samples: [{ sample_id: "s1" }, { sample_id: "s2" }],
  shared_form_data: { template: { form_definition_id: "f1", order_kind: "labor", values: { a: 1, leer: "" } } },
  ...over,
});

const base = (): EditSnapshot => snapshotFromOrder(order());

describe("Ausgangsstand aus dem Auftrag", () => {
  it("übernimmt Kopfdaten, Proben, Auftragsformular und Verrechnet", () => {
    expect(snapshotFromOrder(order())).toEqual({
      orderType: "customer", projectId: "p1", priority: "normal", dueDate: "2026-12-01", notes: "alt",
      sampleIds: ["s1", "s2"], templateFormId: "f1", templateValues: { a: 1, leer: "" }, isBilled: true,
    });
  });

  it("ohne Zuordnungszeilen gilt die Hauptprobe; fehlende Werte werden zu leeren Standardwerten", () => {
    const s = snapshotFromOrder({ order_type: "rnd", order_samples: [], sample_id: "x", due_date: null, notes: null, project_id: null });
    expect(s.sampleIds).toEqual(["x"]);
    expect(s).toMatchObject({ projectId: "", dueDate: "", notes: "", templateFormId: null, templateValues: {}, isBilled: false });
  });

  it("alte Prioritätswerte werden wie in der Anzeige normalisiert", () => {
    expect(snapshotFromOrder(order({ priority: "wichtig" })).priority).toBe("hoch");
    expect(snapshotFromOrder(order({ priority: "hoechste" })).priority).toBe("sehr_hoch");
  });

  it("Maskenstand: gleiche Felder wie ein Entwurf, Dienstleistungs-Karten bleiben leer (nur lesbar)", () => {
    const st = formStateFromOrder(order({ order_kind: "pilot_plant" }));
    expect(st).toMatchObject({
      selectedProjectId: "p1", orderType: "customer", priority: "normal", dueDate: "2026-12-01", notes: "alt",
      selectedSampleIds: ["s1", "s2"], dynamicFormId: "f1", dynamicValues: { a: 1, leer: "" }, isBilled: true,
      measurements: [], measurementParams: {}, measurementFormValues: {}, processTemplateId: "__none__",
    });
    expect(st.orderKind).toBe("pilot_plant");
    expect(formStateFromOrder(order()).orderKind).toBe("labor");
  });
});

describe("Änderungen berechnen (diffOrderEdit)", () => {
  const ctx = { started: false };

  it("unverändert -> keine Änderung", () => {
    const d = diffOrderEdit(base(), base(), ctx);
    expect(d.changes).toBeNull();
    expect(d.billedChange).toBeNull();
    expect(d.lines).toEqual([]);
    expect(d.reasonRequired).toBe(false);
  });

  it("nur geänderte Kopffelder werden gesendet; Priorität/Fälligkeit/Anmerkungen brauchen keine Begründung", () => {
    const cur = { ...base(), priority: "hoch", dueDate: "", notes: "neu" };
    const d = diffOrderEdit(base(), cur, ctx);
    expect(d.changes).toEqual({ header: { priority: "hoch", due_date: null, notes: "neu" } });
    expect(d.reasonRequired).toBe(false);
    expect(d.lines).toHaveLength(3);
  });

  it("Anmerkungen nur mit Leerzeichen geändert zählen nicht", () => {
    expect(diffOrderEdit(base(), { ...base(), notes: "alt  " }, ctx).changes).toBeNull();
  });

  it("Typ- und Projektwechsel verlangen eine Begründung und nennen den Grund", () => {
    const d = diffOrderEdit(base(), { ...base(), orderType: "production", projectId: "" }, ctx);
    expect(d.changes?.header).toEqual({ order_type: "production", project_id: null });
    expect(d.reasonRequired).toBe(true);
    expect(d.reasonWhy).toEqual(["Auftragstyp geändert", "Projekt geändert"]);
  });

  it("Proben: hinzufügen ohne, entfernen mit Begründung", () => {
    const add = diffOrderEdit(base(), { ...base(), sampleIds: ["s1", "s2", "s3"] }, ctx);
    expect(add.changes?.samples).toEqual({ add: ["s3"] });
    expect(add.reasonRequired).toBe(false);
    const rem = diffOrderEdit(base(), { ...base(), sampleIds: ["s1"] }, ctx);
    expect(rem.changes?.samples).toEqual({ remove: ["s2"] });
    expect(rem.reasonRequired).toBe(true);
    const swap = diffOrderEdit(base(), { ...base(), sampleIds: ["s1", "s9"] }, ctx);
    expect(swap.changes?.samples).toEqual({ add: ["s9"], remove: ["s2"] });
  });

  it("Auftragsformular: leere Werte zählen nicht als Änderung; Begründung nur bei begonnenem Auftrag", () => {
    const same = diffOrderEdit(base(), { ...base(), templateValues: { a: 1, neu_leer: "", liste: [] } }, ctx);
    expect(same.changes).toBeNull();
    const changed = { ...base(), templateValues: { a: 2 } };
    const idle = diffOrderEdit(base(), changed, { started: false });
    expect(idle.changes?.template).toEqual({ form_definition_id: "f1", values: { a: 2 } });
    expect(idle.reasonRequired).toBe(false);
    const started = diffOrderEdit(base(), changed, { started: true });
    expect(started.reasonRequired).toBe(true);
  });

  it("Versuchsnummer wird nur mitgegeben, wenn sie eindeutig bestimmbar ist", () => {
    const changed = { ...base(), templateValues: { a: 2 } };
    expect(diffOrderEdit(base(), changed, { started: false, experimentNumber: "V9" }).changes?.template?.experiment_number).toBe("V9");
    expect(diffOrderEdit(base(), changed, { started: false }).changes?.template).not.toHaveProperty("experiment_number");
  });

  it("Verrechnet läuft getrennt über die eigene Funktion und gilt nur für Kunden", () => {
    const d = diffOrderEdit(base(), { ...base(), isBilled: false }, ctx);
    expect(d.changes).toBeNull();
    expect(d.billedChange).toBe(false);
    // weg von „Kunde“: serverseitig zurückgesetzt, kein eigener Aufruf
    const away = diffOrderEdit(base(), { ...base(), orderType: "production" }, ctx);
    expect(away.billedChange).toBeNull();
    expect(away.lines.some((l) => l.includes("Verrechnet-Kennzeichen wird entfernt"))).toBe(true);
    // hin zu „Kunde“ mit „verrechnet“
    const prodBase = snapshotFromOrder(order({ order_type: "production", is_billed: false }));
    const to = diffOrderEdit(prodBase, { ...prodBase, orderType: "customer", isBilled: true }, ctx);
    expect(to.billedChange).toBe(true);
    expect(to.changes?.header?.order_type).toBe("customer");
  });

  it("gibt den Zeitstempel des Ausgangsstands für die Prüfung auf zwischenzeitliche Änderungen mit", () => {
    const d = diffOrderEdit(base(), { ...base(), priority: "hoch" }, { started: false, expectedUpdatedAt: "2026-11-18T10:00:00Z" });
    expect(d.changes?.expected_updated_at).toBe("2026-11-18T10:00:00Z");
  });

  it("verständliche Zeilen mit Bezeichnungen aus der Maske", () => {
    const d = diffOrderEdit(base(), { ...base(), orderType: "production", sampleIds: ["s1", "s3"] }, {
      started: false,
      labels: { orderType: (v) => ({ customer: "Kunde", production: "Produktion" } as any)[v] ?? v, sample: (id) => `P-${id}` },
    });
    expect(d.lines).toContain("Auftragstyp: Kunde → Produktion");
    expect(d.lines).toContain("Probe(n) hinzugefügt: P-s3");
    expect(d.lines).toContain("Probe(n) entfernt: P-s2");
  });

  it("canonicalValues ignoriert Reihenfolge und leere Werte", () => {
    expect(canonicalValues({ b: 1, a: { y: "", x: 2 } })).toBe(canonicalValues({ a: { x: 2 }, b: 1, c: null }));
    expect(canonicalValues({ a: 1 })).not.toBe(canonicalValues({ a: 2 }));
  });
});

describe("Sperren", () => {
  const facts = (over: Partial<OrderEditFacts> = {}): OrderEditFacts => ({
    order_id: "o1", order_number: "A1", order_type: "customer", order_kind: "labor", status: "open", workflow_status: "entwurf",
    project_id: null, created_by: "u", updated_at: "2026-11-18T10:00:00Z", is_billed: false, is_master: false, can_edit: true,
    internal: false, locked: false, started: false, type_locked: false, project_locked: false,
    measurements: [], samples: [
      { sample_id: "s1", sample_number: "P1", sample_name: "", locked: true, reasons: ["has_tasks"] },
      { sample_id: "s2", sample_number: "P2", sample_name: "", locked: false, reasons: [] },
    ], ...over,
  });

  it("unberührter Auftrag: alles bis auf Proben mit Aufgaben frei", () => {
    const l = deriveLocks(facts());
    expect(l).toMatchObject({ canEdit: true, typeLocked: false, projectLocked: false, started: false, blockedReason: null });
    expect([...l.lockedSampleIds]).toEqual(["s1"]);
  });

  it("begonnener Auftrag: Typ und Projekt gesperrt (auch für Master)", () => {
    const l = deriveLocks(facts({ started: true, type_locked: true, project_locked: true, is_master: true }));
    expect(l.typeLocked && l.projectLocked && l.started).toBe(true);
    expect(l.canEdit).toBe(true);
  });

  it("nicht bearbeitbar: Begründung je Fall; ohne Angaben ist alles gesperrt", () => {
    expect(deriveLocks(facts({ can_edit: false, locked: true })).blockedReason).toMatch(/abgeschlossen/);
    expect(deriveLocks(facts({ can_edit: false, internal: true })).blockedReason).toMatch(/Prüfmittel/);
    expect(deriveLocks(facts({ can_edit: false })).blockedReason).toMatch(/Ersteller und Master/);
    expect(deriveLocks(facts({ can_edit: false })).typeLocked).toBe(true);
    const none = deriveLocks(null);
    expect(none.canEdit).toBe(false);
    expect(none.typeLocked && none.projectLocked).toBe(true);
  });
});

describe("Anzeige im Verlauf", () => {
  it("Feldnamen und Werte lesbar", () => {
    expect(auditFieldLabel("order_type")).toBe("Auftragstyp");
    expect(auditFieldLabel("project_id")).toBe("Projekt");
    expect(auditFieldLabel("unbekannt")).toBe("unbekannt");
    expect(auditValueLabel("order_type", "rnd")).toBe("F&E");
    expect(auditValueLabel("notes", "text")).toBe("text");
    expect(auditValueLabel("notes", "")).toBeNull();
  });

  it("Ereignis „Auftrag geändert“ mit Feldern, Proben und Begründung", () => {
    expect(
      describeOrderUpdate({
        fields: ["order_type", "samples_added", "samples_removed", "template"],
        samples_added: ["P2"], samples_removed: ["P1"], reason: "Falsch angelegt",
      }),
    ).toBe("Auftragstyp, Auftragsformular, Proben (+P2 −P1) · „Falsch angelegt“");
    expect(describeOrderUpdate({ fields: ["notes"] })).toBe("Anmerkungen");
    expect(describeOrderUpdate(null)).toBe("Auftrag");
  });
});

import { serviceRemovalInfo, toggleServiceRemoval, validateServiceRemoval } from "@/lib/orders/orderEdit";

describe("Dienstleistungen entfernen (Stufe 3a)", () => {
  const facts = (over: Partial<OrderEditFacts> = {}, touched: string[] = []): OrderEditFacts => ({
    order_id: "o1", order_number: "A1", order_type: "customer", order_kind: "labor", status: "open", workflow_status: "entwurf",
    project_id: null, created_by: "u", updated_at: "2026-11-18T10:00:00Z", is_billed: false, is_master: false, can_edit: true,
    internal: false, locked: false, started: false, type_locked: false, project_locked: false, samples: [],
    measurements: ["m1", "m2", "m3", "m4"].map((id) => ({
      measurement_id: id, measurement_number: id.toUpperCase(), service_id: null, service_name: null, sample_id: null, status: "open",
      untouched: !touched.includes(id), blockers: touched.includes(id) ? ["work_logs"] : [], counts: {},
    })),
    ...over,
  });
  const ms = [
    { id: "m1", service_id: "rfa", measurement_services: { service_name: "RFA" }, samples: { sample_number: "P1" } },
    { id: "m2", service_id: "rfa", measurement_services: { service_name: "RFA" }, samples: { sample_number: "P2" } },
    { id: "m3", service_id: "bet", measurement_services: { service_name: "BET" }, samples: { sample_number: "P1" } },
    { id: "m4", service_id: "folge", source_measurement_id: "m3", measurement_services: { service_name: "Folge" }, samples: { sample_number: "P1" } },
  ];

  it("Diff: Entfernen verlangt Begründung (mind. 5 Zeichen), schickt die Dienstleistung und beschreibt die Folgen", () => {
    const base = snapshotFromOrder({ order_type: "customer", order_samples: [{ sample_id: "s1" }], sample_id: "s1" });
    const d = diffOrderEdit(base, base, { started: false, removeServices: [{ id: "rfa", name: "RFA", tasks: 2 }] });
    expect(d.changes?.services).toEqual({ remove: ["rfa"] });
    expect(d.reasonRequired).toBe(true);
    expect(d.reasonMinLength).toBe(5);
    expect(d.reasonWhy).toContain("Dienstleistung entfernt");
    expect(d.lines).toContain("Dienstleistung(en) entfernt: RFA (2 Aufgaben)");
    expect(diffOrderEdit(base, base, { started: false }).reasonMinLength).toBe(1);
    expect(diffOrderEdit(base, base, { started: false }).changes).toBeNull();
  });

  it("Info: unberührte Dienstleistungen sind entfernbar, begonnene nicht (mit Grund); Folgeaufgaben werden erkannt", () => {
    const info = serviceRemovalInfo(facts({}, ["m2"]), ms);
    const by = Object.fromEntries(info.map((i) => [i.serviceId, i]));
    expect(by.rfa.removable).toBe(false);
    expect(by.rfa.blockedReason).toMatch(/Arbeitszeit gebucht/);
    expect(by.rfa.tasks).toHaveLength(2);
    expect(by.bet.removable).toBe(true);
    expect(by.bet.requires).toEqual(["folge"]);
    expect(by.folge.requires).toEqual([]);
  });

  it("Info: nicht bearbeitbarer Auftrag oder fehlende Angaben -> nichts entfernbar", () => {
    expect(serviceRemovalInfo(facts({ can_edit: false }), ms).every((i) => !i.removable)).toBe(true);
    expect(serviceRemovalInfo(null, ms).every((i) => !i.removable)).toBe(true);
  });

  it("Markieren zieht Folgeaufgaben mit, Zurücknehmen nimmt davon abhängige wieder heraus", () => {
    const info = serviceRemovalInfo(facts(), ms);
    const on = toggleServiceRemoval([], "bet", info);
    expect(new Set(on)).toEqual(new Set(["bet", "folge"]));
    expect(new Set(toggleServiceRemoval(on, "folge", info))).toEqual(new Set());
    expect(toggleServiceRemoval([], "rfa", info)).toEqual(["rfa"]);
  });

  it("Prüfung: gesperrte, unvollständige und „alle entfernt“-Auswahl werden abgewiesen", () => {
    const info = serviceRemovalInfo(facts({}, ["m2"]), ms);
    expect(validateServiceRemoval([], info)).toBeNull();
    expect(validateServiceRemoval(["rfa"], info)).toMatch(/kann nicht entfernt werden/);
    expect(validateServiceRemoval(["bet"], info)).toMatch(/Folgeaufgaben/);
    expect(validateServiceRemoval(["bet", "folge"], info)).toBeNull();
    const all = serviceRemovalInfo(facts(), ms);
    expect(validateServiceRemoval(["rfa", "bet", "folge"], all)).toMatch(/mindestens eine Dienstleistung/);
    expect(validateServiceRemoval(["unbekannt"], all)).toMatch(/nicht mehr zum Auftrag/);
  });

  it("Verlauf: entfernte Dienstleistungen mit Namen", () => {
    expect(describeOrderUpdate({ fields: ["services_removed"], services_removed: ["RFA", "BET"], reason: "Doppelt" }))
      .toBe("Dienstleistung(en) entfernt (RFA, BET) · „Doppelt“");
    expect(auditFieldLabel("services_removed")).toBe("Dienstleistungen entfernt");
  });
});

describe("Dienstleistungen hinzufügen (Stufe 3b)", () => {
  it("Diff: nur Hinzufügen -> keine Serveränderung über apply_order_changes, aber als Änderung gemeldet, keine Begründung", () => {
    const base = snapshotFromOrder({ order_type: "customer", order_samples: [{ sample_id: "s1" }, { sample_id: "s2" }], sample_id: "s1" });
    const d = diffOrderEdit(base, base, { started: false, addServices: [{ name: "BET" }, { name: "RFA" }], addSampleCount: 2 });
    expect(d.changes).toBeNull();
    expect(d.addedServiceNames).toEqual(["BET", "RFA"]);
    expect(d.reasonRequired).toBe(false);
    expect(d.lines).toContain("Dienstleistung(en) hinzugefügt: BET, RFA (je Probe eine Aufgabe, 2 Proben)");
    expect(diffOrderEdit(base, base, { started: false }).addedServiceNames).toEqual([]);
  });

  it("Verlauf: hinzugefügte Dienstleistungen mit Namen", () => {
    expect(describeOrderUpdate({ fields: ["services_added"], services_added: ["BET"] })).toBe("Dienstleistung(en) hinzugefügt (BET)");
    expect(auditFieldLabel("services_added")).toBe("Dienstleistungen hinzugefügt");
  });
});
