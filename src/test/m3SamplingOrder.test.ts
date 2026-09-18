import { describe, it, expect } from "vitest";
import { matchSamplingCodes } from "@/lib/samplingCodeMap";
import { buildNoxHandover, mapNoxHandoverToParameters } from "@/lib/m3List/noxHandover";

const services = [
  { id: "s-geo", service_name: "Geometrievermessung" },
  { id: "s-nox", service_name: "NOX-Messung" },
  { id: "s-sox", service_name: "SOX-Messung" },
  { id: "s-bet", service_name: "BET" },
  { id: "s-bnox", service_name: "BENCH NOx" },
  { id: "s-bsox", service_name: "BENCH SOx" },
];

describe("m³-Liste → Kundenauftrag: Beprobungsauswahl", () => {
  it("Test 1 – NOx erzeugt die NOX-Messung", () => {
    const { matched, missing } = matchSamplingCodes(["NOx"], services);
    expect(matched.map((m) => m.id)).toEqual(["s-nox"]);
    expect(missing).toEqual([]);
  });

  it("Test 2 – abgewähltes NOx erzeugt keine NOX-Messung", () => {
    const { matched } = matchSamplingCodes(["BET"], services);
    expect(matched.map((m) => m.service_name)).toEqual(["BET"]);
  });

  it("Test 3 – Bench erzeugt BENCH NOx und BENCH SOx, aber keinen Dienst „Bench“", () => {
    const { matched } = matchSamplingCodes(["Bench"], services);
    expect(matched.map((m) => m.service_name)).toEqual(["BENCH NOx", "BENCH SOx"]);
    expect(matched.some((m) => m.service_name.toLowerCase() === "bench")).toBe(false);
  });

  it("Test 4 – Geo, NOx, BET erzeugen genau drei Dienstleistungen", () => {
    const { matched, missing } = matchSamplingCodes(["Geo", "NOx", "BET"], services);
    expect(matched.map((m) => m.service_name)).toEqual([
      "Geometrievermessung",
      "NOX-Messung",
      "BET",
    ]);
    expect(missing).toEqual([]);
  });

  it("unbekannte Kürzel werden transparent gemeldet", () => {
    const { matched, missing } = matchSamplingCodes(["XY"], services);
    expect(matched).toEqual([]);
    expect(missing).toEqual(["XY"]);
  });
});

describe("NOx-Vorgaben aus der Fertigungsfreigabe", () => {
  const values = {
    micro_nox: "3 × 150 mm",
    av_nox: "24",
    cell_count: "40",
    length_mm: "1200",
    article_number: "A-42",
    release_label: "0020-6047 / Rev. 1",
    lab_tests: "Geo, NOx",
  };

  it("übernimmt nur vorhandene Felder der Dienstleistung", () => {
    const handover = buildNoxHandover(values);
    const rows = mapNoxHandoverToParameters(
      [
        { field_key: "micro_nox", display_name: "Mikrostück NOx", unit: null },
        { field_key: "av_nox", display_name: "AV-NOx", unit: null },
        { field_key: "sonstiges", display_name: "Sonstiges", unit: null },
      ],
      handover,
      "m-1"
    );
    expect(rows).toEqual([
      { order_measurement_id: "m-1", parameter_name: "Mikrostück NOx", parameter_value: "3 × 150 mm", unit: null },
      { order_measurement_id: "m-1", parameter_name: "AV-NOx", parameter_value: "24", unit: null },
    ]);
  });

  it("erkennt Zielfelder auch über den Anzeigenamen", () => {
    const rows = mapNoxHandoverToParameters(
      [{ field_key: "f1", display_name: "Artikelnummer", unit: null }],
      buildNoxHandover(values),
      "m-2"
    );
    expect(rows).toEqual([
      { order_measurement_id: "m-2", parameter_name: "Artikelnummer", parameter_value: "A-42", unit: null },
    ]);
  });

  it("legt ohne passendes Feld nichts an", () => {
    expect(mapNoxHandoverToParameters([], buildNoxHandover(values), "m-3")).toEqual([]);
  });

  it("überträgt keine leeren Werte", () => {
    expect(buildNoxHandover({ micro_nox: "", av_nox: null }).length).toBe(0);
  });
});
