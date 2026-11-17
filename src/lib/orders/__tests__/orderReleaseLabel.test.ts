import { describe, it, expect } from "vitest";
import { buildOrderReleaseLabels, releaseLabel } from "../orderReleaseLabel";

describe("releaseLabel", () => {
  it("9 Stellen Artikelnummer + Revision", () => {
    expect(releaseLabel({ article_number: "0020-5438-300-0520", revision_number: 0 })).toBe("0020-5438 · Rev0");
  });
  it("ohne Artikelnummer: Freigabenummer", () => {
    expect(releaseLabel({ release_number: "FF-7", revision_number: 2 })).toBe("FF-7 · Rev2");
  });
  it("nichts vorhanden: null", () => {
    expect(releaseLabel({})).toBeNull();
  });
});

describe("buildOrderReleaseLabels", () => {
  const rels = [
    { id: "r0", order_id: "o1", article_number: "0020-5438-300", revision_number: 0, is_current: false },
    { id: "r1", order_id: "o1", article_number: "0020-5438-300", revision_number: 1, is_current: true },
    { id: "x", order_id: null, article_number: "9999-9999", revision_number: 0 },
  ];
  it("nimmt die Revision der m³-Liste, sonst aktuelle", () => {
    expect(buildOrderReleaseLabels(rels, [{ order_id: "o1", based_on_release_id: "r0" }]).get("o1")).toBe("0020-5438 · Rev0");
    expect(buildOrderReleaseLabels(rels, []).get("o1")).toBe("0020-5438 · Rev1");
  });
  it("ohne Revision-Markierung: höchste Revision", () => {
    const l = buildOrderReleaseLabels(rels.map((r) => ({ ...r, is_current: false })), []);
    expect(l.get("o1")).toBe("0020-5438 · Rev1");
  });
  it("Aufträge ohne Freigabe fehlen in der Karte", () => {
    expect(buildOrderReleaseLabels(rels, []).has("o2")).toBe(false);
  });
});
