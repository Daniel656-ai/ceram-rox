import { describe, expect, it } from "vitest";
import { readM3Constants } from "@/lib/m3List/constants";

describe("m³-Konstanten erkennen", () => {
  it("erkennt manuell angelegte Felder über die Bezeichnung und Textwerte", () => {
    const state = readM3Constants([
      { field_key: "elementquerschnitt", display_name: "Elementquerschnitt (Kantenlänge)", data_type: "text", default_value: "0,15", data_source: "manual" },
      { field_key: "laenge_dp", display_name: "Länge je Druckprüfung", data_type: "decimal", default_value: "150", data_source: "constant" },
      { field_key: "rsm_max", display_name: "RSM-Länge (Maximum)", data_type: "decimal", default_value: "350", data_source: "constant" },
      { field_key: "laborkat", display_name: "Laborkat-Zuschlag", data_type: "decimal", default_value: "50", data_source: "constant" },
      { field_key: "rundung", display_name: "Rundungsschritt Elementanzahl", data_type: "number", default_value: "10", data_source: "constant" },
    ] as never[]);
    expect(state.missing).toEqual([]);
    expect(state.constants).toEqual({
      crossSectionM: 0.15,
      pressureTestMm: 150,
      rsmMaxMm: 350,
      laborKatAddMm: 50,
      elementRounding: 10,
    });
  });

  it("meldet weiterhin fehlende Konstanten ohne Ersatzwert", () => {
    const state = readM3Constants([] as never[]);
    expect(state.constants).toBeNull();
    expect(state.missing).toHaveLength(5);
  });
});
