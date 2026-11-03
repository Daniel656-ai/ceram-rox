import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { useDataTable } from "@/components/data-table/useDataTable";
const options = (user: string) => ({ tableId: `orders.${user}`, rows: [], columns: [], paginated: false });
afterEach(() => { cleanup(); localStorage.clear(); });
describe("existing table persistence with personal order namespace", () => {
  it("restores explicit filters after navigation/sign-out remount and resets fully", () => {
    const first = renderHook(() => useDataTable(options("alice")));
    act(() => { first.result.current.setSearch("P260001"); first.result.current.setFilter("mine", { kind: "status", values: ["assigned"] }); });
    first.unmount();
    const second = renderHook(() => useDataTable(options("alice")));
    expect(second.result.current.search).toBe("P260001");
    expect(second.result.current.filters.mine).toEqual({ kind: "status", values: ["assigned"] });
    act(() => second.result.current.reset());
    expect(second.result.current.filters).toEqual({});
    expect(second.result.current.search).toBe("");
  });
  it("another user neither inherits nor overwrites personal filters", () => {
    const alice = renderHook(() => useDataTable(options("alice")));
    act(() => alice.result.current.setSearch("ALICE")); alice.unmount();
    const bob = renderHook(() => useDataTable(options("bob")));
    expect(bob.result.current.search).toBe("");
    act(() => bob.result.current.setSearch("BOB")); bob.unmount();
    const again = renderHook(() => useDataTable(options("alice")));
    expect(again.result.current.search).toBe("ALICE");
  });
});