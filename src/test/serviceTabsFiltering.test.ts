import { describe, it, expect } from "vitest";
import { designerLayoutHasCustomerForm, linkedFormIsCustomerForm, planServiceTabs, type CustomerFormStatus } from "@/lib/orderCreation/serviceFormMetadata";
import { nextActiveServiceTab, EMPTY_ACTIVE_TAB } from "@/lib/orderCreation/activeServiceTab";
import { planPilotServiceDeselection, removeDraftServices } from "@/lib/orderCreation/serviceDeselection";
import { normalizeRestoredDraft } from "@/lib/orderDraftSafety";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

const status: CustomerFormStatus = new Map([["k", true], ["e", true], ["b", false], ["r", false]]);
const M = [
  { uid: "k1", service_id: "k", service_name: "Knetung" },
  { uid: "b1", service_id: "b", service_name: "BET" },
  { uid: "e1", service_id: "e", service_name: "Extrusion" },
  { uid: "r1", service_id: "r", service_name: "RFA" },
];

describe("Dienstleistungsreiter nur für Auftraggeberformulare", () => {
  it("1+2: gemischte Auswahl zeigt nur Knetung/Extrusion, Positionsliste bleibt vollständig", () => {
    const copy = structuredClone(M);
    const plan = planServiceTabs(M, status);
    expect(plan.tabs.map((m) => m.service_name)).toEqual(["Knetung", "Extrusion"]);
    expect(M).toEqual(copy);
    expect(M).toHaveLength(4);
  });
  it("3: Auswahl von BET ändert den aktiven Reiter nicht", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["k1"], addedUids: ["k1"] });
    const vis = planServiceTabs(M.slice(0, 2), status).visibleUids;
    const s2 = nextActiveServiceTab({ prev: s1, visibleUids: vis, addedUids: ["b1"] });
    expect(s2).toEqual({ active: "k1", order: ["k1"] });
  });
  it("4: Auswahl von Extrusion aktiviert den neuen Reiter", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["k1"], addedUids: ["k1"] });
    const s2 = nextActiveServiceTab({ prev: s1, visibleUids: planServiceTabs(M, status).visibleUids, addedUids: ["e1"] });
    expect(s2.active).toBe("e1");
    expect(s2.order).toEqual(["k1", "e1"]);
  });
  it("5: Entfernen des aktiven sichtbaren Reiters aktiviert den verbleibenden", () => {
    const s = { active: "e1", order: ["k1", "e1"] };
    const rest = M.filter((m) => m.uid !== "e1");
    expect(nextActiveServiceTab({ prev: s, visibleUids: planServiceTabs(rest, status).visibleUids })).toEqual({ active: "k1", order: ["k1"] });
  });
  it("6: nur BET/RFA → keine Reiter, kein aktiver Reiter, Positionen vorhanden", () => {
    const only = M.filter((m) => m.service_id === "b" || m.service_id === "r");
    const plan = planServiceTabs(only, status);
    expect(plan.tabs).toEqual([]);
    expect(nextActiveServiceTab({ prev: { active: "k1", order: ["k1"] }, visibleUids: plan.visibleUids })).toEqual({ active: null, order: [] });
    expect(only).toHaveLength(2);
  });
  it("noch nicht geladene Metadaten zeigen keinen Reiter, werden aber vorgemerkt", () => {
    const plan = planServiceTabs(M, new Map([["k", true]]));
    expect(plan.visibleUids).toEqual(["k1"]);
    expect(plan.unresolvedUids).toEqual(["b1", "e1", "r1"]);
  });
  it("7: Entwurf speichern/wiederherstellen behält alle Dienstleistungen und Daten", () => {
    const payload: OrderDraftPayload = {
      orderKind: "pilot_plant", measurements: M as any,
      measurementFormValues: { k1: { a: 1 }, b1: { x: "y" } }, measurementParams: { r1: { p: "1" } },
      activeMeasurementUid: "k1", serviceTabOrder: ["k1"],
    };
    const restored = normalizeRestoredDraft(JSON.parse(JSON.stringify(payload)));
    expect(restored.measurements?.map((m) => m.uid)).toEqual(["k1", "b1", "e1", "r1"]);
    expect(restored.measurementFormValues?.b1).toEqual({ x: "y" });
    expect(restored.measurementParams?.r1).toEqual({ p: "1" });
  });
  it("8+9: Sicherheitsabfrage/Entfernen betrifft nur die abgewählte Dienstleistung", () => {
    const services = [{ id: "k", service_name: "Knetung" }, { id: "b", service_name: "BET" }];
    const fields = [{ field_key: "p", field_type: "multiselect", select_options: [{ value: "kn", label: "Knetung", service_id: "k" }, { value: "bet", label: "BET", service_id: "b" }] }];
    const ms = [{ ...M[0], origin: "template", selection_token: "kn" }, { ...M[1], origin: "template", selection_token: "bet" }] as any;
    const req = planPilotServiceDeselection({ values: { p: ["kn", "bet"] }, patch: { p: ["bet"] }, fields, services, measurements: ms });
    expect(req).toEqual({ uids: ["k1"], names: ["Knetung"] });
    const next = removeDraftServices({ orderKind: "pilot_plant", dynamicValues: { p: ["kn", "bet"] }, measurements: ms, measurementFormValues: { k1: { a: 1 }, b1: { z: 2 } } }, req!.uids, { p: ["bet"] });
    expect(next.measurements?.map((m) => m.uid)).toEqual(["b1"]);
    expect(next.measurementFormValues).toEqual({ b1: { z: 2 } });
  });
  it("10: Designer-Formular und verknüpftes Auftraggeberformular werden erkannt", () => {
    expect(designerLayoutHasCustomerForm([{ fields: [{ field_id: "f1" }] }])).toBe(true);
    expect(designerLayoutHasCustomerForm([{ repeatable: { enabled: true }, fields: [{ field_id: "f2" }] }])).toBe(true);
    expect(linkedFormIsCustomerForm("auftraggeber", 3)).toBe(true);
  });
  it("11: leere Layouts und reine interne Formulare erzeugen keinen Reiter", () => {
    expect(designerLayoutHasCustomerForm([])).toBe(false);
    expect(designerLayoutHasCustomerForm([{ fields: [] }, { fields: [{ field_id: "f", hidden: true }] }])).toBe(false);
    expect(designerLayoutHasCustomerForm(null)).toBe(false);
    expect(linkedFormIsCustomerForm(null, 5)).toBe(false); // nur Messdienstleister-Ansicht
    expect(linkedFormIsCustomerForm("auftraggeber", 0)).toBe(false);
  });
});
