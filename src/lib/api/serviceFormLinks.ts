import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/** Rolle, für die ein verknüpftes Formular gilt. */
export type ServiceFormLinkRole = "customer" | "employee";

export interface ServiceFormLink {
  id: string;
  service_id: string;
  form_definition_id: string;
  /** null = keiner Rolle zugeordnet -> wird nirgends automatisch angezeigt */
  role_view: ServiceFormLinkRole | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const TBL = "service_form_links" as const;

export const serviceFormLinks = {
  /**
   * Verknüpfte Formulare einer Dienstleistung. Mit `roleView` werden
   * ausschließlich Formulare geliefert, die explizit dieser Rolle zugeordnet
   * sind – kein Fallback auf andere Rollen oder rollenlose Altverknüpfungen.
   */
  listForService: (serviceId: string, roleView?: ServiceFormLinkRole) => {
    let q = dbClient.from(TBL as any).select("*").eq("service_id", serviceId);
    if (roleView === "customer") {
      // Auftraggeber: strikt nur explizit zugeordnete Formulare.
      q = q.eq("role_view", "customer");
    } else if (roleView === "employee") {
      // Messdienstleister: explizit zugeordnete + Altverknüpfungen ohne Rolle.
      q = q.or("role_view.eq.employee,role_view.is.null");
    }
    return unwrap(q.order("order_index")) as unknown as Promise<ServiceFormLink[]>;
  },

  listForForm: (formId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("form_definition_id", formId)
    ) as unknown as Promise<ServiceFormLink[]>,

  add: (serviceId: string, formId: string, orderIndex: number, roleView: ServiceFormLinkRole | null = null) =>
    run(
      dbClient
        .from(TBL as any)
        .insert({ service_id: serviceId, form_definition_id: formId, order_index: orderIndex, role_view: roleView } as any)
    ),

  remove: (id: string) => run(dbClient.from(TBL as any).delete().eq("id", id)),

  reorder: async (rows: Array<{ id: string; order_index: number }>) => {
    for (const r of rows) {
      await run(dbClient.from(TBL as any).update({ order_index: r.order_index } as any).eq("id", r.id));
    }
  },

  setForService: async (
    serviceId: string,
    entries: Array<{ form_definition_id: string; role_view: ServiceFormLinkRole | null }>
  ) => {
    await run(dbClient.from(TBL as any).delete().eq("service_id", serviceId));
    if (entries.length === 0) return;
    await run(
      dbClient.from(TBL as any).insert(
        entries.map((e, i) => ({
          service_id: serviceId,
          form_definition_id: e.form_definition_id,
          role_view: e.role_view,
          order_index: i,
        })) as any
      )
    );
  },
};
