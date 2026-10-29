import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RichText from "@/components/forms/RichText";
import { normalizeRepeaterLayout, layoutLabelOverrides, columnLabel } from "@/lib/repeaterLayout";

const layout = {
  version: 1,
  gap: "md",
  items: [
    { id: "a", type: "field", key: "t", width: 6, label_override: "T_{Ofen}" },
    { id: "b", type: "field", key: "v", width: 6 },
    {
      id: "g", type: "group", title: "G", width: 12,
      children: [
        { id: "c", type: "calculation", calc_key: "eta_nox", width: 4, label_override: "η NO_{x}" },
        { id: "d", type: "calculation", calc_key: "k", width: 4, label_override: "   " },
      ],
    },
  ],
};

const ov = () => layoutLabelOverrides(normalizeRepeaterLayout(layout, ["t", "v"]));

describe("Repeater-Tabelle: Spaltenüberschriften", () => {
  it("Feld mit eigenem Anzeigenamen", () => {
    expect(columnLabel(ov().fields.get("t"), "Temperatur")).toBe("T_{Ofen}");
  });
  it("Berechnung mit eigenem Anzeigenamen (auch in Gruppe)", () => {
    expect(columnLabel(ov().calcs.get("eta_nox"), "eta")).toBe("η NO_{x}");
  });
  it("fehlender oder leerer Override fällt auf Standardnamen zurück", () => {
    expect(columnLabel(ov().fields.get("v"), "Volumen")).toBe("Volumen");
    expect(columnLabel(ov().calcs.get("k"), "K-Wert")).toBe("K-Wert");
    expect(columnLabel(undefined, "X")).toBe("X");
    expect(layoutLabelOverrides(normalizeRepeaterLayout(undefined, ["t"])).fields.size).toBe(0);
  });
  it("formatierte Beschriftungen werden wie üblich dargestellt", () => {
    for (const [src, txt] of [["NO_{x}", "NOx"], ["V_{2}O_{5}", "V2O5"], ["m^{3}", "m3"]]) {
      const { container, unmount } = render(<RichText value={columnLabel(src, "fallback")} />);
      expect(container.textContent).toBe(txt);
      expect(container.querySelector("sub, sup")).not.toBeNull();
      unmount();
    }
  });
  it("Schlüssel und Zuordnung bleiben unverändert", () => {
    const n = normalizeRepeaterLayout(layout, ["t", "v"]);
    const keys = n.items.flatMap((i: any) => (i.type === "group" ? i.children : [i])).map((i: any) => i.key ?? i.calc_key);
    expect(keys).toEqual(["t", "v", "eta_nox", "k"]);
    expect([...ov().fields.keys()]).toEqual(["t"]);
  });
});
