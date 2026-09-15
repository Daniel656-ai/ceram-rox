import { describe, it, expect } from "vitest";
import {
  readMasterDataRef,
  writeMasterDataRef,
  resolveMasterDataRef,
  masterDataRefToken,
} from "@/lib/masterDataRef";
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
});
