import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const consumables = {
  list: () =>
    unwrap(dbClient.from("consumables").select("*").order("name")),

  create: (c: {
    name: string;
    description?: string;
    price_per_unit: number;
    unit: string;
  }) => unwrap(dbClient.from("consumables").insert(c).select().single()),

  update: (
    id: string,
    updates: { name?: string; description?: string; price_per_unit?: number; unit?: string }
  ) => run(dbClient.from("consumables").update(updates).eq("id", id)),

  delete: (id: string) => run(dbClient.from("consumables").delete().eq("id", id)),
};
