import { describe, it, expect } from "vitest";
import { buildNavItems, stepSelection } from "@/lib/results/sampleNavigation";
import type { OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup } from "@/lib/results/sampleResultsAggregation";

const s = (k: string) => ({ sampleKey: k }) as SampleGroup;
const o = (k: string, samples: string[]) => ({ orderKey: k, samples: samples.map(s) }) as OrderGroup;

describe("Seitenleiste: Navigation per Pfeiltasten", () => {
  const orders = [o("A", ["a1", "a2"]), o("B", ["b1"]), o("C", ["c1", "c2"])];

  it("nach Auftrag: nur Proben aufgeklappter Aufträge in Listenreihenfolge", () => {
    const items = buildNavItems("order", orders, new Set(["A", "C"]), []);
    expect(items.map((i) => `${i.orderKey}:${i.sampleKey}`)).toEqual(["A:a1", "A:a2", "C:c1", "C:c2"]);
  });

  it("nach Probe: alle Proben ohne Auftragsbezug", () => {
    const items = buildNavItems("sample", orders, new Set(), [s("x"), s("y")]);
    expect(items).toEqual([{ orderKey: null, sampleKey: "x" }, { orderKey: null, sampleKey: "y" }]);
  });

  it("springt auftragsübergreifend vor und zurück, bleibt an den Enden stehen", () => {
    const items = buildNavItems("order", orders, new Set(["A", "C"]), []);
    expect(stepSelection(items, { orderKey: "A", sampleKey: "a2" }, 1)).toEqual({ orderKey: "C", sampleKey: "c1" });
    expect(stepSelection(items, { orderKey: "C", sampleKey: "c1" }, -1)).toEqual({ orderKey: "A", sampleKey: "a2" });
    expect(stepSelection(items, { orderKey: "C", sampleKey: "c2" }, 1)).toEqual({ orderKey: "C", sampleKey: "c2" });
    expect(stepSelection(items, { orderKey: "A", sampleKey: "a1" }, -1)).toEqual({ orderKey: "A", sampleKey: "a1" });
  });

  it("ohne Auswahl oder bei unbekannter Auswahl: ↓ beginnt oben, ↑ unten; leere Liste = null", () => {
    const items = buildNavItems("order", orders, new Set(["A"]), []);
    expect(stepSelection(items, null, 1)).toEqual({ orderKey: "A", sampleKey: "a1" });
    expect(stepSelection(items, { orderKey: "B", sampleKey: "b1" }, -1)).toEqual({ orderKey: "A", sampleKey: "a2" });
    expect(stepSelection([], null, 1)).toBeNull();
  });
});
