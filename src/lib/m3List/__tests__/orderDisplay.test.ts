import { describe, expect, it } from "vitest";
import { m3OrderLabel, withM3OrderDisplay } from "../orderDisplay";
import { deriveM3Values, stripDerivedValues } from "../derive";
import { buildNoxHandover } from "../noxHandover";

describe("m³ order display", () => {
  it("uses the first nine characters and the linked project name", () => {
    expect(m3OrderLabel("0040-6129-XYZ", "Miratech SCR")).toBe("0040-6129 Miratech SCR");
  });

  it("keeps an existing nine-character or shorter identifier", () => {
    expect(m3OrderLabel("0040-6129", "Miratech SCR")).toBe("0040-6129 Miratech SCR");
    expect(m3OrderLabel("123", "Projekt")).toBe("123 Projekt");
  });

  it.each([null, undefined, "", "   "])("shows only the project when the identifier is %s", (identifier) => {
    expect(m3OrderLabel(identifier, "Miratech SCR")).toBe("Miratech SCR");
  });

  it.each([null, undefined, "", "   "])("shows only the identifier when the linked project name is %s", (projectName) => {
    expect(m3OrderLabel("0040-6129-XYZ", projectName)).toBe("0040-6129");
  });

  it("never substitutes the internal order number or the imported project text", () => {
    const original = { order_number: "SW-260003", project_name: "Unlinked imported name" };
    expect(withM3OrderDisplay(original, null, null).order_number).toBe("");
    expect(original.order_number).toBe("SW-260003");
  });

  it("does not change derived calculations, saved values or NOx handover", () => {
    const derived = deriveM3Values({
      release: { release_number: "0040-6129-XYZ", length_mm: 520, cell_configuration: "40", project_name: "Imported text" },
      orderNumber: "SW-260003",
      stored: { delivery_volume_m3: 8, av_nox: 25 },
      constants: { crossSectionM: 0.15, pressureTestMm: 150, rsmMaxMm: 350, laborKatAddMm: 50, elementRounding: 10 },
    });
    const before = structuredClone(derived.values);
    const saved = stripDerivedValues(derived.values);
    const handover = buildNoxHandover(derived.values);
    const display = withM3OrderDisplay(derived.values, "0040-6129-XYZ", "Miratech SCR");
    expect(display.order_number).toBe("0040-6129 Miratech SCR");
    expect(derived.values).toEqual(before);
    expect(derived.values.order_number).toBe("SW-260003");
    expect(stripDerivedValues(derived.values)).toEqual(saved);
    expect(buildNoxHandover(derived.values)).toEqual(handover);
    const { order_number: _displayOrder, ...displayRest } = display;
    const { order_number: _originalOrder, ...originalRest } = before;
    expect(displayRest).toEqual(originalRest);
  });
});