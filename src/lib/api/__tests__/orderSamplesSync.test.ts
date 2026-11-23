import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock("../client", () => ({ dbClient: { rpc, from } }));
import { orderSamples } from "../orderSamples";

describe("Hauptprobe des Auftrags nachführen (Aufgabe 023)", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("ruft die geprüfte Datenbank-Funktion auf und schreibt nicht mehr direkt in measurement_orders", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await orderSamples.syncPrimary("order-1");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("order_sync_primary_sample", { _order_id: "order-1" });
    expect(from).not.toHaveBeenCalled();
  });

  it("gibt einen Fehler der Datenbank-Funktion weiter", async () => {
    const error = { message: "kein Zugriff", code: "42501" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(orderSamples.syncPrimary("order-1")).rejects.toEqual(error);
  });
});
