import { describe, it, expect } from "vitest";
import {
  readMasterDataRef,
  writeMasterDataRef,
  resolveMasterDataRef,
  masterDataRefToken,
  masterDataAttributeDisplayName,
  masterDataItemDisplayName,
} from "@/lib/masterDataRef";
import { toPlain, toUnicode } from "@/lib/richText";
import type { MasterDataCategory } from "@/lib/api/globalLibrary";

const catalog = [
  {
    list: { id: "l1", list_key: "gaszusammensetzung", display_name: "Gaszusammensetzung" },
    attributes: [
      { id: "a1", attribute_key: "o2", display_name: "O₂", unit: "%" },
      { id: "a2", attribute_key: "no", display_name: "NO", unit: "ppm" },
    ],
    items: [
      { id: "i1", item_value: "standard", label: "Standard", metadata: { o2: 3 } },
    ],
  },
] as unknown as MasterDataCategory[];

describe("Stammdatenreferenz", () => {
  it("liest und schreibt die Referenz in Metadaten", () => {
    const md = writeMasterDataRef({ other: 1 }, { list_key: "g", item_value: "s", attribute_key: "o2" });
    expect(md.other).toBe(1);
    expect(readMasterDataRef(md)?.attribute_key).toBe("o2");
    expect(readMasterDataRef(writeMasterDataRef(md, null))).toBeNull();
  });

  it("liefert den aktuellen Stammdatenwert inkl. Einheit", () => {
    const res = resolveMasterDataRef(
      { list_key: "gaszusammensetzung", item_value: "standard", attribute_key: "o2" },
      catalog
    );
    expect(res).toMatchObject({ status: "ok", value: 3, unit: "%" });
  });

  it("meldet fehlenden Wert statt Fallback", () => {
    const res = resolveMasterDataRef(
      { list_key: "gaszusammensetzung", item_value: "standard", attribute_key: "no" },
      catalog
    );
    expect(res.status).toBe("missing");
  });

  it("meldet fehlende Kategorie und Einträge", () => {
    expect(resolveMasterDataRef({ list_key: "x", item_value: "s", attribute_key: "o2" }, catalog).status).toBe("missing");
    expect(
      resolveMasterDataRef({ list_key: "gaszusammensetzung", item_value: "x", attribute_key: "o2" }, catalog).status
    ).toBe("missing");
  });

  it("erzeugt den passenden Stammdaten-Token", () => {
    expect(masterDataRefToken({ list_key: "g", item_value: "s", attribute_key: "o2" })).toBe("{{stammdaten.g.s.o2}}");
  });

  it("formatiert technische Anzeigen nur für Desktop und lässt Schlüssel stabil", () => {
    expect(masterDataAttributeDisplayName("volumsanteil", "Zusammensetzung", true)).toBe("Volumsanteil");
    expect(masterDataAttributeDisplayName("cp", "cp", true)).toBe("c_{p}");
    expect(masterDataAttributeDisplayName("cv", "cv", true)).toBe("c_{v}");
    expect(toUnicode(masterDataAttributeDisplayName("cp", "cp", true))).toBe("cₚ");
    expect(toPlain(masterDataAttributeDisplayName("cp", "cp", true))).toBe("cp");
    expect(masterDataAttributeDisplayName("cp", "cp", false)).toBe("cp");
    expect(masterDataAttributeDisplayName("molmasse", "Molmasse", true)).toBe("Molmasse");
  });

  it("formatiert Gasbezeichnungen nur für Desktop und erhält technische Werte", () => {
    expect(toUnicode(masterDataItemDisplayName("O2", "O2", true))).toBe("O₂");
    expect(toUnicode(masterDataItemDisplayName("H2O", "H2O", true))).toBe("H₂O");
    expect(toUnicode(masterDataItemDisplayName("CO2", "CO2", true))).toBe("CO₂");
    expect(toUnicode(masterDataItemDisplayName("N2", "N2", true))).toBe("N₂");
    expect(masterDataItemDisplayName("O2", "O2", false)).toBe("O2");
  });
});
