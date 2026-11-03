import type { DataTableColumn } from "@/components/data-table/types";
import { orderSamples, type OrderSampleSource } from "./orderSamples";
import { orderIdentity, type OrderIdentitySource } from "./orderIdentity";
import { resolveOrderKind } from "./orderKind";

type Profile = { user_id: string; first_name?: string | null; last_name?: string | null };
export type OrderFilterRow = OrderSampleSource & OrderIdentitySource & {
  created_by?: string | null; project_id?: string | null;
  projects?: { project_number?: string | null; project_name?: string | null } | null;
  customer_name?: string | null; reference_number?: string | null; notes?: string | null;
  order_type?: string | null; status?: string | null;
  order_measurements?: Array<{ assigned_to?: string | null } & NonNullable<OrderSampleSource["order_measurements"]>[number] & { measurement_services?: { category?: string | null } | null }>;
};

/** Display/filter identities only; never infer project roles or historical samples. */
export function orderFilterColumns(rows: OrderFilterRow[], profiles: Profile[], userId: string | undefined, t: (key: string) => string): DataTableColumn<OrderFilterRow>[] {
  const names = Object.fromEntries(profiles.map(p => [p.user_id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id]));
  const assigned = (o: OrderFilterRow): string[] => [...new Set<string>((o.order_measurements ?? []).flatMap(m => m?.assigned_to ? [m.assigned_to] : []))];
  const personLabels = { ...names };
  const projects: Record<string, string> = {};
  const samples: Record<string, string> = {};
  for (const o of rows) {
    if (o.created_by) personLabels[o.created_by] ??= o.created_by;
    for (const id of assigned(o)) personLabels[id] ??= id;
    if (o.project_id) projects[o.project_id] = o.projects?.project_name || o.projects?.project_number || o.project_id;
    for (const s of orderSamples(o)) samples[s.id] = [s.sample_number, s.sample_name].filter(Boolean).join(" · ");
  }
  const status = (key: string, accessor: (o: OrderFilterRow) => unknown, labels?: Record<string, string>, order?: string[]): DataTableColumn<OrderFilterRow> => ({
    key, header: t(`orders:filters.${key}`), type: "status", accessor, statusLabels: labels, statusOrder: order, searchable: false,
  });
  return [
    { key: "search", header: "", filterable: false, accessor: o => [
      orderIdentity(o).number, o.order_number, o.projects?.project_number, o.projects?.project_name,
      names[o.created_by], o.customer_name, o.reference_number, o.notes, t(`orders:kind.${resolveOrderKind(o)}`),
      ...orderSamples(o).flatMap(s => [s.sample_number, s.sample_name]),
    ].filter(Boolean).join("\n") },
    status("requester", o => o.created_by, personLabels),
    status("project", o => o.project_id, projects),
    status("project_number", o => o.projects?.project_number),
    status("sample", o => orderSamples(o).map(s => s.id), samples),
    status("kind", resolveOrderKind, { labor: t("orders:kind.labor"), pilot_plant: t("orders:kind.pilot_plant") }, ["labor", "pilot_plant"]),
    status("type", o => o.order_type, Object.fromEntries(["customer", "production", "rnd"].map(k => [k, t(`common:order_type_${k}`)]))),
    status("status", o => o.status, Object.fromEntries(["open", "in_progress", "completed"].map(k => [k, t(`common:status_${k}`)]))),
    status("responsible", assigned, personLabels),
    status("creator", o => o.created_by, personLabels),
    status("mine", o => userId ? [
      ...(o.created_by === userId ? ["created", "either"] : []),
      ...(assigned(o).includes(userId) ? ["assigned", "either"] : []),
    ] : [], Object.fromEntries(["created", "assigned", "either"].map(k => [k, t(`orders:filters.mine_${k}`)])), ["created", "assigned", "either"]),
  ];
}