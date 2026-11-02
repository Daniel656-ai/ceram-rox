import { describe, it, expect } from "vitest";
import { splitLayoutAtField } from "../layoutSplit";
import { buildM3PdfModel } from "../pdfExport";
import type { FormLayoutTree, LayoutNode } from "@/lib/api/formDefinitionLayout";

const field = (id: string, fieldId: string): LayoutNode =>
  ({ id, type: "field", field_id: fieldId, width: 6 }) as LayoutNode;
const section = (id: string, title: string, children: LayoutNode[]): LayoutNode =>
  ({ id, type: "section", title, children, width: 12 }) as LayoutNode;

describe("splitLayoutAtField", () => {
  it("teilt an einem verschachtelten Feld: kein Abschnitt zwischen Block und Tabelle", () => {
    const tree: FormLayoutTree = {
      version: 1,
      nodes: [
        section("s1", "Kopfdaten", [field("f1", "order_number"), field("f2", "project_name")]),
        section("s2", "m³-Tabelle", [field("f3", "m3_rows")]),
        section("s3", "Bestätigungen", [field("f4", "responsible")]),
      ],
    };
    const split = splitLayoutAtField(tree, "m3_rows");
    expect(split.found).toBe(true);
    expect(split.before.nodes.map((n) => n.id)).toEqual(["s1"]);
    expect(split.at.nodes.map((n) => n.id)).toEqual(["s2", "s3"]);
  });

  it("teilt Container rekursiv, wenn das Feld mitten in einem Abschnitt steht", () => {
    const tree: FormLayoutTree = {
      version: 1,
      nodes: [
        section("s1", "Gemischt", [field("f1", "a"), field("f2", "m3_rows"), field("f3", "b")]),
      ],
    };
    const split = splitLayoutAtField(tree, "m3_rows");
    expect(split.found).toBe(true);
    // Der Abschnitt wird in zwei Hälften geteilt: vor dem Feld und ab dem Feld.
    expect(split.before.nodes).toHaveLength(1);
    expect((split.before.nodes[0] as { children: LayoutNode[] }).children.map((n) => n.id)).toEqual(["f1"]);
    expect(split.at.nodes).toHaveLength(1);
    expect((split.at.nodes[0] as { children: LayoutNode[] }).children.map((n) => n.id)).toEqual(["f2", "f3"]);
  });

  it("findet das Feld nicht: unverändertes Verhalten als Fallback", () => {
    const tree: FormLayoutTree = { version: 1, nodes: [field("f1", "a")] };
    const split = splitLayoutAtField(tree, "m3_rows");
    expect(split.found).toBe(false);
    expect(split.before.nodes).toHaveLength(1);
    expect(split.at.nodes).toHaveLength(0);
  });

  it("verändert den ursprünglichen Baum nicht", () => {
    const tree: FormLayoutTree = {
      version: 1,
      nodes: [section("s1", "Gemischt", [field("f1", "a"), field("f2", "m3_rows")])],
    };
    splitLayoutAtField(tree, "m3_rows");
    expect((tree.nodes[0] as { children: LayoutNode[] }).children).toHaveLength(2);
  });
});

describe("m³-Modell: Verantwortlich und Summen", () => {
  it("leere Verantwortlichkeitsfelder bleiben leer, vorhandene unverändert", () => {
    const m = buildM3PdfModel(
      { m3_rows: [{ row_responsible: "Maria Muster" }, { row_responsible: "" }, {}] },
      { notices: [], testRowIndex: null }
    );
    expect(m.rows.map((r) => r.responsible)).toEqual(["Maria Muster", "", ""]);
  });

  it("Summenzeile enthält keine Gesamtstückzahl mehr", () => {
    const m = buildM3PdfModel(
      { regular_element_total: 970, bench_extra_pieces: 0, total_element_count: 970, m3_rows: [] },
      { notices: [], testRowIndex: null }
    );
    expect(m.totals).toBe("Reguläre Elementanzahl: 970 Stk · Bench-Zusatz: 0 Stk");
    expect(m.totals).not.toContain("Gesamt");
  });
});
