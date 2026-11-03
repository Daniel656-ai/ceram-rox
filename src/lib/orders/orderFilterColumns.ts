import type { DataTableColumn } from "@/components/data-table/types";
import { orderSamples } from "./orderSamples";
import { orderIdentity } from "./orderIdentity";
import { resolveOrderKind } from "./orderKind";

/** Read-only predicates over the already RLS-hydrated order list. */
export function orderFilterColumns(userId: string | undefined, personName: (id: string) => string,
  label: (key: string) => string): DataTableColumn<any>[] {
  const assigned = (o: any): string[] => (o.order_measurements ?? []).flatMap((m: any) => m.assigned_to ? [m.assigned_to] : []);
  return [
    { key: "identity", header: label("order_number"), accessor: o => `${orderIdentity(o).number} ${o.order_number ?? ""}`, filterable: false },
    { key: "search_samples", header: label("sample"), accessor: o => orderSamples(o).flatMap(s => [s.sample_number, s.sample_name]).join(" "), filterable: false },
    { key: "search_people", header: label("filters.requester"), accessor: o => `${personName(o.created_by)} ${o.customer_name ?? ""}`, filterable: false },
    { key: "search_reference", header: label("notes"), accessor: o => `${o.reference_number ?? ""} ${o.notes ?? ""}`, filterable: false },
    { key: "requester", header: label("filters.requester"), type: "status", accessor: o => o.created_by, searchable: false },
    { key: "project_number", header: label("project_number"), type: "status", accessor: o => o.projects?.project_number },
    { key: "project", header: label("filters.project"), type: "status", accessor: o => o.project_id, searchable: false },
    { key: "project_name", header: label("project_name"), accessor: o => o.projects?.project_name, filterable: false },
    { key: "sample", header: label("sample"), type: "status", accessor: o => orderSamples(o).map(s => s.id), searchable: false },
    { key: "kind", header: label("filters.kind"), type: "status", accessor: o => resolveOrderKind(o),
      statusOrder: ["labor", "pilot_plant", "legacy"], statusLabels: Object.fromEntries(["labor", "pilot_plant", "legacy"].map(k => [k, label(`kind.${k}`)])), searchable: false },
    { key: "search_kind", header: label("kind_label"), accessor: o => label(`kind.${resolveOrderKind(o)}`), filterable: false },
    { key: "order_type", header: label("filters.type"), type: "status", accessor: o => o.order_type, searchable: false },
    { key: "status", header: label("filters.status"), type: "status", accessor: o => o.status, searchable: false },
    { key: "responsible", header: label("filters.responsible"), type: "status", accessor: assigned, searchable: false },
    { key: "creator", header: label("filters.creator"), type: "status", accessor: o => o.created_by, searchable: false },
    { key: "mine", header: label("filters.mine"), type: "status", searchable: false, accessor: o => {
      if (!userId) return [];
      const created = o.created_by === userId, assignedToMe = assigned(o).includes(userId);
      return [created ? "created" : null, assignedToMe ? "assigned" : null, created || assignedToMe ? "either" : null].filter(Boolean);
    } },
  ];
}