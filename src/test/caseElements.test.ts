import { describe, expect, it } from "vitest";
import {
  buildEntriesFromCase,
  readInstances,
  readMeasurementBlockMeta,
  CASE_ELEMENTS_KEY,
  type CaseTemplate,
} from "@/lib/measurementBlocks";
import { mapReadings } from "@/lib/measurementImport";
import { elementLibrary } from "@/lib/elementKeys";

const CASE_ELEMENTS = ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "V2O5"];

const qualityCase = (order = CASE_ELEMENTS): CaseTemplate => ({
  id: "case-1",
  name: "Qualitätskontrolle",
  elements: order.map((k) => ({ element_key: k, is_official: true })),
  instances: [
    {
      id: "inst-1",
      label: "Messung 1",
      // Unterkategorie / Messkontext enthält bewusst mehr Elemente
      context: Object.fromEntries(
        ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O", "SO3"].map((k) => [k, ""])
      ),
    },
  ],
});

const meta = readMeasurementBlockMeta({ metadata: {}, field_key: "block" } as any);

describe("Messfall-Ergebnisliste", () => {
  it("Test 1: Messfall bestimmt die Ergebnisliste, nicht die Unterkategorie", () => {
    const entries = buildEntriesFromCase(qualityCase());
    const spec = readInstances(entries, meta)[0].elementSpec;
    expect(spec.map((s) => s.key)).toEqual(CASE_ELEMENTS);
    expect(entries[0][CASE_ELEMENTS_KEY]).toEqual(CASE_ELEMENTS);
  });

  it("Test 4: geänderte Reihenfolge wird übernommen", () => {
    const changed = ["V2O5", ...CASE_ELEMENTS.filter((k) => k !== "V2O5")];
    const spec = readInstances(buildEntriesFromCase(qualityCase(changed)), meta)[0].elementSpec;
    expect(spec.map((s) => s.key)).toEqual(changed);
  });

  it("Test 5: zusätzliches Element erweitert die Liste", () => {
    const spec = readInstances(
      buildEntriesFromCase(qualityCase([...CASE_ELEMENTS, "WO3"])),
      meta
    )[0].elementSpec;
    expect(spec).toHaveLength(8);
    expect(spec.at(-1)?.key).toBe("WO3");
  });

  it("globale Elementbibliothek ist vollständig und messfallunabhängig", () => {
    const keys = elementLibrary.map((e) => e.key);
    for (const k of ["SiO2", "BaO", "WO3", "MoO3", "As", "Pb", "Nb", "U", "B"]) {
      expect(keys).toContain(k);
    }
  });
});

describe("Messdatenimport bleibt vom Messfall unabhängig", () => {
  const readings = [
    "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
    "SO3", "P2O5", "V2O5", "WO3", "MoO3", "As", "Pb", "Nb",
  ].map((n, i) => ({ sourceName: `${n} (%)`, value: i + 0.5, raw: String(i), unit: null }) as any);

  const targets = CASE_ELEMENTS.map((k) => ({
    field_key: k.toLowerCase() + "_percent",
    display_name: k,
    element_key: k,
  }));

  it("Test 2: alle 17 Elemente werden erkannt, nur Messfall-Elemente treffen Ergebnisfelder", () => {
    const rows = mapReadings(readings, null, targets, { caseElementKeys: CASE_ELEMENTS });
    expect(rows.filter((r) => r.elementKeyDetected)).toHaveLength(17);
    expect(rows.filter((r) => r.targetFieldKey).map((r) => r.elementKeyDetected)).toEqual(CASE_ELEMENTS);
  });

  it("Test 3: standardlose RFA erkennt alle gelieferten Elemente", () => {
    const allTargets = readings.map((r) => {
      const k = r.sourceName.replace(" (%)", "");
      return { field_key: k.toLowerCase(), display_name: k, element_key: k };
    });
    const rows = mapReadings(readings, null, allTargets, {});
    expect(rows.filter((r) => r.targetFieldKey)).toHaveLength(17);
  });
});
