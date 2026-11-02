import type { FormLayoutTree, LayoutNode, SectionNode } from "@/lib/api/formDefinitionLayout";

/** Local display projection only: never persisted or used for field values. */
export function compactM3UpperLayout(tree: FormLayoutTree): FormLayoutTree {
  const titles = ["Kopfdaten", "Kontrollfelder", "Berechnungen"];
  // Custom/ambiguous layouts are left intact instead of guessing field ownership.
  if (tree.nodes.length !== titles.length) return tree;
  const sections: SectionNode[] = [];
  for (const title of titles) {
    const matches = tree.nodes.filter((node): node is SectionNode => node.type === "section" && node.title === title);
    if (matches.length !== 1) return tree;
    sections.push(matches[0]);
  }
  const fullWidth = (node: SectionNode): LayoutNode => ({ ...node, width: 12 });
  return {
    version: 1,
    nodes: [{
      id: "m3-upper-columns", type: "columns", width: 12, columnCount: 2,
      className: "m3-upper-columns", ratios: [1, 1],
      children: [
        { id: "m3-upper-header", type: "column", children: [fullWidth(sections[0])] },
        { id: "m3-upper-controls", type: "column", children: sections.slice(1).map(fullWidth) },
      ],
    }],
  };
}