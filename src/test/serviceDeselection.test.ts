import { describe, expect, it } from "vitest";
import { planPilotServiceDeselection, removeDraftServices } from "@/lib/orderCreation/serviceDeselection";
import { normalizeRestoredDraft } from "@/lib/orderDraftSafety";
import { planServiceSync, readServiceSelectionEntries } from "@/lib/orderServiceSelection";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

const services = [{ id: "k", service_name: "Knetung" }, { id: "e", service_name: "Extrusion" }];
const fields = [{ field_key: "prozesse", field_type: "multiselect", select_options: [{ value: "knead", label: "Knetung", service_id: "k" }, { value: "extrude", label: "Extrusion", service_id: "e" }] }];
const payload: OrderDraftPayload = {
  orderKind: "pilot_plant", dynamicValues: { prozesse: ["knead", "extrude"], notes: "keep" },
  measurements: [
    { uid: "k1", service_id: "k", service_name: "Knetung", origin: "template", selection_token: "knead" },
    { uid: "e1", service_id: "e", service_name: "Extrusion", origin: "template", selection_token: "extrude" },
  ],
  measurementFormValues: { k1: { dauer: 15 }, e1: { temperatur: 100 } },
  measurementParams: { k1: { amount: "2" }, e1: { amount: "3" } },
  activeMeasurementUid: "k1", serviceTabOrder: ["e1", "k1"],
};
const request = (patch = { prozesse: ["extrude"] }) => planPilotServiceDeselection({ values: payload.dynamicValues ?? {}, patch, fields, services, measurements: payload.measurements ?? [] });
const confirm = () => removeDraftServices(payload, request().uids, { prozesse: ["extrude"] });

describe("Pilot Plant confirmed checkbox removal", () => {
  it("stages checkbox removal even with entered data, without changing selection", () => {
    expect(request()).toEqual({ uids: ["k1"], names: ["Knetung"] });
    expect(payload.dynamicValues?.prozesse).toEqual(["knead", "extrude"]);
  });
  it("cancelling leaves every value and the active tab untouched", () => {
    const before = structuredClone(payload);
    request(); // No confirmation: the proposed patch is never committed.
    expect(payload).toEqual(before);
    expect(payload.measurementFormValues?.k1.dauer).toBe(15);
    expect(payload.activeMeasurementUid).toBe("k1");
  });
  it("confirmation removes the selected UID, requester values and parameters", () => {
    const next = confirm();
    expect(next.measurements?.map(m => m.uid)).toEqual(["e1"]);
    expect(next.dynamicValues?.prozesse).toEqual(["extrude"]);
    expect(next.measurementFormValues).not.toHaveProperty("k1");
    expect(next.measurementParams).not.toHaveProperty("k1");
  });
  it("does not affect any other selected service or unrelated order fields", () => {
    const next = confirm();
    expect(next.measurements?.[0]).toEqual(payload.measurements?.[1]);
    expect(next.measurementFormValues?.e1).toBe(payload.measurementFormValues?.e1);
    expect(next.measurementParams?.e1).toBe(payload.measurementParams?.e1);
    expect(next.dynamicValues?.notes).toBe("keep");
  });
  it("removing the active tab activates the last remaining tab and cleans its order", () => {
    expect(confirm().activeMeasurementUid).toBe("e1");
    expect(confirm().serviceTabOrder).toEqual(["e1"]);
  });
  it("removing the final service leaves an empty service area", () => {
    const next = removeDraftServices(confirm(), ["e1"], { prozesse: [] });
    expect(next.measurements).toEqual([]);
    expect(next.measurementFormValues).toEqual({});
    expect(next.activeMeasurementUid).toBeNull();
    expect(next.serviceTabOrder).toEqual([]);
  });
  it("JSON save, restoration and synchronization never resurrect a removed service", () => {
    const restored = normalizeRestoredDraft(JSON.parse(JSON.stringify(confirm())));
    const plan = planServiceSync({ selection: readServiceSelectionEntries(restored.dynamicValues ?? {}, fields, services), services, measurements: restored.measurements ?? [] });
    expect(plan.add).toEqual([]);
    expect(plan.keep).toEqual([]);
    expect(restored.measurementFormValues).toEqual({ e1: { temperatur: 100 } });
  });
  it("reselecting after confirmed removal requests a fresh empty position", () => {
    const next = confirm();
    const plan = planServiceSync({ selection: readServiceSelectionEntries({ prozesse: ["extrude", "knead"] }, fields, services), services, measurements: next.measurements ?? [] });
    expect(plan.add).toEqual([{ service: services[0], token: "knead" }]);
    expect(next.measurementFormValues?.k1).toBeUndefined();
  });
  it("a tab click or unrelated field edit cannot request deletion", () => {
    const plan = planPilotServiceDeselection({ values: payload.dynamicValues ?? {}, patch: { notes: "new" }, fields, services, measurements: payload.measurements ?? [] });
    expect(plan.uids).toEqual([]);
    expect(plan.names).toEqual([]);
  });
  it("preserves an independently added duplicate of the same service", () => {
    const duplicate = { uid: "manual", service_id: "k", service_name: "Knetung", origin: "manual" as const };
    const next = removeDraftServices({ ...payload, measurements: [...payload.measurements ?? [], duplicate] }, request().uids, { prozesse: ["extrude"] });
    expect(next.measurements?.map(m => m.uid)).toEqual(["e1", "manual"]);
  });
  it("requires confirmation for an unedited service and uses stable selection values", () => {
    const plan = planPilotServiceDeselection({ values: { prozesse: ["knead"] }, patch: { prozesse: [] }, fields, services, measurements: payload.measurements ?? [] });
    expect(plan.uids).toEqual(["k1"]);
    expect(plan.names).toEqual(["Knetung"]);
  });
});