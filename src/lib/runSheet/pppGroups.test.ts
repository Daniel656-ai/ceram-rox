import { describe, it, expect } from "vitest";
import { sortPppServices, classifyPppService } from "./pppGroups";
import { buildOrderRunSheet } from "./buildOrderRunSheet";

const it_ = (label: string, sort_order: number, service_id?: string) =>
  ({ item_value: label.toLowerCase(), label, sort_order, metadata: service_id ? { service_id } : {} });
const lists = {
  masse: [it_("Penetrometer", 2), it_("Feuchte", 1), it_("pH-Wert", 3)],
  produkt: [it_("Festigkeit", 1), it_("Brennen", 0, "svc-brennen")],
};
const s = (serviceName: string, serviceId: string | null = null) => ({ serviceName, serviceId });

describe("Pilot-Plant-Laufzettel: Gruppierung nach Stammdaten", () => {
  it("Knetung 1., Extrusion 2., Masse und Produkt in Stammdatenreihenfolge – unabhängig von Auswahlreihenfolge", () => {
    const input = [s("Festigkeit"), s("pH-Wert"), s("Extrusion"), s("Brennen", "svc-brennen"), s("Feuchte"), s("Knetung"), s("Penetrometer")];
    const out = sortPppServices(input, lists).map((x) => x.serviceName);
    expect(out).toEqual(["Knetung", "Extrusion", "Feuchte", "Penetrometer", "pH-Wert", "Brennen", "Festigkeit"]);
    const out2 = sortPppServices([...input].reverse(), lists).map((x) => x.serviceName);
    expect(out2).toEqual(out);
  });
  it("Verweis per service_id hat Vorrang, kein Namensrückfall", () => {
    expect(classifyPppService(s("Brennen", "other-id"), lists).group).toBe("unassigned");
  });
  it("Nicht gelistete, mehrdeutige oder doppelt gelistete Dienstleistungen werden nicht geraten", () => {
    expect(classifyPppService(s("Musterbau"), lists)).toMatchObject({ group: "unassigned", reason: "not_listed" });
    expect(classifyPppService(s("Feuchte"), { masse: lists.masse, produkt: [it_("Feuchte", 0)] }).reason).toBe("both_lists");
    expect(classifyPppService(s("Feuchte"), { masse: null, produkt: null }).reason).toBe("no_list");
  });
  it("keine Dienstleistung geht verloren oder wird doppelt dargestellt", () => {
    const input = [s("Musterbau"), s("Feuchte"), s("Feuchte"), s("Knetung")];
    const out = sortPppServices(input, lists);
    expect(out).toHaveLength(4);
    expect(out.map((x) => x.serviceName)).toEqual(["Knetung", "Feuchte", "Feuchte", "Musterbau"]);
  });
  it("Gruppierung nur bei Pilot Plant; Labor bleibt unverändert", () => {
    const m = (id: string, name: string) => ({ id, order_id: "O1", measurement_services: { service_name: name }, measurement_parameters: [] });
    const ms = [m("a", "Festigkeit"), m("b", "Knetung")];
    const pp = buildOrderRunSheet({ id: "O1", order_kind: "pilot_plant", order_measurements: ms }, [], [], lists);
    expect(pp.grouped).toBe(true);
    expect(pp.services.map((x) => x.serviceName)).toEqual(["Knetung", "Festigkeit"]);
    const lab = buildOrderRunSheet({ id: "O1", order_kind: "labor", order_measurements: ms }, [], [], lists);
    expect(lab.grouped).toBe(false);
    expect(lab.services.map((x) => x.serviceName)).toEqual(["Festigkeit", "Knetung"]);
  });
});
