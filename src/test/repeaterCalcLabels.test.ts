import { describe, it, expect } from "vitest";
import { normalizeRepeaterLayout } from "@/lib/repeaterLayout";
import { parseRichText, toUnicode, normalizeUnicodeToMarkup } from "@/lib/richText";

const lay = (item: Record<string, unknown>) => ({ version: 1, gap: "md", items: [item] });
const calc = (o?: unknown) => ({ id: "c", type: "calculation", calc_key: "eta_nox", width: 4, ...(o !== undefined ? { label_override: o } : {}) });

describe("Repeater-Berechnung label_override", () => {
  it("speichert eigenen Namen und stellt ihn wieder her", () => {
    const once = normalizeRepeaterLayout(lay(calc("η NO_{x}")), ["x"]);
    const again = normalizeRepeaterLayout(JSON.parse(JSON.stringify(once)), ["x"]);
    expect(again.items[0]).toMatchObject({ type: "calculation", calc_key: "eta_nox", label_override: "η NO_{x}" });
  });
  it("ohne oder mit leerem Override bleibt der Standardname", () => {
    expect(normalizeRepeaterLayout(lay(calc()), ["x"]).items[0]).not.toHaveProperty("label_override");
    expect(normalizeRepeaterLayout(lay(calc("  ")), ["x"]).items[0]).not.toHaveProperty("label_override");
  });
  it("Beschriftung ändert Schlüssel und Wertbindung nicht", () => {
    const item = normalizeRepeaterLayout(lay({ ...calc("Neu"), calc_id: "id1", value_key: "eta_nox" }), ["x"]).items[0] as any;
    expect(item.calc_key).toBe("eta_nox");
    expect(item.value_key).toBe("eta_nox");
  });
});

describe("Formatierte Beschriftungen", () => {
  it("Hoch-/Tiefstellung", () => {
    expect(toUnicode("m^{3}")).toBe("m³");
    expect(toUnicode("V_{2}O_{5}")).toBe("V₂O₅");
    expect(parseRichText("NO_{x}")).toEqual([{ text: "NO", variant: "normal" }, { text: "x", variant: "sub" }]);
  });
  it("Unicode-Symbole bleiben erhalten", () => {
    const l = normalizeRepeaterLayout(lay(calc("T [°C] NH₃ m²")), ["x"]).items[0] as any;
    expect(toUnicode(l.label_override)).toBe("T [°C] NH₃ m²");
    expect(toUnicode(normalizeUnicodeToMarkup("SO₂"))).toBe("SO₂");
  });
});
