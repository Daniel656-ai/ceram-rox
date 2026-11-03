import { cleanup, act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDataTable } from "@/components/data-table/useDataTable";
import { orderFilterColumns } from "@/lib/orders/orderFilterColumns";

const rows = [{ id: "a", order_number: "A", created_by: "one", status: "open" }, { id: "b", order_number: "B", created_by: "two", status: "completed" }];
const columns = orderFilterColumns(rows, [], "one", k => k);
afterEach(() => { cleanup(); localStorage.clear(); });
const mount = (id: string) => renderHook(() => useDataTable({ tableId: `orders.${id}`, rows, columns, paginated: false }));
describe("existing user-scoped order filter storage", () => {
  it("starts unrestricted and restores only explicitly selected filters after remount", () => {
    const first = mount("one");
    expect(first.result.current.total).toBe(2);
    act(() => first.result.current.setFilter("status", { kind: "status", values: ["open"] }));
    expect(first.result.current.rows.map(o => o.id)).toEqual(["a"]);
    first.unmount();
    const restored = mount("one");
    expect(restored.result.current.rows.map(o => o.id)).toEqual(["a"]);
    act(() => restored.result.current.reset());
    expect(restored.result.current.rows.map(o => o.id)).toEqual(["a", "b"]);
    restored.unmount();
    expect(mount("one").result.current.total).toBe(2);
  });
  it("does not transfer filter settings to another account", () => {
    const first = mount("one");
    act(() => first.result.current.setSearch("A"));
    first.unmount();
    const second = mount("two");
    expect(second.result.current.search).toBe("");
    expect(second.result.current.total).toBe(2);
    second.unmount();
    expect(mount("one").result.current.search).toBe("A");
  });
});