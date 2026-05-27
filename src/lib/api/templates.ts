import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const templates = {
  list: () =>
    unwrap(
      dbClient
        .from("measurement_templates")
        .select(
          "*, measurement_template_items(id, service_id, sort_order, measurement_services(id, service_name, category, standard_duration_hours, hourly_rate))"
        )
        .order("name")
    ),

  async create(template: {
    name: string;
    category?: string;
    description?: string;
    created_by: string;
    items: { service_id: string; sort_order: number }[];
  }) {
    const { items, ...rest } = template;
    const data = await unwrap(
      dbClient.from("measurement_templates").insert(rest as any).select().single()
    );
    if (items.length > 0) {
      await run(
        dbClient
          .from("measurement_template_items")
          .insert(items.map((i) => ({ ...i, template_id: data.id })) as any)
      );
    }
    return data;
  },

  async update(args: {
    id: string;
    name: string;
    category?: string;
    description?: string;
    items: { service_id: string; sort_order: number }[];
  }) {
    const { id, items, ...rest } = args;
    await run(
      dbClient.from("measurement_templates").update(rest as any).eq("id", id)
    );
    await run(
      dbClient
        .from("measurement_template_items")
        .delete()
        .eq("template_id", id)
    );
    if (items.length > 0) {
      await run(
        dbClient
          .from("measurement_template_items")
          .insert(items.map((i) => ({ ...i, template_id: id })) as any)
      );
    }
  },

  delete: (id: string) =>
    run(dbClient.from("measurement_templates").delete().eq("id", id)),

  /** Apply a template to a list of samples: creates one order per sample + measurements. */
  async apply(args: {
    templateId: string;
    projectId: string;
    sampleIds: string[];
    createdBy: string;
    orderType: string;
    priority?: string;
    dueDate?: string;
  }) {
    const items = await unwrap(
      dbClient
        .from("measurement_template_items")
        .select("service_id, sort_order")
        .eq("template_id", args.templateId)
        .order("sort_order")
    );
    if (!items || items.length === 0) throw new Error("Template has no items");

    const createdOrders: string[] = [];

    for (const sampleId of args.sampleIds) {
      const order = await unwrap(
        dbClient
          .from("measurement_orders")
          .insert({
            project_id: args.projectId,
            sample_id: sampleId,
            order_type: args.orderType,
            created_by: args.createdBy,
            priority: args.priority || "normal",
            due_date: args.dueDate || null,
            notes: `Template-basiert erstellt`,
          } as any)
          .select()
          .single()
      );
      createdOrders.push(order.id);

      for (const item of items) {
        await run(
          dbClient
            .from("order_measurements")
            .insert({
              order_id: order.id,
              service_id: item.service_id,
              measurement_number: "WILL_BE_OVERWRITTEN",
            } as any)
        );
      }
    }
    return createdOrders;
  },
};
