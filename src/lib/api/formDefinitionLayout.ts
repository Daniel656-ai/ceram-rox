/**
 * Layout schema for form_definitions.layout (JSONB).
 * Keeps data structure (form_fields) and presentation (layout tree) separate.
 */

export type LayoutWidth = 12 | 9 | 8 | 6 | 4 | 3;

export interface LayoutNodeBase {
  id: string;
  type: LayoutNodeType;
  visible?: boolean;
  width?: LayoutWidth;
  className?: string;
}

export type LayoutNodeType =
  | "section"
  | "group"
  | "tabs"
  | "tab"
  | "columns"
  | "column"
  | "container"
  | "divider"
  | "heading"
  | "note"
  | "field";

export interface SectionNode extends LayoutNodeBase {
  type: "section";
  title?: string;
  description?: string;
  collapsed?: boolean;
  children: LayoutNode[];
}

export interface GroupNode extends LayoutNodeBase {
  type: "group";
  title?: string;
  children: LayoutNode[];
}

export interface TabsNode extends LayoutNodeBase {
  type: "tabs";
  children: TabNode[];
}
export interface TabNode extends LayoutNodeBase {
  type: "tab";
  title?: string;
  children: LayoutNode[];
}

export interface ColumnsNode extends LayoutNodeBase {
  type: "columns";
  columnCount: 1 | 2 | 3;
  children: ColumnNode[];
}
export interface ColumnNode extends LayoutNodeBase {
  type: "column";
  children: LayoutNode[];
}

export interface ContainerNode extends LayoutNodeBase {
  type: "container";
  title?: string;
  children: LayoutNode[];
}

export interface DividerNode extends LayoutNodeBase {
  type: "divider";
}

export interface HeadingNode extends LayoutNodeBase {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3 | 4;
}

export interface NoteNode extends LayoutNodeBase {
  type: "note";
  text: string;
  variant?: "info" | "warning" | "muted";
}

export interface FieldNode extends LayoutNodeBase {
  type: "field";
  field_id: string;
  label_override?: string;
  description_override?: string;
  readonly?: boolean;
}

export type LayoutNode =
  | SectionNode
  | GroupNode
  | TabsNode
  | TabNode
  | ColumnsNode
  | ColumnNode
  | ContainerNode
  | DividerNode
  | HeadingNode
  | NoteNode
  | FieldNode;

export interface FormLayoutTree {
  version: 1;
  nodes: LayoutNode[];
}

export const emptyLayout = (): FormLayoutTree => ({ version: 1, nodes: [] });

export const isContainerType = (t: LayoutNodeType) =>
  ["section", "group", "tabs", "tab", "columns", "column", "container"].includes(t);

const uid = () => Math.random().toString(36).slice(2, 10);

export const createNode = (type: LayoutNodeType, extra: Partial<LayoutNode> = {}): LayoutNode => {
  const base = { id: uid(), type, visible: true, width: 12 as LayoutWidth, ...extra };
  switch (type) {
    case "section": return { ...base, type, title: "Neuer Abschnitt", children: [] } as SectionNode;
    case "group": return { ...base, type, title: "Gruppe", children: [] } as GroupNode;
    case "tabs": return {
      ...base, type, children: [
        { id: uid(), type: "tab", title: "Tab 1", children: [], visible: true, width: 12 },
        { id: uid(), type: "tab", title: "Tab 2", children: [], visible: true, width: 12 },
      ]
    } as TabsNode;
    case "tab": return { ...base, type, title: "Neuer Tab", children: [] } as TabNode;
    case "columns": {
      const count = (extra as any).columnCount ?? 2;
      return {
        ...base, type, columnCount: count,
        children: Array.from({ length: count }, () => (
          { id: uid(), type: "column", children: [], visible: true, width: 12 } as ColumnNode
        )),
      } as ColumnsNode;
    }
    case "column": return { ...base, type, children: [] } as ColumnNode;
    case "container": return { ...base, type, title: "Panel", children: [] } as ContainerNode;
    case "divider": return { ...base, type } as DividerNode;
    case "heading": return { ...base, type, text: "Überschrift", level: 3 } as HeadingNode;
    case "note": return { ...base, type, text: "Hinweistext …", variant: "info" } as NoteNode;
    case "field": return { ...base, type, field_id: (extra as any).field_id ?? "" } as FieldNode;
  }
};

// --- tree helpers -------------------------------------------------

export function walkNodes(nodes: LayoutNode[], fn: (n: LayoutNode, parent: LayoutNode | null) => void, parent: LayoutNode | null = null) {
  for (const n of nodes) {
    fn(n, parent);
    if ("children" in n && Array.isArray((n as any).children)) walkNodes((n as any).children, fn, n);
  }
}

export function findNode(nodes: LayoutNode[], id: string): LayoutNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ("children" in n && Array.isArray((n as any).children)) {
      const f = findNode((n as any).children, id);
      if (f) return f;
    }
  }
  return null;
}

export function removeNode(nodes: LayoutNode[], id: string): LayoutNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => {
      if ("children" in n && Array.isArray((n as any).children)) {
        return { ...n, children: removeNode((n as any).children, id) } as LayoutNode;
      }
      return n;
    });
}

export function updateNode(nodes: LayoutNode[], id: string, patch: Partial<LayoutNode>): LayoutNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, ...patch } as LayoutNode;
    if ("children" in n && Array.isArray((n as any).children)) {
      return { ...n, children: updateNode((n as any).children, id, patch) } as LayoutNode;
    }
    return n;
  });
}

/** Insert a node into a parent container at index, or at root if parentId is null. */
export function insertNode(nodes: LayoutNode[], parentId: string | null, index: number, newNode: LayoutNode): LayoutNode[] {
  if (parentId === null) {
    const copy = nodes.slice();
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, newNode);
    return copy;
  }
  return nodes.map(n => {
    if (n.id === parentId && "children" in n && Array.isArray((n as any).children)) {
      const children = (n as any).children.slice();
      children.splice(Math.max(0, Math.min(index, children.length)), 0, newNode);
      return { ...n, children } as LayoutNode;
    }
    if ("children" in n && Array.isArray((n as any).children)) {
      return { ...n, children: insertNode((n as any).children, parentId, index, newNode) } as LayoutNode;
    }
    return n;
  });
}

/** Return all field_ids currently placed in the layout tree. */
export function collectUsedFieldIds(nodes: LayoutNode[]): Set<string> {
  const s = new Set<string>();
  walkNodes(nodes, (n) => {
    if (n.type === "field" && (n as FieldNode).field_id) s.add((n as FieldNode).field_id);
  });
  return s;
}

export function normalizeLayout(raw: unknown): FormLayoutTree {
  if (!raw || typeof raw !== "object") return emptyLayout();
  const asObj = raw as Record<string, unknown>;
  if (Array.isArray((asObj as any).nodes)) {
    return { version: 1, nodes: (asObj as any).nodes as LayoutNode[] };
  }
  return emptyLayout();
}
