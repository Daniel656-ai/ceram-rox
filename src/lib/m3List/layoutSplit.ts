/**
 * Teilt einen Formular-Layoutbaum an einem Feld in zwei Teile:
 * „before“ enthält alles vor dem Feld, „at“ das Feld und alles danach.
 * Container werden dabei rekursiv geteilt, sodass zwischen den beiden
 * Teilen kein anderer Formularabschnitt liegt (für die m³-Liste: der
 * Chargenblock steht dadurch direkt oberhalb der m³-Tabelle).
 *
 * Rein darstellungsbezogen – gespeicherte Layouts bleiben unverändert.
 */
import type { FormLayoutTree, LayoutNode } from "@/lib/api/formDefinitionLayout";

export interface LayoutSplit {
  found: boolean;
  before: FormLayoutTree;
  at: FormLayoutTree;
}

const childrenOf = (n: LayoutNode): LayoutNode[] | null =>
  "children" in n && Array.isArray((n as { children?: LayoutNode[] }).children)
    ? (n as { children: LayoutNode[] }).children
    : null;

function splitNodes(nodes: LayoutNode[], fieldId: string): { found: boolean; before: LayoutNode[]; at: LayoutNode[] } {
  const before: LayoutNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "field" && (node as { field_id?: string }).field_id === fieldId) {
      return { found: true, before, at: nodes.slice(i) };
    }
    const children = childrenOf(node);
    if (children) {
      const inner = splitNodes(children, fieldId);
      if (inner.found) {
        if (inner.before.length) before.push({ ...node, children: inner.before } as LayoutNode);
        return {
          found: true,
          before,
          at: [{ ...node, children: inner.at } as LayoutNode, ...nodes.slice(i + 1)],
        };
      }
    }
    before.push(node);
  }
  return { found: false, before: nodes, at: [] };
}

export function splitLayoutAtField(tree: FormLayoutTree, fieldId: string): LayoutSplit {
  const split = splitNodes(tree.nodes, fieldId);
  return {
    found: split.found,
    before: { version: 1, nodes: split.before },
    at: { version: 1, nodes: split.at },
  };
}
