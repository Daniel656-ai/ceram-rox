import { describe, it, expect } from "vitest";
import { groupStoragePaths } from "../orderStoragePaths";

describe("groupStoragePaths", () => {
  it("gruppiert je Bucket, entfernt leere und doppelte Pfade", () => {
    const m = groupStoragePaths([
      { bucket: "a", path: "x/1.pdf" },
      { bucket: "a", path: "x/1.pdf" },
      { bucket: "a", path: " " },
      { bucket: "b", path: "y/2.png" },
      { bucket: "b", path: null },
    ]);
    expect(m.get("a")).toEqual(["x/1.pdf"]);
    expect(m.get("b")).toEqual(["y/2.png"]);
    expect(m.size).toBe(2);
  });
  it("leer bei keiner Datei", () => {
    expect(groupStoragePaths([]).size).toBe(0);
  });
});
