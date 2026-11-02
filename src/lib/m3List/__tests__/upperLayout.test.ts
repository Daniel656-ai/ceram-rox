import { describe, expect, it } from "vitest";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import { compactM3UpperLayout } from "../upperLayout";

const tree: FormLayoutTree = {
  version: 1,
  nodes: ["Kopfdaten", "Kontrollfelder", "Berechnungen"].map((title, i) => ({
    type: "section", id: `s${i}`, title,
    children: [{ type: "field", id: `n${i}`, field_id: `f${i}` }],
  })),
};

describe("m³ upper projection preserves field ownership", () => {
  it("keeps all original child arrays and leaves the source untouched", () => {
    const original = JSON.stringify(tree);
    const result = compactM3UpperLayout(tree);
    const columns = result.nodes[0];
    if (columns.type !== "columns") throw new Error("Projection missing");
    const sections = columns.children.flatMap(c => c.children);
    expect(sections.map(n => n.id)).toEqual(["s0", "s1", "s2"]);
    sections.forEach((n, i) => {
      if (n.type !== "section" || tree.nodes[i].type !== "section") throw new Error("Section missing");
      expect(n.children).toBe(tree.nodes[i].children);
    });
    expect(JSON.stringify(tree)).toBe(original);
  });
  it("leaves unknown, missing and duplicated sections intact", () => {
    const variants: FormLayoutTree[] = [
      { version: 1, nodes: tree.nodes.slice(1) },
      { version: 1, nodes: [...tree.nodes, { type: "note", id: "extra", text: "Keep" }] },
      { version: 1, nodes: [tree.nodes[0], tree.nodes[0], tree.nodes[2]] },
    ];
    variants.forEach(v => expect(compactM3UpperLayout(v)).toBe(v));
  });
});