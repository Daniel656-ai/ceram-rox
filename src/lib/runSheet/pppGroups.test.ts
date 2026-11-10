import { describe, it, expect } from "vitest";
import { sortPppServices, classifyPppService, resolvePppList } from "./pppGroups";
import { buildOrderRunSheet, isPilotPlantRunSheetOrder } from "./buildOrderRunSheet";

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

describe("Pilot-Plant-Erkennung für den Laufzettel (Korrektur A)", () => {
  const m = (id: string, name: string, category: string) =>
    ({ id, order_id: "O1", measurement_services: { service_name: name, category }, measurement_parameters: [] });

  it("Mischauftrag mit order_kind=legacy und Laborprüfungen wird gruppiert und sortiert", () => {
    const ms = [m("a", "Penetrometer", "labor"), m("b", "Extrusion", "pilot_plant"), m("c", "Festigkeit", "labor"), m("d", "Knetung", "pilot_plant"), m("e", "Feuchte", "labor")];
    const sheet = buildOrderRunSheet({ id: "O1", order_kind: "legacy", order_measurements: ms }, [], [], lists);
    expect(sheet.grouped).toBe(true);
    expect(sheet.services.map((x) => x.serviceName)).toEqual(["Knetung", "Extrusion", "Feuchte", "Penetrometer", "Festigkeit"]);
  });

  it("order_kind=NULL mit Pilot-Plant-Dienstleistung wird gruppiert", () => {
    const ms = [m("a", "Feuchte", "labor"), m("b", "Knetung", "pilot_plant")];
    expect(isPilotPlantRunSheetOrder({ id: "O1", order_kind: null, order_measurements: ms })).toBe(true);
    const sheet = buildOrderRunSheet({ id: "O1", order_kind: null, order_measurements: ms }, [], [], lists);
    expect(sheet.grouped).toBe(true);
    expect(sheet.services.map((x) => x.serviceName)).toEqual(["Knetung", "Feuchte"]);
  });

  it("vorhandene Versuchsnummer aktiviert die Gruppierung", () => {
    expect(isPilotPlantRunSheetOrder({ id: "O1", order_kind: "legacy", pp_experiment_number: "TE0042", order_measurements: [] })).toBe(true);
    expect(isPilotPlantRunSheetOrder({ id: "O1", order_kind: "legacy", pp_experiment_number: "  ", order_measurements: [] })).toBe(false);
  });

  it("reine Labor- und klassische Aufträge ohne Pilot-Plant-Bezug bleiben unverändert", () => {
    const ms = [m("a", "Festigkeit", "labor"), m("b", "Feuchte", "labor")];
    expect(isPilotPlantRunSheetOrder({ id: "O1", order_kind: "legacy", order_measurements: ms })).toBe(false);
    const sheet = buildOrderRunSheet({ id: "O1", order_kind: "labor", order_measurements: ms }, [], [], lists);
    expect(sheet.grouped).toBe(false);
    expect(sheet.services.map((x) => x.serviceName)).toEqual(["Festigkeit", "Feuchte"]);
  });
});

describe("Stammdatenlisten-Auflösung (Korrektur B)", () => {
  const l = (id: string, list_key: string | null, display_name: string | null) => ({ id, list_key, display_name });

  it("technischer Schlüssel hat Vorrang", () => {
    const res = resolvePppList([l("1", "ppp_masse", "Irgendein Name"), l("2", "andere", "PPP_Masse")], "ppp_masse");
    expect(res).toEqual({ list: l("1", "ppp_masse", "Irgendein Name"), reason: "ok" });
  });

  it("Anzeigename als kontrollierter Rückfall, Schreibweisen normalisiert", () => {
    expect(resolvePppList([l("1", null, "PPP Masse")], "ppp_masse").list?.id).toBe("1");
    expect(resolvePppList([l("2", null, "ppp-masse")], "ppp_masse").list?.id).toBe("2");
    expect(resolvePppList([l("3", null, "PPP_Produkt")], "ppp_produkt").list?.id).toBe("3");
  });

  it("mehrere Treffer werden nie willkürlich gewählt", () => {
    const res = resolvePppList([l("1", "ppp_masse", null), l("2", "PPP-Masse", null)], "ppp_masse");
    expect(res).toEqual({ list: null, reason: "ambiguous" });
    const resName = resolvePppList([l("1", null, "PPP Masse"), l("2", null, "ppp_masse")], "ppp_masse");
    expect(resName).toEqual({ list: null, reason: "ambiguous" });
  });

  it("fehlende Liste wird als nicht gefunden gemeldet", () => {
    expect(resolvePppList([l("1", "analyse_ppp", "Analyse PPP")], "ppp_masse")).toEqual({ list: null, reason: "not_found" });
  });

  it("nicht auflösbare Listen lassen alle Dienstleistungen sichtbar in der Fallback-Gruppe", () => {
    const out = sortPppServices([s("Feuchte"), s("Knetung"), s("Musterbau")], { masse: null, produkt: null });
    expect(out.map((x) => x.serviceName)).toEqual(["Knetung", "Feuchte", "Musterbau"]);
    expect(out.filter((x) => x.pppGroup === "unassigned")).toHaveLength(2);
  });
});

describe("Feste Zuordnung Knetung/Extrusion (Korrektur C)", () => {
  it("eindeutige service_id-Verknüpfung hat Vorrang vor der Bezeichnung", () => {
    const withRef = { masse: [it_("Knetung", 0, "svc-kneten")], produkt: null };
    expect(classifyPppService(s("Beliebiger Katalogname", "svc-kneten"), withRef).group).toBe("knetung");
  });

  it("keine Teilwort-Heuristiken: ähnliche Namen werden nicht als Knetung/Extrusion eingestuft", () => {
    expect(classifyPppService(s("Knetung Kontrolle"), lists).group).toBe("unassigned");
    expect(classifyPppService(s("Extrusionshilfe"), lists).group).toBe("unassigned");
    expect(classifyPppService(s("Kneten"), lists).group).toBe("unassigned");
  });
});
