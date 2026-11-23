import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMock } from "./dbClientMock";

vi.mock("../client", async () => ({ dbClient: (await import("./dbClientMock")).dbMock.client }));

const { measurements } = await import("../measurements");

const dbError = { message: "Aufgabe ist bereits vergeben", code: "P0001" };
const only = (table: string) => {
  const qs = dbMock.queriesFor(table);
  expect(qs).toHaveLength(1);
  return qs[0];
};

beforeEach(() => dbMock.reset());

describe("Messungs-API: offene Aufgaben für qualifizierte Benutzer", () => {
  it("liefert ohne Kompetenz eine leere Liste und fragt keine Messungen ab", async () => {
    dbMock.respond("mdl_service_permissions", { data: [], error: null });
    await expect(measurements.listUnassignedQualified("u-1")).resolves.toEqual([]);
    expect(dbMock.calls(only("mdl_service_permissions"), "eq")).toEqual([["user_id", "u-1"]]);
    expect(dbMock.queriesFor("order_measurements")).toHaveLength(0);
  });

  it("lädt nur nicht zugewiesene, nicht abgeschlossene Messungen der qualifizierten Dienstleistungen", async () => {
    const rows = [{ id: "m-1" }];
    dbMock.respond("mdl_service_permissions", { data: [{ service_id: "svc-a" }, { service_id: "svc-b" }], error: null });
    dbMock.respond("order_measurements", { data: rows, error: null });
    await expect(measurements.listUnassignedQualified("u-1")).resolves.toEqual(rows);
    const q = only("order_measurements");
    expect(dbMock.calls(q, "is")).toEqual([["assigned_to", null]]);
    expect(dbMock.calls(q, "neq")).toEqual(
      expect.arrayContaining([["status", "completed"], ["measurement_orders.order_type", "internal"]]),
    );
    expect(dbMock.calls(q, "in")).toEqual([["service_id", ["svc-a", "svc-b"]]]);
  });

  it("gibt einen Fehler beim Lesen der Kompetenzmatrix als Fehler weiter", async () => {
    dbMock.respond("mdl_service_permissions", { data: null, error: dbError });
    await expect(measurements.listUnassignedQualified("u-1")).rejects.toEqual(dbError);
  });
});

describe("Messungs-API: Vertretung und Projektrolle", () => {
  it("liefert ohne qualifizierte Kolleg:innen eine leere Liste ohne Profilabfrage", async () => {
    dbMock.respond("mdl_service_permissions", { data: [], error: null });
    await expect(measurements.listQualifiedUsers("svc-a")).resolves.toEqual([]);
    expect(dbMock.queriesFor("profiles")).toHaveLength(0);
  });

  it("lädt die Profile qualifizierter Kolleg:innen ohne doppelte Benutzer", async () => {
    dbMock.respond("mdl_service_permissions", { data: [{ user_id: "u-1" }, { user_id: "u-2" }, { user_id: "u-1" }], error: null });
    await measurements.listQualifiedUsers("svc-a");
    expect(dbMock.calls(only("mdl_service_permissions"), "eq")).toEqual([["service_id", "svc-a"]]);
    expect(dbMock.calls(only("profiles"), "in")).toEqual([["user_id", ["u-1", "u-2"]]]);
  });

  it("liefert bei mehreren Projektrollen die höchstwertige (owner vor leader vor member)", async () => {
    dbMock.respond("project_members", { data: [{ role: "member" }, { role: "owner" }, { role: "leader" }], error: null });
    await expect(measurements.myProjectRole("p-1", "u-1")).resolves.toBe("owner");
    expect(dbMock.calls(only("project_members"), "eq")).toEqual([["project_id", "p-1"], ["user_id", "u-1"]]);
  });

  it("liefert ohne bekannte Projektrolle null", async () => {
    dbMock.respond("project_members", { data: [{ role: "gast" }], error: null });
    await expect(measurements.myProjectRole("p-1", "u-1")).resolves.toBeNull();
  });
});

describe("Messungs-API: serverseitig geprüfte Aktionen (RPC)", () => {
  it("übernimmt eine Aufgabe über claim_measurement", async () => {
    dbMock.respondRpc("claim_measurement", { data: { id: "m-1" }, error: null });
    await expect(measurements.claim("m-1")).resolves.toEqual({ id: "m-1" });
    expect(dbMock.rpcCalls).toEqual([["claim_measurement", { _measurement_id: "m-1" }]]);
  });

  it("meldet eine abgelehnte Übernahme als Fehler", async () => {
    dbMock.respondRpc("claim_measurement", { data: null, error: dbError });
    await expect(measurements.claim("m-1")).rejects.toEqual(dbError);
  });

  it("übergibt bei der Vertretung neuen Benutzer und Begründung, null entfernt die Zuweisung", async () => {
    await measurements.reassign("m-1", "u-2", "Urlaub");
    await measurements.reassign("m-1", null, "Freigabe");
    expect(dbMock.rpcCalls).toEqual([
      ["reassign_measurement", { _measurement_id: "m-1", _new_user_id: "u-2", _reason: "Urlaub" }],
      ["reassign_measurement", { _measurement_id: "m-1", _new_user_id: null, _reason: "Freigabe" }],
    ]);
  });

  it("gibt eine eigene Aufgabe über release_measurement frei und liefert das Ergebnis der DB", async () => {
    dbMock.respondRpc("release_measurement", { data: false, error: null });
    await expect(measurements.release("m-1")).resolves.toBe(false);
    expect(dbMock.rpcCalls).toEqual([["release_measurement", { _measurement_id: "m-1" }]]);
  });

  it("löscht eine einzelne Dienstleistung nur über die geprüfte DB-Funktion mit Begründung", async () => {
    await measurements.deleteWithReason("m-1", "Doppelt angelegt");
    expect(dbMock.rpcCalls).toEqual([["delete_order_measurement", { _measurement_id: "m-1", _reason: "Doppelt angelegt" }]]);
    expect(dbMock.executed()).toHaveLength(0);
  });

  it("meldet eine abgelehnte Löschung als Fehler", async () => {
    dbMock.respondRpc("delete_order_measurement", { data: null, error: dbError });
    await expect(measurements.deleteWithReason("m-1", "x")).rejects.toEqual(dbError);
  });
});

describe("Messungs-API: Abfragen mit leerer ID-Liste", () => {
  it("fragt bei leeren ID-Listen keine Tabelle ab und liefert leere Listen", async () => {
    await expect(measurements.listRunStateByIds([])).resolves.toEqual([]);
    await expect(measurements.listByIds([])).resolves.toEqual([]);
    await expect(measurements.fetchProfiles([])).resolves.toEqual([]);
    expect(dbMock.executed()).toHaveLength(0);
  });

  it("filtert den Laufstatus nach den übergebenen Messungs-IDs", async () => {
    await measurements.listRunStateByIds(["m-1", "m-2"]);
    expect(dbMock.calls(only("order_measurements"), "in")).toEqual([["id", ["m-1", "m-2"]]]);
  });
});

describe("Messungs-API: Messung abschließen und ändern", () => {
  it("schließt mit tatsächlicher Dauer und bereinigter Abweichungsbegründung ab", async () => {
    await measurements.complete("m-1", 2.5, "  Gerät ausgefallen ");
    const q = only("order_measurements");
    expect(dbMock.calls(q, "update")).toEqual([[{ actual_duration_hours: 2.5, status: "completed", duration_deviation_reason: "Gerät ausgefallen" }]]);
    expect(dbMock.calls(q, "eq")).toEqual([["id", "m-1"]]);
  });

  it("speichert keine leere Abweichungsbegründung", async () => {
    await measurements.complete("m-1", 1, "   ");
    expect(dbMock.calls(only("order_measurements"), "update")).toEqual([[{ actual_duration_hours: 1, status: "completed" }]]);
  });

  it("meldet einen abgelehnten Abschluss als Fehler", async () => {
    dbMock.respond("order_measurements", { data: null, error: dbError });
    await expect(measurements.complete("m-1", 1)).rejects.toEqual(dbError);
  });

  it("ändert den Status nur der übergebenen Messung und meldet DB-Fehler", async () => {
    await measurements.updateStatus("m-1", "in_progress");
    const q = only("order_measurements");
    expect(dbMock.calls(q, "update")).toEqual([[{ status: "in_progress" }]]);
    expect(dbMock.calls(q, "eq")).toEqual([["id", "m-1"]]);
    dbMock.respond("order_measurements", { data: null, error: dbError });
    await expect(measurements.updateStatus("m-1", "completed")).rejects.toEqual(dbError);
  });

  it("lädt die Dienstleistungsstatistik nur für den Anlagezeitraum und ohne interne Aufträge", async () => {
    await measurements.listForServiceStats("2026-01-01T00:00:00Z", "2026-01-31T23:59:59Z");
    const q = only("order_measurements");
    expect(dbMock.calls(q, "gte")).toEqual([["created_at", "2026-01-01T00:00:00Z"]]);
    expect(dbMock.calls(q, "lte")).toEqual([["created_at", "2026-01-31T23:59:59Z"]]);
    expect(dbMock.calls(q, "neq")).toEqual([["measurement_orders.order_type", "internal"]]);
  });
});
