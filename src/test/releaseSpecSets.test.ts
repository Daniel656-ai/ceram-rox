import { describe, it, expect } from "vitest";
import { normalizeSpecSets, describeSaveError } from "@/lib/productionRelease/specSets";
import { coerceFieldValue } from "@/lib/productionRelease/fields";
import { formatSpecValue, normalizeReleaseType, parseSpecNumber } from "@/lib/productionRelease/releaseTypes";
import { mergeBlockResults } from "@/lib/productionRelease/blocks";

describe("Fertigungsfreigabe – NOx Vorgabensätze", () => {
  it("wandelt Änderungsdatum TT.MM.JJJJ in ISO (Ursache des Speicherfehlers)", () => {
    expect(coerceFieldValue("delivery_date", "25.03.2025")).toBe("2025-03-25");
  });

  it("beschreibt Backend-Fehlerobjekte statt „Unbekannte Ursache“", () => {
    const msg = describeSaveError({ message: "date/time field value out of range", code: "22008", step: "Fertigungsfreigabe anlegen" });
    expect(msg).toContain("22008");
    expect(msg).toContain("Fertigungsfreigabe anlegen");
  });

  it("übernimmt mehrere Sätze, trennt Wert/Einheit und markiert unsichere Werte", () => {
    const sets = normalizeSpecSets([
      { label: "Messpunkt 1", parameters: [
        { key: "temperature", value: "205", unit: "°C", confidence: "high" },
        { key: "av", value: "25", unit: "m/h", confidence: "high" },
        { key: "flowrate", value: "1,2", unit: "Nm³/h", confidence: "high" },
        { key: "NH3", value: "180", unit: "ppm", confidence: "medium" },
        { key: "alpha", value: "1,2", confidence: "high" },
      ] },
      { parameters: [{ key: "temperature", value: "350", unit: "°C", confidence: "high" }] },
    ], "nox_aktivitaetsmessung");
    expect(sets).toHaveLength(2);
    const v = sets[0].values;
    expect(v.find((x) => x.parameter_key === "flowrate")?.value_num).toBe(1.2);
    expect(v.find((x) => x.parameter_key === "nh3")?.needs_review).toBe(true);
    expect(v.find((x) => x.parameter_key === "alpha")?.unit).toBe("-");
    expect(v.find((x) => x.parameter_key === "temperature")?.needs_review).toBe(false);
    expect(sets[1].label).toBe("Vorgabensatz 2");
  });

  it("fehlende Parameter erzeugen keinen Fehler", () => {
    expect(normalizeSpecSets([{ parameters: [] }, { parameters: [{ key: "av", value: "", confidence: "high" }] }], "nox_aktivitaetsmessung")).toEqual([]);
  });

  it("formatiert mit Einheit", () => {
    expect(formatSpecValue({ value_num: 1.2, unit: "Nm³/h" })).toBe("1,2 Nm³/h");
    expect(formatSpecValue({ value_num: 205, unit: "°C" })).toBe("205 °C");
    expect(parseSpecNumber("19,3 m/h")).toBe(19.3);
    expect(normalizeReleaseType("unbekannt")).toBe("nox_aktivitaetsmessung");
  });

  it("führt Vorgabensätze mehrerer Blöcke ohne Duplikate zusammen", () => {
    const block = (pages: number[]) => ({ index: 0, pageNumbers: pages, pages: pages.map(() => "x"), images: [] as string[] });
    const set = { parameters: [{ key: "temperature", value: "205", unit: "°C", confidence: "high" }] };
    const merged = mergeBlockResults([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { block: block([1]) as any, res: { fields: {}, testParameters: [], document: {}, changes: [], releaseType: "nox_aktivitaetsmessung", specSets: [set] } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { block: block([2]) as any, res: { fields: {}, testParameters: [], document: {}, changes: [], specSets: [set, { parameters: [{ key: "temperature", value: "350", unit: "°C", confidence: "high" }] }] } },
    ]);
    expect(merged.releaseType).toBe("nox_aktivitaetsmessung");
    expect(merged.specSets).toHaveLength(2);
  });
});
