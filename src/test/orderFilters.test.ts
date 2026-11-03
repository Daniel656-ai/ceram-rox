import { describe, expect, it } from "vitest";
import { orderFilterColumns } from "@/lib/orders/orderFilterColumns";
import { processRows } from "@/components/data-table/dataTableUtils";
import type { ColumnFilterValue } from "@/components/data-table/types";

const rows = [
  { id: "a", order_number: "FG-260012", created_by: "me", project_id: "p", projects: { project_number: "PR-12", project_name: "Reaktor" }, order_kind: "labor", order_type: "rnd", status: "open", sample_id: "s", current_sample: { id: "s", sample_number: "P260607", sample_name: "FG26_0632" }, order_measurements: [{ assigned_to: "other" }] },
  { id: "b", order_number: "FG-260013", created_by: "other", order_kind: "pilot_plant", pp_experiment_number: "TE00123", order_type: "production", status: "completed", order_measurements: [{ assigned_to: "me" }] },
  { id: "c", order_number: "FG-260014", created_by: "other", order_kind: "labor", order_type: "customer", status: "open", order_measurements: [{ assigned_to: "third" }] },
];
const columns = orderFilterColumns(rows, [{ user_id: "me", first_name: "Anna", last_name: "Test" }, { user_id: "other", first_name: "Bert", last_name: "Test" }], "me", k => k);
const filter = (filters: Record<string, ColumnFilterValue> = {}, q = "") => processRows(rows, columns, q, filters, null).map(o => o.id);
const selected = (...values: string[]): ColumnFilterValue => ({ kind: "status", values });

describe("Alle Aufträge requested search and filter rules", () => {
  it.each(["fg-260012", "p260607", "fg26_0632", "reaktor", "pr-12", "anna", "Anna Test"])("searches readable field %s case-insensitively", q => expect(filter({}, q)).toEqual(["a"]));
  it("searches the central Pilot Plant experiment identity", () => expect(filter({}, "te00123")).toEqual(["b"]));
  it("keeps every supplied readable order without filters", () => expect(filter()).toEqual(["a", "b", "c"]));
  it.each([
    ["requester", "me", ["a"]], ["creator", "me", ["a"]], ["project", "p", ["a"]],
    ["project_number", "PR-12", ["a"]], ["sample", "s", ["a"]], ["kind", "pilot_plant", ["b"]],
    ["type", "rnd", ["a"]], ["status", "completed", ["b"]], ["responsible", "me", ["b"]],
    ["mine", "created", ["a"]], ["mine", "assigned", ["b"]], ["mine", "either", ["a", "b"]],
  ])("filters %s by actual identities", (key, value, ids) => expect(filter({ [key as string]: selected(value as string) })).toEqual(ids));
  it("combines filters with AND and selected values with OR", () => expect(filter({ kind: selected("labor"), status: selected("open"), responsible: selected("other", "me") })).toEqual(["a"]));
  it("does not infer an assignment from creation or project membership", () => expect(filter({ responsible: selected("me"), creator: selected("me") })).toEqual([]));
  it("excludes nonhydrated/foreign sample identities", () => expect(filter({ sample: selected("unknown") })).toEqual([]));
});