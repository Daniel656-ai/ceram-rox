import { describe, it, expect, vi, beforeEach } from "vitest";

// In-Memory-Datenbestand für order_measurements/measurement_results.
let db: { measurements: any[] } = { measurements: [] };
const writes: any[] = [];
const allResults = () => db.measurements.flatMap((m) => m.measurement_results);

vi.mock("@/lib/api/client", () => {
  const from = (table: string) => {
    const b: any = {};
    let op: string | null = null;
    let payload: any = null;
    b.select = () => {
      if (op === "insert") return { single: () => Promise.resolve({ data: { id: payload.__id }, error: null }) };
      return b;
    };
    b.update = (p: any) => { op = "update"; payload = p; return b; };
    b.insert = (p: any) => {
      op = "insert";
      const id = `new-${writes.length}`;
      payload = { ...p, __id: id };
      writes.push({ table, op, p });
      const m = db.measurements.find((x) => x.id === p.order_measurement_id);
      m.measurement_results.push({ id, result_name: p.result_name, value: null, remarks: p.remarks });
      return b;
    };
    b.eq = (_col: string, val: string) => {
      if (table === "order_measurements") return Promise.resolve({ data: JSON.parse(JSON.stringify(db.measurements)), error: null });
      if (op === "update") {
        writes.push({ table, op, id: val, p: payload });
        Object.assign(allResults().find((r) => r.id === val), payload);
      }
      return Promise.resolve({ data: null, error: null });
    };
    return b;
  };
  return { dbClient: { from } };
});

import { mundstueck293 } from "@/lib/api/mundstueck293";

const user = { ms: "3001", upm: 10, anzahl: 1, laenge: 800 };
const brennen4 = [{ temp: 1000 }, { temp: 1100 }, { temp: 1200 }, { temp: 1300 }];
const row = (id: string, key: string, v: unknown) => ({ id, result_name: `form:f1:${key}`, value: null, remarks: JSON.stringify(v) });

const schwOriginal = () => [
  row("s-ausw", "ms_auswahl_1", [{ ms: "3001", anzahl: 2, laenge: 500 }]),
  row("s-ms", "mundstueck_ms_1", [{ pressdruck_1: 60 }]),
  row("s-brenn", "brennen_1", brennen4),
];

beforeEach(() => {
  writes.length = 0;
  db = {
    measurements: [
      { id: "ext", measurement_services: { service_name: "Extrusion" }, measurement_results: [row("e-ausw", "ms_auswahl_1", [user])] },
      { id: "schw", measurement_services: { service_name: "Schwindung" }, measurement_results: schwOriginal() },
    ],
  };
});

const parsed = (mId: string, key: string) =>
  JSON.parse(db.measurements.find((m) => m.id === mId).measurement_results.find((r: any) => r.result_name === `form:f1:${key}`).remarks);

describe("mundstueck293.syncOrder – nur Extrusion", () => {
  it("legt 293/1 nur in der Extrusionsaufgabe an; Schwindung bleibt unverändert", async () => {
    const res = await mundstueck293.syncOrder("o1");
    expect(res.changes.every((c) => c.measurementId === "ext")).toBe(true);
    expect(writes.some((w) => String(w.id ?? "").startsWith("s-") || w.p?.order_measurement_id === "schw")).toBe(false);
    expect(db.measurements[1].measurement_results).toEqual(schwOriginal());
    expect(parsed("ext", "ms_auswahl_1").filter((r: any) => r.ms === "293_1" && r.auto)).toHaveLength(1);
  });

  it("bookedCases berücksichtigt weiterhin die Schwindungsaufgabe", async () => {
    await mundstueck293.syncOrder("o1");
    const auto = parsed("ext", "ms_auswahl_1").filter((r: any) => r.auto);
    expect(auto.map((r: any) => r.zweck)).toEqual(["Schwindung"]);
  });

  it("brennen_1 aus einer anderen Aufgabe mit demselben Formular wird weiter herangezogen", async () => {
    db.measurements[0].measurement_services.service_name = "Extrusion";
    db.measurements[1].measurement_services.service_name = "Raumgewicht";
    await mundstueck293.syncOrder("o1");
    const rw = parsed("ext", "ms_auswahl_1").find((r: any) => r.auto);
    expect(rw.anzahl).toBe(3); // 4 Brenntemperaturen → 3
  });

  it("wiederholter Aufruf ändert nichts weiter und lässt Schwindung unberührt", async () => {
    await mundstueck293.syncOrder("o1");
    const after1 = parsed("ext", "ms_auswahl_1");
    writes.length = 0;
    const res2 = await mundstueck293.syncOrder("o1");
    expect(res2.changes).toEqual([]);
    expect(writes).toEqual([]);
    expect(parsed("ext", "ms_auswahl_1")).toEqual(after1);
    expect(db.measurements[1].measurement_results).toEqual(schwOriginal());
  });
});
