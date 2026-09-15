import { describe, expect, it } from "vitest";
import { globalConstantScope, parseGlobalConstantValue } from "@/lib/globalConstants";
import { evaluateFormula } from "@/lib/formulaEngine";

describe("globale technische Konstanten", () => {
  const c = {
    field_key: "C",
    display_name: "C",
    data_source: "constant",
    data_type: "decimal",
    default_value: "0,972",
  };

  it("löst deutsche Dezimalwerte numerisch auf", () => {
    expect(parseGlobalConstantValue(c)).toBe(0.972);
  });

  it("stellt C der Formel-Engine als globale Variable bereit", () => {
    const scope = globalConstantScope([c]);
    expect(evaluateFormula("C * 2", scope).value).toBeCloseTo(1.944);
  });

  it("behandelt andere Datenquellen nicht als Konstanten", () => {
    expect(globalConstantScope([{ ...c, data_source: "system" }])).toEqual({});
  });
});