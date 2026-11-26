import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMock } from "./dbClientMock";

vi.mock("../client", async () => ({ dbClient: (await import("./dbClientMock")).dbMock.client }));

const { orders } = await import("../orders");

beforeEach(() => dbMock.reset());

describe("Auftrags-API: Dashboard-Zählung nach Status", () => {
  it("liefert je Status die Anzahl aus drei Kopfabfragen ohne Datenzeilen", async () => {
    dbMock.respond(
      "measurement_orders",
      { data: null, count: 40, error: null } as any,
      { data: null, count: 74, error: null } as any,
      { data: null, count: 2, error: null } as any,
    );
    await expect(orders.countByStatus()).resolves.toEqual({ open: 40, in_progress: 74, completed: 2 });
    const qs = dbMock.queriesFor("measurement_orders");
    expect(qs).toHaveLength(3);
    expect(qs.map((q) => dbMock.calls(q, "eq")[0])).toEqual([
      ["status", "open"],
      ["status", "in_progress"],
      ["status", "completed"],
    ]);
    for (const q of qs) {
      expect(dbMock.calls(q, "select")[0]).toEqual(["id", { count: "exact", head: true }]);
      expect(dbMock.calls(q, "neq")).toEqual([["order_type", "internal"]]);
    }
  });

  it("zählt fehlende Anzahl als 0", async () => {
    dbMock.respond("measurement_orders", { data: null, count: null, error: null } as any);
    await expect(orders.countByStatus()).resolves.toEqual({ open: 0, in_progress: 0, completed: 0 });
  });

  it("wirft den Fehler weiter, statt 0 zu liefern", async () => {
    const error = { message: "Zeitüberschreitung", code: "57014" };
    dbMock.respond("measurement_orders", { data: null, count: null, error } as any);
    await expect(orders.countByStatus()).rejects.toEqual(error);
  });
});

describe("Auftrags-API: zuletzt angelegte Aufträge", () => {
  it("fragt schlank ab: nicht intern, neueste zuerst, begrenzt", async () => {
    dbMock.respond("measurement_orders", { data: [{ id: "o1" }], error: null });
    await expect(orders.listRecent(5)).resolves.toEqual([{ id: "o1" }]);
    const [q] = dbMock.queriesFor("measurement_orders");
    expect(dbMock.calls(q, "neq")).toEqual([["order_type", "internal"]]);
    expect(dbMock.calls(q, "order")).toEqual([["created_at", { ascending: false }]]);
    expect(dbMock.calls(q, "limit")).toEqual([[5]]);
    expect(String(dbMock.calls(q, "select")[0][0])).not.toContain("order_measurements");
  });
});
