import { describe, it, expect } from "vitest";
import { normalizeImageValue, moveEntry, readImageMeta, writeImageMeta } from "@/lib/imageGallery";

describe("imageGallery", () => {
  it("liest Einzelbild-Altwerte verlustfrei", () => {
    const e = normalizeImageValue("orders/1/foto/bild.jpg");
    expect(e).toHaveLength(1);
    expect(e[0].storage_path).toBe("orders/1/foto/bild.jpg");
    expect(e[0].comment).toBe("");
  });

  it("normalisiert Sammlungen inkl. Kommentar und Reihenfolge", () => {
    const list = normalizeImageValue(JSON.stringify([
      { storage_path: "b.jpg", comment: "zweitens", sort_order: 1 },
      { storage_path: "a.jpg", comment: "erstens", sort_order: 0 },
    ]));
    expect(list.map((x) => x.storage_path)).toEqual(["a.jpg", "b.jpg"]);
    expect(list[0].comment).toBe("erstens");
  });

  it("ignoriert leere Werte", () => {
    expect(normalizeImageValue(null)).toEqual([]);
    expect(normalizeImageValue("")).toEqual([]);
    expect(normalizeImageValue([{}])).toEqual([]);
  });

  it("verschiebt Einträge und vergibt die Reihenfolge neu", () => {
    const list = normalizeImageValue([{ storage_path: "a" }, { storage_path: "b" }, { storage_path: "c" }]);
    const moved = moveEntry(list, 2, 0);
    expect(moved.map((x) => x.storage_path)).toEqual(["c", "a", "b"]);
    expect(moved.map((x) => x.sort_order)).toEqual([0, 1, 2]);
  });

  it("nutzt Einzelbild als Standardmodus", () => {
    expect(readImageMeta({ metadata: {} }).mode).toBe("multi");
    expect(readImageMeta({ validation: { upload: { multiple: false } } }).mode).toBe("single");
    expect(readImageMeta({ metadata: writeImageMeta({}, { mode: "single" }) }).mode).toBe("single");
    expect(readImageMeta({ metadata: writeImageMeta({}, { mode: "multi" }) }).mode).toBe("multi");

  });
});
