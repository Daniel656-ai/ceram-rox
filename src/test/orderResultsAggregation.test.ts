import { describe, expect, it } from "vitest";
import {
  buildOrderResultGroups,
  type RawMeasurementRow,
  type RawResultRow,
} from "@/lib/orderResultsAggregation";

const res = (name: string, value: RawResultRow["value"], over: Partial<RawResultRow> = {}): RawResultRow => ({
  id: `r-${name}-${String(value)}`,
  result_name: name,
  display_label: null,
  value,
  unit: null,
  is_official: true,
  ...over,
});

const meas = (id: string, over: Partial<RawMeasurementRow> = {}): RawMeasurementRow => ({
  id,
  sample_id: `s-${id}`,
  service_id: "svc-rfa",
  status: "completed",
  measurement_services: { id: "svc-rfa", service_name: "RFA" },
  samples: { id: `s-${id}`, sample_number: `P-${id}`, sample_name: `Probe ${id}` },
  measurement_results: [],
  ...over,
});

describe("Auftrags-Ergebnisaggregation je Dienstleistung", () => {
  it("berücksichtigt nur offizielle Ergebnisse und lässt Dienstleistungen ohne offizielle Werte weg", () => {
    const groups = buildOrderResultGroups([
      meas("1", {
        measurement_results: [
          res("sio2", 56, { is_official: true }),
          res("intern", 1, { is_official: false }),
          res("unklar", 2, { is_official: null }),
        ],
      }),
      meas("2", {
        service_id: "svc-bet",
        measurement_services: { id: "svc-bet", service_name: "BET" },
        measurement_results: [res("bet", 12, { is_official: false })],
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].serviceId).toBe("svc-rfa");
    expect(groups[0].columns.map((c) => c.key)).toEqual(["sio2"]);
    expect(Object.keys(groups[0].rows[0].cells)).toEqual(["sio2"]);
  });

  it("gruppiert über die Dienstleistungs-ID, nicht über den sichtbaren Namen", () => {
    const groups = buildOrderResultGroups([
      meas("1", { service_id: "svc-a", measurement_services: { id: "svc-a", service_name: "Dichte" }, measurement_results: [res("d", 1)] }),
      meas("2", { service_id: "svc-b", measurement_services: { id: "svc-b", service_name: "Dichte" }, measurement_results: [res("d", 2)] }),
      meas("3", { service_id: "svc-a", measurement_services: { id: "svc-a", service_name: "Dichte (neu)" }, measurement_results: [res("d", 3)] }),
    ]);
    expect(groups.map((g) => [g.serviceId, g.serviceName, g.rows.length])).toEqual([
      ["svc-a", "Dichte", 2],
      ["svc-b", "Dichte", 1],
    ]);
  });

  it("überspringt Messungen ohne Dienstleistungs-ID und setzt fehlende Namen auf Platzhalter", () => {
    const groups = buildOrderResultGroups([
      meas("1", { service_id: "", measurement_results: [res("x", 1)] }),
      meas("2", { measurement_services: null, samples: null, sample_id: null, measurement_results: [res("x", 2)] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].serviceName).toBe("Dienstleistung");
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0]).toMatchObject({ measurementId: "2", sampleNumber: "–", sampleName: "Ohne Probe", sampleId: null });
  });

  it("bildet den Mittelwert nur über vorhandene Zahlenwerte – fehlende Werte zählen nicht als 0", () => {
    const groups = buildOrderResultGroups([
      meas("1", { measurement_results: [res("sio2", 50)] }),
      meas("2", { measurement_results: [res("sio2", "60")] }),
      meas("3", { measurement_results: [res("sio2", null)] }),
      meas("4", { measurement_results: [res("al2o3", 5)] }),
    ]);
    expect(groups[0].averages.sio2).toEqual({ average: 55, count: 2, total: 4 });
    expect(groups[0].averages.al2o3).toEqual({ average: 5, count: 1, total: 4 });
  });

  it("liefert keinen Mittelwert, wenn kein Zahlenwert vorhanden ist", () => {
    const groups = buildOrderResultGroups([meas("1", { measurement_results: [res("farbe", "rot")] })]);
    expect(groups[0].averages.farbe).toEqual({ average: null, count: 0, total: 1 });
  });

  it("liest Dezimalkomma als Zahl und behält nicht numerische Werte als Text", () => {
    const [group] = buildOrderResultGroups([
      meas("1", { measurement_results: [res("a", "1,5"), res("b", "<0,01")] }),
    ]);
    expect(group.rows[0].cells).toEqual({
      a: { value: 1.5, text: null },
      b: { value: null, text: "<0,01" },
    });
  });

  it("hält unterschiedliche Ergebniskennungen mit gleicher Bezeichnung als getrennte Spalten", () => {
    const [group] = buildOrderResultGroups([
      meas("1", {
        measurement_results: [
          res("form:f:messungen[m1].sio2", 50, { display_label: "SiO2" }),
          res("form:f:messungen[m2].sio2", 52, { display_label: "SiO2" }),
        ],
      }),
    ]);
    expect(group.columns.map((c) => c.key)).toEqual(["form:f:messungen[m1].sio2", "form:f:messungen[m2].sio2"]);
    expect(group.rows[0].cells["form:f:messungen[m2].sio2"].value).toBe(52);
  });

  it("übernimmt Spaltenbezeichnung und Einheit, auch wenn sie erst bei einer späteren Probe gepflegt sind", () => {
    const [group] = buildOrderResultGroups([
      meas("1", { measurement_results: [res("sio2", 50)] }),
      meas("2", { measurement_results: [res("sio2", 52, { display_label: "SiO₂", unit: "%" })] }),
    ]);
    expect(group.columns).toEqual([{ key: "sio2", label: "SiO₂", unit: "%" }]);
  });

  it("kennzeichnet Ersatzproben mit der Nummer der ursprünglich vorgesehenen Probe", () => {
    const [group] = buildOrderResultGroups([
      meas("1", {
        original_sample_id: "s-alt",
        original_sample: { id: "s-alt", sample_number: "P-ALT", sample_name: "Alt" },
        measurement_results: [res("x", 1)],
      }),
      meas("2", { original_sample_id: "s-2", measurement_results: [res("x", 2)] }),
      meas("3", { original_sample_id: "s-weg", original_sample: null, measurement_results: [res("x", 3)] }),
    ]);
    expect(group.rows.map((r) => [r.isReplacement, r.originalSampleNumber])).toEqual([
      [true, "P-ALT"],
      [false, null],
      [true, "–"],
    ]);
  });

  it("führt Messungen ohne offizielle Werte als leere Zeile, sofern die Dienstleistung Ergebnisspalten hat", () => {
    const [group] = buildOrderResultGroups([
      meas("1", { measurement_results: [res("x", 1)] }),
      meas("2", { measurement_results: null }),
    ]);
    expect(group.rows.map((r) => r.measurementId)).toEqual(["1", "2"]);
    expect(group.rows[1].cells).toEqual({});
    expect(group.averages.x).toEqual({ average: 1, count: 1, total: 2 });
  });
});
