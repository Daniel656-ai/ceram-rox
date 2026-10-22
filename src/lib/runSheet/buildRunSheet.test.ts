import { describe, it, expect } from "vitest";
import { buildRunSheet, dmcPayload, displaySpecValue } from "./buildRunSheet";

const order = (id: string, extra: any = {}) => ({ id, order_number: "ABC260001", order_kind: "labor", customer_name: "Kunde X", ...extra });
const p = (id: string, name: string, value: string | null, unit: string | null = null) =>
  ({ id, parameter_name: name, parameter_value: value, unit });

describe("Proben-Laufzettel", () => {
  it("eine Dienstleistung mit mehreren Parametern", () => {
    const r = buildRunSheet("S1", [{ id: "m1", sample_id: "S1", measurement_services: { service_name: "BET" },
      measurement_parameters: [p("1", "AV", "100", "h⁻¹"), p("2", "Temperatur 1", "350", "°C")], measurement_orders: order("O1") }], []);
    expect(r).toHaveLength(1);
    expect(r[0].services[0].params.map((x) => x.value)).toEqual(["100", "350"]);
    expect(r[0].customerName).toBe("Kunde X");
  });
  it("mehrere Dienstleistungen bleiben getrennt gruppiert", () => {
    const r = buildRunSheet("S1", [
      { id: "m1", sample_id: "S1", measurement_services: { service_name: "BET" }, measurement_parameters: [p("1", "A", "1")], measurement_orders: order("O1") },
      { id: "m2", sample_id: "S1", measurement_services: { service_name: "NOx" }, measurement_parameters: [p("2", "B", "2")], measurement_orders: order("O1") },
    ], []);
    expect(r[0].services.map((s) => s.serviceName)).toEqual(["BET", "NOx"]);
  });
  it("Mehrfachparameter (zwei O₂) werden nicht zusammengefasst", () => {
    const r = buildRunSheet("S1", [{ id: "m1", sample_id: "S1", measurement_parameters: [p("1", "O2", "5", "%"), p("2", "O2", "10", "%")], measurement_orders: order("O1") }], []);
    expect(r[0].services[0].params.map((x) => x.value)).toEqual(["5", "10"]);
  });
  it("leere Werte als – und nie 0", () => {
    expect(displaySpecValue(null)).toBe("–");
    expect(displaySpecValue("  ")).toBe("–");
    expect(displaySpecValue("0")).toBe("0");
  });
  it("mehrere Proben: nur eigene Dienstleistungen; ohne Probe nie", () => {
    const rows = [
      { id: "m1", sample_id: "S1", measurement_parameters: [p("1", "A", "1")], measurement_orders: order("O1") },
      { id: "m2", sample_id: "S2", measurement_parameters: [p("2", "B", "2")], measurement_orders: order("O1") },
      { id: "m3", sample_id: null, measurement_parameters: [p("3", "C", "3")], measurement_orders: order("O1") },
    ];
    expect(buildRunSheet("S1", rows, [])[0].services.map((s) => s.measurementId)).toEqual(["m1"]);
    expect(buildRunSheet("S2", rows, [])[0].services.map((s) => s.measurementId)).toEqual(["m2"]);
  });
  it("Änderungsstand: letzte eigene Änderung, fremde ignoriert, sonst null", () => {
    const rows = [{ id: "m1", sample_id: "S1", measurement_orders: order("O1") }];
    const r = buildRunSheet("S1", rows, [
      { order_measurement_id: "m1", created_at: "2026-10-01T10:00:00Z" },
      { order_measurement_id: "m1", created_at: "2026-10-05T10:00:00Z" },
      { order_measurement_id: "mX", created_at: "2026-10-09T10:00:00Z" },
    ]);
    expect(r[0].lastSpecChange).toBe("2026-10-05T10:00:00Z");
    expect(buildRunSheet("S1", rows, [])[0].lastSpecChange).toBeNull();
  });
  it("Pilot Plant: Auftragsnummer folgt der bestehenden Identität", () => {
    const r = buildRunSheet("S1", [{ id: "m1", sample_id: "S1", measurement_orders: order("O1", { order_kind: "pilot_plant", pp_experiment_number: "TE0042" }) }], []);
    expect(r[0].orderNumber).toBe("TE0042");
  });
  it("DMC-Inhalt nur mit beiden Kennungen", () => {
    expect(dmcPayload("ABC260001", "P260012")).toBe("ROX|A:ABC260001|P:P260012");
    expect(dmcPayload("", "P260012")).toBeNull();
  });
});
