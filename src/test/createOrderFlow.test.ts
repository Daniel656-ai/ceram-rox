import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Festhalten des heutigen Anlege-Ablaufs („Auftrag erstellen“), damit der geplante Bearbeiten-Modus
 * (Stufe 1) das Erstellen nicht versehentlich verändert. Die Funktionen wurden 1:1 aus
 * CreateOrderPage.tsx herausgelöst; diese Tests beschreiben ihr Verhalten.
 */

const calls: string[] = [];
const rec = (name: string, ...args: unknown[]) => calls.push(`${name}:${JSON.stringify(args)}`);

const apiMock = vi.hoisted(() => ({
  pilotPlantBlocks: { seed: vi.fn() },
  orderSharedFormData: { merge: vi.fn() },
  processTemplates: { snapshot: vi.fn() },
  orderInstances: { create: vi.fn() },
  workflowEngine: { seedFromTemplate: vi.fn() },
  orderSamples: { add: vi.fn() },
  ruleTriggers: { exists: vi.fn(), syncOrder: vi.fn() },
  mundstueck293: { syncOrder: vi.fn() },
  serviceParameters: { listByIdsForService: vi.fn() },
  measurementParameters: { bulkInsert: vi.fn() },
  serviceDataFields: { listForService: vi.fn() },
  serviceFieldTemplates: { listForField: vi.fn() },
  orderUploads: { uploadFile: vi.fn(), attachTemplate: vi.fn() },
  formFields: { listForForm: vi.fn() },
  measurementResults: { create: vi.fn() },
}));
const toastMock = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import {
  createMeasurementTasks,
  payloadToFormState,
  persistOrderLevelData,
  runPostCreateSyncs,
  type SelectedMeasurement,
} from "@/lib/orders/createOrderFlow";

const order = { id: "o1", order_number: "MWI260003" };
const user = { id: "u1" };

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  apiMock.processTemplates.snapshot.mockResolvedValue({ snap: true });
  apiMock.orderInstances.create.mockResolvedValue({ id: "inst1" });
  apiMock.ruleTriggers.exists.mockResolvedValue(false);
  apiMock.serviceParameters.listByIdsForService.mockResolvedValue([]);
  apiMock.serviceDataFields.listForService.mockResolvedValue([]);
  apiMock.formFields.listForForm.mockResolvedValue([]);
  apiMock.serviceFieldTemplates.listForField.mockResolvedValue([]);
});

const base = {
  order, user, orderKind: "labor" as const, dynamicFormId: null, dynamicValues: {},
  processTemplateId: "__none__", processTemplates: [], projectId: null, selectedSampleIds: [] as string[],
};

describe("persistOrderLevelData", () => {
  it("Labor ohne Formular/Prozessvorlage/Proben: es passiert nichts", async () => {
    await persistOrderLevelData(base);
    expect(apiMock.pilotPlantBlocks.seed).not.toHaveBeenCalled();
    expect(apiMock.orderSharedFormData.merge).not.toHaveBeenCalled();
    expect(apiMock.orderInstances.create).not.toHaveBeenCalled();
    expect(apiMock.orderSamples.add).not.toHaveBeenCalled();
  });

  it("Pilot Plant: legt keine alten Bausteine und keinen Prozess-Ablauf an (Aufgabe 018), auch nicht mit gewählter Vorlage", async () => {
    await persistOrderLevelData({ ...base, orderKind: "pilot_plant" });
    await persistOrderLevelData({ ...base, orderKind: "pilot_plant", processTemplateId: "t1", processTemplates: [{ id: "t1", name: "n" }] });
    expect(apiMock.pilotPlantBlocks.seed).not.toHaveBeenCalled();
    expect(apiMock.orderInstances.create).not.toHaveBeenCalled();
    expect(apiMock.workflowEngine.seedFromTemplate).not.toHaveBeenCalled();
  });

  it("Auftragsformular: Werte werden unter template gespeichert, nur mit Formular-ID und Werten", async () => {
    await persistOrderLevelData({ ...base, orderKind: "pilot_plant", dynamicFormId: "f1", dynamicValues: { versuchsnummer: "V1" } });
    expect(apiMock.orderSharedFormData.merge).toHaveBeenCalledTimes(1);
    const [id, patch] = apiMock.orderSharedFormData.merge.mock.calls[0];
    expect(id).toBe("o1");
    expect(patch.template).toMatchObject({
      form_definition_id: "f1", order_kind: "pilot_plant", values: { versuchsnummer: "V1" }, saved_by: "u1",
    });
    expect(typeof patch.template.saved_at).toBe("string");

    apiMock.orderSharedFormData.merge.mockClear();
    await persistOrderLevelData({ ...base, dynamicFormId: "f1", dynamicValues: {} });
    await persistOrderLevelData({ ...base, dynamicFormId: null, dynamicValues: { a: 1 } });
    expect(apiMock.orderSharedFormData.merge).not.toHaveBeenCalled();
  });

  it("Prozessvorlage: Prozessauftrag mit Snapshot anlegen und Workflow-Schritte erzeugen", async () => {
    await persistOrderLevelData({
      ...base, processTemplateId: "t1", processTemplates: [{ id: "t1", name: "Vorlage A" }],
      projectId: "p1", selectedSampleIds: ["s1", "s2"],
    });
    expect(apiMock.orderInstances.create).toHaveBeenCalledWith({
      template_id: "t1", template_snapshot: { snap: true }, project_id: "p1", legacy_order_id: "o1",
      order_number: "MWI260003", title: "Vorlage A", status: "planned", sample_ids: ["s1", "s2"],
      shared_data: {}, created_by: "u1",
    });
    expect(apiMock.workflowEngine.seedFromTemplate).toHaveBeenCalledWith("inst1", "t1");
  });

  it("Prozessvorlage: Snapshot-Fehler ist unkritisch; ohne Proben sample_ids = null; Fehler beim Anlegen nur als Hinweis", async () => {
    apiMock.processTemplates.snapshot.mockRejectedValueOnce(new Error("x"));
    await persistOrderLevelData({ ...base, processTemplateId: "t1", processTemplates: [{ id: "t1", name: "V" }] });
    expect(apiMock.orderInstances.create.mock.calls[0][0]).toMatchObject({ template_snapshot: null, sample_ids: null });
    apiMock.orderInstances.create.mockRejectedValueOnce(new Error("nein"));
    await persistOrderLevelData({ ...base, processTemplateId: "t1", processTemplates: [] });
    expect(toastMock.error).toHaveBeenCalledWith("Prozessvorlage: nein");
  });

  it("Proben werden n:m zugeordnet; Fehler nur als Hinweis; Reihenfolge der Schritte unverändert", async () => {
    const order_: string[] = [];
    apiMock.orderSharedFormData.merge.mockImplementation(async () => { order_.push("merge"); });
    apiMock.orderInstances.create.mockImplementation(async () => { order_.push("instance"); return { id: "i" }; });
    apiMock.workflowEngine.seedFromTemplate.mockImplementation(async () => { order_.push("workflow"); });
    apiMock.orderSamples.add.mockImplementation(async () => { order_.push("samples"); });
    await persistOrderLevelData({
      ...base, orderKind: "labor", dynamicFormId: "f", dynamicValues: { a: 1 },
      processTemplateId: "t", processTemplates: [{ id: "t", name: "n" }], selectedSampleIds: ["s1"],
    });
    expect(order_).toEqual(["merge", "instance", "workflow", "samples"]);
    expect(apiMock.orderSamples.add).toHaveBeenCalledWith("o1", ["s1"], "u1");
    apiMock.orderSamples.add.mockRejectedValueOnce(new Error("weg"));
    await persistOrderLevelData({ ...base, selectedSampleIds: ["s1"] });
    expect(toastMock.error).toHaveBeenCalledWith("Probenzuordnung: weg");
  });
});

describe("createMeasurementTasks", () => {
  const svc = (uid: string, service_id: string, extra: Partial<SelectedMeasurement> = {}): SelectedMeasurement => ({
    uid, service_id, service_name: service_id, origin: "manual", ...extra,
  });
  const run = (over: Record<string, unknown> = {}) => {
    const created: any[] = [];
    let n = 0;
    const addMeasurement = {
      mutateAsync: vi.fn(async (input: any) => { created.push(input); return { id: `m${++n}` }; }),
    };
    const input = {
      order, user, effectiveMeasurements: [svc("a", "RFA"), svc("b", "BET")], selectedSampleIds: ["p1", "p2"],
      dueDate: "2026-12-01", measurementParams: {}, measurementFormValues: {}, addMeasurement, ...over,
    } as Parameters<typeof createMeasurementTasks>[0];
    return { input, created, addMeasurement };
  };

  it("je Dienstleistung UND Probe eine Aufgabe (dienstleistungsweise gruppiert) mit Fälligkeit", async () => {
    const { input, created } = run();
    await createMeasurementTasks(input);
    expect(created.map((c) => [c.service_id, c.sample_id])).toEqual([
      ["RFA", "p1"], ["RFA", "p2"], ["BET", "p1"], ["BET", "p2"],
    ]);
    expect(created.every((c) => c.order_id === "o1" && c.due_date === "2026-12-01")).toBe(true);
  });

  it("ohne Proben genau eine Aufgabe je Dienstleistung (sample_id null); leere Fälligkeit = undefined", async () => {
    const { input, created } = run({ selectedSampleIds: [], dueDate: "" });
    await createMeasurementTasks(input);
    expect(created.map((c) => c.sample_id)).toEqual([null, null]);
    expect(created.every((c) => c.due_date === undefined)).toBe(true);
  });

  it("Servicepaket-Herkunft wird mitgegeben", async () => {
    const { input, created } = run({
      effectiveMeasurements: [svc("a", "RFA", { source_package_id: "pk", source_package_name: "Paket" })],
      selectedSampleIds: [],
    });
    await createMeasurementTasks(input);
    expect(created[0]).toMatchObject({ source_package_id: "pk", source_package_name_snapshot: "Paket" });
  });

  it("Regel-Dienstleistung: bereits vorhandene wird übersprungen, neue verweist auf die auslösende Aufgabe", async () => {
    const rule = svc("r", "BET", { origin: "rule", rule_source_uid: "a", rule_id: "rule-1" });
    apiMock.ruleTriggers.exists.mockImplementation(async (_o: string, _s: string, sample: string | null) => sample === "p2");
    const { input, created } = run({ effectiveMeasurements: [svc("a", "RFA"), rule] });
    await createMeasurementTasks(input);
    // RFA×p1, RFA×p2 (m1,m2), Regel×p1 (angelegt), Regel×p2 (übersprungen)
    expect(created.map((c) => [c.service_id, c.sample_id])).toEqual([["RFA", "p1"], ["RFA", "p2"], ["BET", "p1"]]);
    expect(created[2].origin).toBe("workflow");
    expect(created[2].source_measurement_id).toBe("m1");
    expect(created[2].source_step_key).toBeTruthy();
  });

  it("Auftraggeber-Vorgaben (Parameter) werden nur mit Wert gespeichert, mit Name und Einheit", async () => {
    apiMock.serviceParameters.listByIdsForService.mockResolvedValue([
      { id: "d1", parameter_name: "Temperatur", unit: "°C" },
      { id: "d2", parameter_name: "Leer", unit: null },
    ]);
    const { input } = run({ effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [], measurementParams: { a: { d1: "300", d2: "  " } } });
    await createMeasurementTasks(input);
    expect(apiMock.serviceParameters.listByIdsForService).toHaveBeenCalledWith("RFA", ["d1", "d2"]);
    expect(apiMock.measurementParameters.bulkInsert).toHaveBeenCalledWith([
      { order_measurement_id: "m1", parameter_name: "Temperatur", parameter_value: "300", unit: "°C" },
    ]);
  });

  it("Formularwerte: Text/Zahl/Ja-Nein/Objekt als Vorgabe, leere Texte und null entfallen, Anzeigename und Einheit aus dem Feld", async () => {
    apiMock.serviceDataFields.listForService.mockResolvedValue([
      { field_key: "druck", display_name: "Druck", unit: "bar", field_type: "number" },
    ]);
    const { input } = run({
      effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [],
      measurementFormValues: { a: { druck: 5, flag: true, obj: { x: 1 }, leer: "  ", nix: null, frei: "Text" } },
    });
    await createMeasurementTasks(input);
    const inserts = apiMock.measurementParameters.bulkInsert.mock.calls[0][0];
    expect(inserts).toEqual([
      { order_measurement_id: "m1", parameter_name: "Druck", parameter_value: "5", unit: "bar" },
      { order_measurement_id: "m1", parameter_name: "flag", parameter_value: "true", unit: null },
      { order_measurement_id: "m1", parameter_name: "obj", parameter_value: JSON.stringify({ x: 1 }), unit: null },
      { order_measurement_id: "m1", parameter_name: "frei", parameter_value: "Text", unit: null },
    ]);
  });

  it("Wiederholbereich (repeat:): Uploads werden herausgelöst und nachträglich mit Zeilenindex hochgeladen", async () => {
    apiMock.serviceDataFields.listForService.mockResolvedValue([{ field_key: "datei", field_type: "file", id: "f1" }]);
    const file = new File(["x"], "a.txt");
    const upload = { __id: "u1", pendingFile: file, name: "a.txt" };
    const { input } = run({
      effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [],
      measurementFormValues: { a: { "repeat:Zeilen": [{ wert: 1, datei: [upload] }, { wert: 2 }] } },
    });
    await createMeasurementTasks(input);
    expect(apiMock.orderUploads.uploadFile).toHaveBeenCalledWith({
      measurementId: "m1", fieldKey: "datei", entryIndex: 0, file, uploadedBy: "u1",
    });
    const inserts = apiMock.measurementParameters.bulkInsert.mock.calls[0][0];
    expect(inserts).toEqual([
      { order_measurement_id: "m1", parameter_name: "repeat:Zeilen", parameter_value: JSON.stringify([{ wert: 1 }, { wert: 2 }]), unit: null },
    ]);
  });

  it("Upload-Feld (Top-Level): Datei hochladen, Fehler nur als Hinweis", async () => {
    apiMock.serviceDataFields.listForService.mockResolvedValue([{ field_key: "bild", field_type: "image", id: "f1" }]);
    apiMock.orderUploads.uploadFile.mockRejectedValueOnce(new Error("zu groß"));
    const file = new File(["x"], "b.png");
    const { input } = run({
      effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [],
      measurementFormValues: { a: { bild: [{ __id: "u", pendingFile: file, name: "b.png" }] } },
    });
    await createMeasurementTasks(input);
    expect(toastMock.error).toHaveBeenCalledWith("Upload „b.png\" fehlgeschlagen", { description: "zu groß" });
    expect(apiMock.measurementParameters.bulkInsert).not.toHaveBeenCalled();
  });

  it("verknüpfte Formularwerte: als Vorgabe UND als Formularwert (form:<Formular>:<Feld>) derselben Messung", async () => {
    apiMock.formFields.listForForm.mockResolvedValue([{ field_key: "dichte", display_name: "Dichte", unit: "g/cm³", field_type: "number" }]);
    const { input } = run({
      effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [],
      measurementFormValues: { a: { "form:F1:dichte": "2,5" } },
    });
    await createMeasurementTasks(input);
    expect(apiMock.formFields.listForForm).toHaveBeenCalledWith("F1");
    expect(apiMock.measurementResults.create).toHaveBeenCalledTimes(1);
    expect(apiMock.measurementResults.create.mock.calls[0][0]).toMatchObject({
      order_measurement_id: "m1", result_name: "form:F1:dichte", display_label: "Dichte", is_official: false, measured_by: "u1",
    });
    expect(apiMock.measurementParameters.bulkInsert.mock.calls[0][0]).toEqual([
      { order_measurement_id: "m1", parameter_name: "Dichte", parameter_value: "2,5", unit: "g/cm³" },
    ]);
  });

  it("Fehler beim Übernehmen eines Formularwerts bricht das Anlegen nicht ab", async () => {
    apiMock.formFields.listForForm.mockResolvedValue([{ field_key: "dichte" }]);
    apiMock.measurementResults.create.mockRejectedValueOnce(new Error("egal"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { input } = run({
      effectiveMeasurements: [svc("a", "RFA")], selectedSampleIds: [],
      measurementFormValues: { a: { "form:F1:dichte": "2" } },
    });
    await expect(createMeasurementTasks(input)).resolves.toBeUndefined();
    expect(apiMock.measurementParameters.bulkInsert).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("runPostCreateSyncs", () => {
  it("gleicht Regel-Auslöser und Mundstück 293/1 ab; Fehler werden nur protokolliert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    apiMock.ruleTriggers.syncOrder.mockRejectedValueOnce(new Error("a"));
    await expect(runPostCreateSyncs("o1")).resolves.toBeUndefined();
    expect(apiMock.ruleTriggers.syncOrder).toHaveBeenCalledWith("o1");
    expect(apiMock.mundstueck293.syncOrder).toHaveBeenCalledWith("o1");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("payloadToFormState", () => {
  it("leerer Entwurf ergibt die Ausgangswerte der Maske", () => {
    expect(payloadToFormState({} as any)).toEqual({
      selectedProjectId: "", orderType: "", orderKind: "labor", priority: "normal", dueDate: "", notes: "",
      measurements: [], selectedSampleIds: [], processTemplateId: "__none__", measurementParams: {},
      measurementFormValues: {}, dynamicValues: {}, dynamicFormId: null, serviceTab: { active: null, order: [] },
    });
  });

  it("übernimmt alle Felder eines Entwurfs 1:1 (Pilot Plant, Reiter, Proben, Formularwerte)", () => {
    const p = {
      selectedProjectId: "p", orderType: "customer", orderKind: "pilot_plant", priority: "hoch", dueDate: "2026-12-01",
      notes: "n", measurements: [{ uid: "a", service_id: "s", service_name: "S" }], selectedSampleIds: ["x"],
      processTemplateId: "t", measurementParams: { a: { d: "1" } }, measurementFormValues: { a: { k: 2 } },
      dynamicValues: { v: 1 }, dynamicFormId: "f", activeMeasurementUid: "a", serviceTabOrder: ["a"],
    } as any;
    expect(payloadToFormState(p)).toEqual({
      selectedProjectId: "p", orderType: "customer", orderKind: "pilot_plant", priority: "hoch", dueDate: "2026-12-01",
      notes: "n", measurements: p.measurements, selectedSampleIds: ["x"], processTemplateId: "t",
      measurementParams: { a: { d: "1" } }, measurementFormValues: { a: { k: 2 } }, dynamicValues: { v: 1 },
      dynamicFormId: "f", serviceTab: { active: "a", order: ["a"] },
    });
  });

  it("unbekannte Auftragsart fällt auf Labor zurück", () => {
    expect(payloadToFormState({ orderKind: "irgendwas" } as any).orderKind).toBe("labor");
  });
});

// rec wird für Debug-Zwecke bereitgehalten (Aufrufreihenfolge), aktuell nicht benötigt
void rec;
