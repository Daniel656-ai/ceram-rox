import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMock } from "./dbClientMock";

vi.mock("../client", async () => ({ dbClient: (await import("./dbClientMock")).dbMock.client }));

const { measurementResults } = await import("../measurementResults");

const dbError = { message: "permission denied for table measurement_results", code: "42501" };
const only = (table: string) => {
  const qs = dbMock.queriesFor(table);
  expect(qs).toHaveLength(1);
  return qs[0];
};

beforeEach(() => dbMock.reset());

describe("Ergebnis-API: Ergebnisdatenbank lesen", () => {
  it("lädt die offizielle Ergebnisdatenbank ohne interne Aufträge, neueste Messungen zuerst", async () => {
    const rows = [{ id: "m1" }];
    dbMock.respond("order_measurements", { data: rows, error: null });
    await expect(measurementResults.listOfficialDatabase()).resolves.toEqual(rows);
    const q = only("order_measurements");
    expect(dbMock.calls(q, "neq")).toEqual([["measurement_orders.order_type", "internal"]]);
    expect(dbMock.calls(q, "order")).toEqual([["updated_at", { ascending: false }]]);
    expect(String(dbMock.calls(q, "select")[0][0])).toContain("is_official");
  });

  it("lädt die Probensicht eines Auftrags nur für diesen Auftrag und ohne interne Aufträge", async () => {
    await measurementResults.listSampleDatabaseForOrder("order-7");
    const q = only("order_measurements");
    expect(dbMock.calls(q, "eq")).toEqual([["measurement_orders.id", "order-7"]]);
    expect(dbMock.calls(q, "neq")).toEqual([["measurement_orders.order_type", "internal"]]);
  });

  it("gibt einen Datenbankfehler beim Laden als Fehler weiter", async () => {
    dbMock.respond("order_measurements", { data: null, error: dbError });
    await expect(measurementResults.listSampleDatabase()).rejects.toEqual(dbError);
  });
});

describe("Ergebnis-API: Anzeigepräzision", () => {
  it("fragt ohne Formular- und Dienstleistungs-IDs keine Tabelle ab", async () => {
    await expect(measurementResults.listDisplayPrecisionDefinitions([], [])).resolves.toEqual({
      fields: [], calculations: [], serviceFields: [],
    });
    expect(dbMock.executed()).toHaveLength(0);
  });

  it("lädt Felder, Berechnungen und Dienstleistungsfelder gefiltert nach den übergebenen IDs", async () => {
    dbMock.respond("form_fields", { data: [{ field_key: "a" }], error: null });
    dbMock.respond("form_calculations", { data: [{ calc_key: "c" }], error: null });
    dbMock.respond("service_data_fields", { data: [{ field_key: "s" }], error: null });
    const defs = await measurementResults.listDisplayPrecisionDefinitions(["svc-1"], ["form-1", "form-2"]);
    expect(defs).toEqual({ fields: [{ field_key: "a" }], calculations: [{ calc_key: "c" }], serviceFields: [{ field_key: "s" }] });
    expect(dbMock.calls(only("form_fields"), "in")).toEqual([["form_id", ["form-1", "form-2"]]]);
    expect(dbMock.calls(only("form_calculations"), "in")).toEqual([["form_id", ["form-1", "form-2"]]]);
    expect(dbMock.calls(only("service_data_fields"), "in")).toEqual([["service_id", ["svc-1"]]]);
  });

  it("behält bei fehlendem Zugriff auf eine Tabelle die übrigen Definitionen (Rückfall auf leere Liste)", async () => {
    dbMock.respond("form_fields", { data: null, error: dbError });
    dbMock.respond("form_calculations", { data: [{ calc_key: "c" }], error: null });
    const defs = await measurementResults.listDisplayPrecisionDefinitions([], ["form-1"]);
    expect(defs).toEqual({ fields: [], calculations: [{ calc_key: "c" }], serviceFields: [] });
  });
});

describe("Ergebnis-API: Ergebnisse einer Messung schreiben", () => {
  it("listet die Ergebnisse genau einer Messung in Anlagereihenfolge", async () => {
    await measurementResults.list("m-1");
    const q = only("measurement_results");
    expect(dbMock.calls(q, "eq")).toEqual([["order_measurement_id", "m-1"]]);
    expect(dbMock.calls(q, "order")).toEqual([["created_at"]]);
  });

  it("legt ein Ergebnis mit offizieller Kennzeichnung und Messungsbezug an und liefert den gespeicherten Datensatz", async () => {
    const saved = { id: "r-1" };
    dbMock.respond("measurement_results", { data: saved, error: null });
    const payload = {
      order_measurement_id: "m-1", result_name: "form:f:messungen[m1].sio2", value: 56.2,
      is_official: true, display_label: "SiO2", instance_key: "m1",
    };
    await expect(measurementResults.create(payload)).resolves.toEqual(saved);
    const q = only("measurement_results");
    expect(dbMock.calls(q, "insert")).toEqual([[payload]]);
    expect(dbMock.calls(q, "single")).toHaveLength(1);
  });

  it("meldet einen abgelehnten Anlegeversuch als Fehler", async () => {
    dbMock.respond("measurement_results", { data: null, error: dbError });
    await expect(measurementResults.create({ order_measurement_id: "m-1", result_name: "x" })).rejects.toEqual(dbError);
  });

  it("ändert nur den Datensatz mit der übergebenen ID", async () => {
    await measurementResults.update("r-9", { is_official: false });
    const q = only("measurement_results");
    expect(dbMock.calls(q, "update")).toEqual([[{ is_official: false }]]);
    expect(dbMock.calls(q, "eq")).toEqual([["id", "r-9"]]);
  });

  it("meldet einen Fehler beim Ändern und beim Löschen", async () => {
    dbMock.respond("measurement_results", { data: null, error: dbError });
    await expect(measurementResults.update("r-9", { value: 1 })).rejects.toEqual(dbError);
    await expect(measurementResults.delete("r-9")).rejects.toEqual(dbError);
  });

  it("löscht nur den Datensatz mit der übergebenen ID", async () => {
    await measurementResults.delete("r-9");
    const q = only("measurement_results");
    expect(dbMock.calls(q, "delete")).toHaveLength(1);
    expect(dbMock.calls(q, "eq")).toEqual([["id", "r-9"]]);
  });
});

describe("Ergebnis-API: Werte verknüpfter Formulare eines Auftrags", () => {
  it("liest nur den Auftrag ohne interne Aufträge und übernimmt nur Werte der eigenen Probe", async () => {
    dbMock.respond("order_measurements", {
      data: [
        { id: "m1", sample_id: "s-1", updated_at: null, measurement_results: [{ result_name: "form:f1:dichte", value: 2.4, remarks: null, measured_at: null, is_official: true }] },
        { id: "m2", sample_id: "s-2", updated_at: null, measurement_results: [{ result_name: "form:f1:dichte", value: 9.9, remarks: null, measured_at: null, is_official: true }] },
      ],
      error: null,
    });
    const values = await measurementResults.listFormValuesForOrder("order-1", "s-1");
    expect(values).toEqual({ f1: { dichte: 2.4 } });
    const q = only("order_measurements");
    expect(dbMock.calls(q, "eq")).toEqual([["order_id", "order-1"]]);
    expect(dbMock.calls(q, "neq")).toEqual([["measurement_orders.order_type", "internal"]]);
  });

  it("lässt die aktuelle Messung selbst weg", async () => {
    dbMock.respond("order_measurements", {
      data: [{ id: "m1", sample_id: "s-1", updated_at: null, measurement_results: [{ result_name: "form:f1:dichte", value: 2.4, remarks: null, measured_at: null, is_official: true }] }],
      error: null,
    });
    await expect(measurementResults.listFormValuesForOrder("order-1", "s-1", "m1")).resolves.toEqual({});
  });

  it("gibt einen Datenbankfehler als Fehler weiter", async () => {
    dbMock.respond("order_measurements", { data: null, error: dbError });
    await expect(measurementResults.listFormValuesForOrder("order-1")).rejects.toEqual(dbError);
  });
});
