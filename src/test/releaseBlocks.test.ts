import { describe, it, expect } from "vitest";
import { buildBlocks, mergeBlockResults } from "@/lib/productionRelease/blocks";
import type { VisualDocument, VisualPage } from "@/lib/productionRelease/pdfVisual";

function page(n: number, text: string, image = false): VisualPage {
  return {
    page: n,
    text,
    items: [],
    lines: text ? [text] : [],
    pairs: [],
    imageDataUrl: image ? "data:image/jpeg;base64,AAAA" : undefined,
    ocrNeeded: image,
  };
}

function doc(pages: VisualPage[]): VisualDocument {
  return {
    fileName: "test.pdf",
    pages,
    pageTexts: pages.map((p) => p.text),
    hasVisualEvidence: false,
  };
}

describe("Blockbildung für große Fertigungsfreigaben", () => {
  it("verteilt alle Seiten genau einmal auf Blöcke", () => {
    const pages = Array.from({ length: 37 }, (_, i) => page(i + 1, `Seite ${i + 1} Inhalt`));
    const blocks = buildBlocks(doc(pages));
    const covered = blocks.flatMap((b) => b.pageNumbers);
    expect(covered).toEqual(pages.map((p) => p.page));
    expect(new Set(covered).size).toBe(37);
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("schneidet auch sehr lange Seiten nicht ab", () => {
    const long = "x".repeat(120_000);
    const blocks = buildBlocks(doc([page(1, long), page(2, "kurz")]));
    expect(blocks.flatMap((b) => b.pages).join("").length).toBe(long.length + 4);
    expect(blocks.flatMap((b) => b.pageNumbers)).toEqual([1, 2]);
  });

  it("begrenzt Seitenbilder je Block, verliert aber keine Seite", () => {
    const pages = Array.from({ length: 9 }, (_, i) => page(i + 1, "", true));
    const blocks = buildBlocks(doc(pages));
    expect(blocks.flatMap((b) => b.pageNumbers)).toHaveLength(9);
    for (const b of blocks) expect(b.images.length).toBeLessThanOrEqual(3);
  });
});

describe("Zusammenführung der Blockergebnisse", () => {
  const block = (nums: number[]) => ({ pageNumbers: nums, pages: [""], pairs: [], images: [] });

  it("nimmt die höchste Revision aus dem gesamten Dokument", () => {
    const merged = mergeBlockResults([
      { block: block([1, 2]), res: { fields: {}, testParameters: [], document: { revision_number: "1", revision_date: "01.02.2026" }, changes: [] } },
      { block: block([7, 8]), res: { fields: {}, testParameters: [], document: { revision_number: "2" }, changes: [] } },
      { block: block([12]), res: { fields: {}, testParameters: [], document: { revision_number: "3", revision_date: "20.04.2026" }, changes: [] } },
    ]);
    expect(merged.document.revision_number).toBe("3");
    expect(merged.document.revision_date).toBe("20.04.2026");
  });

  it("sammelt Änderungen späterer Seiten mit", () => {
    const merged = mergeBlockResults([
      { block: block([1]), res: { fields: {}, testParameters: [], document: {}, changes: [{ field_key: "piece_count", new_value: "14", page: 1 }] } },
      { block: block([11, 12]), res: { fields: {}, testParameters: [], document: {}, changes: [{ field_key: "length_mm", new_value: "1250", page: 11 }] } },
    ]);
    expect(merged.changes).toHaveLength(2);
    expect(merged.changes.map((c) => c.field_key)).toContain("length_mm");
  });

  it("meldet widersprüchliche Werte als Prüfpunkt statt sie zu überschreiben", () => {
    const merged = mergeBlockResults([
      { block: block([1]), res: { fields: { piece_count: "12" }, testParameters: [], document: {}, changes: [] } },
      { block: block([9]), res: { fields: { piece_count: "14" }, testParameters: [], document: {}, changes: [] } },
    ]);
    expect(merged.fields.piece_count).toBe("12");
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0].auto).toBe(false);
    expect(merged.conflicts[0].new_value).toBe("14");
  });
});
