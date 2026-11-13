import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../client", () => ({ dbClient: { rpc } }));
import { orders } from "../orders";

describe("whole order deletion API", () => {
  beforeEach(() => rpc.mockReset());
  it("uses the server checked RPC and requires the deleted order ID", async () => {
    rpc.mockResolvedValue({ data: "order-1", error: null });
    await orders.delete("order-1");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("cancel_or_delete_order", { _order_id: "order-1" });
  });
  it("surfaces protected-data refusal without retry or fallback DELETE", async () => {
    const error = { message: "Auftrag enthält Messergebnisse", code: "P0001" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(orders.delete("order-1")).rejects.toEqual(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("does not report a zero-row or unexpected return as successful deletion", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(orders.delete("order-1")).rejects.toThrow("nicht vollständig");
  });
});