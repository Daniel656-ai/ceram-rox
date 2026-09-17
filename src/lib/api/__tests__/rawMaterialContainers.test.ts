import { describe, expect, it, vi } from "vitest";

/**
 * Simuliert den Firmen-Datenbestand (Desktop), in dem die Spalte
 * `archived_at` noch nicht existiert: Die gefilterte Abfrage schlägt mit
 * PostgREST-Fehler 42703 fehl, die ungefilterte Rückfall-Abfrage liefert Daten.
 */

const MISSING_COL_ERROR = {
  code: "42703",
  message: "column raw_material_containers.archived_at does not exist",
  details: null,
  hint: null,
};

const ROWS = [{ id: "c1", container_code: "GEB-1" }];

function makeQuery() {
  let failOnAwait = false;
  const query: any = {
    select: () => query,
    order: () => query,
    eq: () => query,
    is: (col: string) => {
      if (col === "archived_at") failOnAwait = true;
      return query;
    },
    then: (resolve: any, reject: any) =>
      Promise.resolve(
        failOnAwait ? { data: null, error: MISSING_COL_ERROR } : { data: ROWS, error: null }
      ).then(resolve, reject),
  };
  return query;
}

vi.mock("../client", () => ({ dbClient: { from: () => makeQuery() } }));

const { rawMaterialContainers } = await import("../rawMaterialContainers");

describe("rawMaterialContainers.list – Bestand ohne archived_at-Spalte", () => {
  it("fällt auf die ungefilterte Abfrage zurück und zeigt alle Gebinde", async () => {
    const rows = await rawMaterialContainers.list("mat-1");
    expect(rows).toEqual(ROWS);
  });
});
