import { describe, it, expect } from "vitest";
import { orderFilterColumns } from "@/lib/orders/orderFilterColumns";
import { processRows } from "@/components/data-table/dataTableUtils";
const rows = [
  { id: "one", created_by: "me", project_id: "p", projects: { project_number: "2026-015", project_name: "Ceramic" }, order_kind: "pilot_plant", order_type: "rnd", order_number: "OLD1", status: "open", shared_form_data: { pp: { stammdaten: { versuchsnummer: "TE009" } } }, sample_id: "s", current_sample: { id: "s", sample_number: "P260001", sample_name: "Testkörper" }, order_measurements: [{ assigned_to: "other" }] },
  { id: "two", created_by: "other", status: "completed", order_kind: "labor", order_type: "customer", order_measurements: [{ assigned_to: "me" }] },
  { id: "three", created_by: "other", status: "open", order_kind: "labor", order_type: "customer", order_measurements: [] },
];
const columns = orderFilterColumns("me", id => id === "me" ? "Max Muster" : "Eva Labor", k => k);
const filter = (key: string, values: string[]) => ({ [key]: { kind: "status" as const, values } });
describe("optional all-orders filters", () => {
  it("defaults and reset filter state include all supplied readable orders", () => expect(processRows(rows, columns, "", {}, null)).toEqual(rows));
  it.each(["testkÖr", "p260001", "2026-015", "te009", "old1", "max mus"])("partial case-insensitive search %s", q => expect(processRows(rows, columns, q, {}, null).map(o => o.id)).toEqual(["one"]));
  it("requester uses creator identity, not assigned measurement", () => expect(processRows(rows, columns, "", filter("requester", ["me"]), null).map(o => o.id)).toEqual(["one"]));
  it("project uses actual project UUID", () => expect(processRows(rows, columns, "", filter("project", ["p"]), null).map(o => o.id)).toEqual(["one"]));
  it("sample uses hydrated sample UUID", () => expect(processRows(rows, columns, "", filter("sample", ["s"]), null).map(o => o.id)).toEqual(["one"]));
  it("responsibility uses measurement assignment, not creator", () => expect(processRows(rows, columns, "", filter("responsible", ["me"]), null).map(o => o.id)).toEqual(["two"]));
  it.each([["created", ["one"]], ["assigned", ["two"]], ["either", ["one", "two"]]] as const)("personal opt-in %s", (mode, ids) => expect(processRows(rows, columns, "", filter("mine", [mode]), null).map(o => o.id)).toEqual(ids));
  it("combines search, project, status and personal filters with AND", () => expect(processRows(rows, columns, "TE009", { ...filter("project", ["p"]), ...filter("status", ["open"]), ...filter("mine", ["created"]) }, null).map(o => o.id)).toEqual(["one"]));
  it("does not invent readable orders for unmatched filters", () => expect(processRows(rows, columns, "", filter("sample", ["hidden"]), null)).toEqual([]));
});