/**
 * NACHBILDUNG (nicht die echte Datenbankfunktion) der gerichteten Logik aus
 * Migration 0019 (expand_service_workflow / service_required_services):
 * direkte Abhängigkeiten + Vorlagen-Verknüpfungen nur für die übergeordnete
 * Dienstleistung (die selbst nicht in den Verknüpfungen ihrer Vorlage steht).
 */
import { describe, it, expect } from "vitest";

type Svc = { id: string; template?: string };
const deps: Array<[string, string]> = [
  ["NOX", "GEO"], ["BENCH_NOX", "GEO"], ["BENCH_SOX", "GEO"],
];
const links: Record<string, string[]> = {
  AKT_TPL: ["GEO", "ZUS", "AKT"],
  BET_TPL: ["BET"],
};
const services: Record<string, Svc> = {
  NOX: { id: "NOX", template: "AKT_TPL" },
  GEO: { id: "GEO", template: "AKT_TPL" },
  ZUS: { id: "ZUS", template: "AKT_TPL" },
  AKT: { id: "AKT" },
  BET: { id: "BET", template: "BET_TPL" }, // wie im Web-Datenbestand: BET ist nur Teil seiner eigenen Vorlage
  BJH: { id: "BJH" },
  X_OWNER: { id: "X_OWNER", template: "AKT_TPL" },
  BENCH_NOX: { id: "BENCH_NOX" },
  BENCH_SOX: { id: "BENCH_SOX" },
};

function direct(id: string): string[] {
  const out = deps.filter(([s]) => s === id).map(([, r]) => r);
  const tpl = services[id]?.template;
  if (tpl && !(links[tpl] ?? []).includes(id)) out.push(...links[tpl].filter((x) => x !== id));
  return out;
}

/** Simuliert Auswahl + Trigger-Kaskade mit Duplikatschutz. */
function expand(selected: string[]): string[] {
  const order: string[] = [];
  const queue = [...selected];
  while (queue.length) {
    const id = queue.shift()!;
    if (order.includes(id)) continue;
    order.push(id);
    queue.push(...direct(id));
  }
  return order;
}

describe("gerichtete Abhängigkeiten (Programm-Nachbildung)", () => {
  it("BET: keine Aktivitätsmessung, keine Geometrie", () => {
    expect(expand(["BET"])).toEqual(["BET"]);
  });
  it("BJH: keine Aktivitätsmessung, keine Geometrie", () => {
    expect(expand(["BJH"])).toEqual(["BJH"]);
  });
  it("Teilleistung Geometrie zieht keine übergeordnete Leistung nach", () => {
    expect(expand(["GEO"])).toEqual(["GEO"]);
    expect(expand(["ZUS"])).toEqual(["ZUS"]);
  });
  it("Hauptleistung NOx ergänzt Geometrie weiterhin", () => {
    expect(expand(["NOX"])).toContain("GEO");
  });
  it("BENCH NOx/SOx ergänzen Geometrie weiterhin", () => {
    expect(expand(["BENCH_NOX"])).toEqual(["BENCH_NOX", "GEO"]);
    expect(expand(["BENCH_SOX"])).toEqual(["BENCH_SOX", "GEO"]);
  });
  it("BET + NOx: Geometrie genau einmal", () => {
    const r = expand(["BET", "NOX"]);
    expect(r.filter((x) => x === "GEO")).toHaveLength(1);
    expect(r).toContain("NOX");
  });
  it("Hauptleistung + manuell gewählte Teilleistung: keine Duplikate", () => {
    const r = expand(["GEO", "NOX"]);
    expect(new Set(r).size).toBe(r.length);
  });
  it("Wiederholte Auswahl erzeugt keine Duplikate", () => {
    const r = expand(["BJH", "BJH", "NOX", "NOX"]);
    expect(new Set(r).size).toBe(r.length);
  });
  it("Grenze: Leistung mit Vorlage, die selbst NICHT in deren Verknüpfungen steht, gilt als übergeordnet", () => {
    expect(expand(["X_OWNER"])).toEqual(expect.arrayContaining(["GEO", "ZUS", "AKT"]));
  });
});
