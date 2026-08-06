import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type OrderKind = "labor" | "pilot_plant";

export interface OrderKindFormTemplate {
  order_kind: OrderKind;
  form_definition_id: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mapping between an order kind (Auftragsart) and the form template that
 * should be rendered dynamically in the order creation UI. Managed via the
 * Prozess-Designer → Auftragsart-Zuordnung tab. No hardcoded field lists.
 */
export const orderKindFormTemplates = {
  list: () =>
    unwrap(
      dbClient.from("order_kind_form_templates" as any).select("*").order("order_kind")
    ) as unknown as Promise<OrderKindFormTemplate[]>,

  get: async (orderKind: OrderKind): Promise<OrderKindFormTemplate | null> => {
    const rows = (await unwrap(
      dbClient
        .from("order_kind_form_templates" as any)
        .select("*")
        .eq("order_kind", orderKind)
        .limit(1)
    )) as unknown as OrderKindFormTemplate[];
    return rows?.[0] ?? null;
  },

  upsert: (orderKind: OrderKind, form_definition_id: string) =>
    run(
      dbClient.from("order_kind_form_templates" as any).upsert(
        {
          order_kind: orderKind,
          form_definition_id,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "order_kind" }
      )
    ),

  remove: (orderKind: OrderKind) =>
    run(dbClient.from("order_kind_form_templates" as any).delete().eq("order_kind", orderKind)),
};
