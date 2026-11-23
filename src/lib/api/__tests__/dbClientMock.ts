/**
 * Aufzeichnender Ersatz für `dbClient` in API-Tests (kein Netzwerk, keine DB).
 *
 * Jede `from(tabelle)`-Abfrage zeichnet ihre Kette (select, eq, neq, …) auf
 * und liefert beim `await` die nächste vorbereitete Antwort für diese Tabelle
 * (Standard: `{ data: [], error: null }`). `rpc(name, params)` liefert die
 * vorbereitete Antwort für den RPC-Namen.
 *
 * Verwendung:
 *   import { dbMock } from "./dbClientMock";
 *   vi.mock("../client", async () => ({ dbClient: (await import("./dbClientMock")).dbMock.client }));
 *   beforeEach(() => dbMock.reset());
 */

export type DbResponse = { data: unknown; error: unknown };

export interface RecordedQuery {
  table: string;
  calls: Array<[string, unknown[]]>;
  /** true, sobald die Abfrage tatsächlich ausgeführt (awaited) wurde. */
  executed: boolean;
}

export function createDbClientMock() {
  const queries: RecordedQuery[] = [];
  const rpcCalls: Array<[string, unknown]> = [];
  const tableResponses = new Map<string, DbResponse[]>();
  const rpcResponses = new Map<string, DbResponse>();

  const nextTableResponse = (table: string): DbResponse => {
    const list = tableResponses.get(table);
    if (list && list.length > 1) return list.shift()!;
    if (list && list.length === 1) return list[0];
    return { data: [], error: null };
  };

  const from = (table: string) => {
    const query: RecordedQuery = { table, calls: [], executed: false };
    queries.push(query);
    let response: DbResponse | null = null;
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            query.executed = true;
            response ??= nextTableResponse(table);
            const r = response;
            return (resolve: (v: DbResponse) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(r).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.calls.push([prop, args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const rpc = (name: string, params?: unknown) => {
    rpcCalls.push([name, params]);
    return Promise.resolve(rpcResponses.get(name) ?? { data: null, error: null });
  };

  return {
    client: { from, rpc },
    queries,
    rpcCalls,
    /** Antworten für eine Tabelle in Aufrufreihenfolge; die letzte gilt für alle weiteren. */
    respond(table: string, ...responses: DbResponse[]) {
      tableResponses.set(table, responses);
    },
    respondRpc(name: string, response: DbResponse) {
      rpcResponses.set(name, response);
    },
    /** Ausgeführte Abfragen einer Tabelle (nur aufgebaute, nie ausgeführte zählen nicht). */
    queriesFor(table: string) {
      return queries.filter((q) => q.table === table && q.executed);
    },
    /** Alle ausgeführten Abfragen. */
    executed() {
      return queries.filter((q) => q.executed);
    },
    /** Aufgerufene Filter einer Abfrage, z. B. ["eq", ["id", "m1"]]. */
    calls(query: RecordedQuery, method: string) {
      return query.calls.filter(([m]) => m === method).map(([, args]) => args);
    },
    reset() {
      queries.length = 0;
      rpcCalls.length = 0;
      tableResponses.clear();
      rpcResponses.clear();
    },
  };
}

export type DbClientMock = ReturnType<typeof createDbClientMock>;

/** Gemeinsame Instanz je Testdatei (Vitest isoliert Module pro Datei). */
export const dbMock = createDbClientMock();
