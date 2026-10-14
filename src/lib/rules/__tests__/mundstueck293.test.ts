import { describe, it, expect } from "vitest";
import { planMundstueck293 as plan, rwAnzahl, bookedFlags, countBrennen, ZWECK_RW, ZWECK_SW } from "@/lib/rules/mundstueck293";

const manual = { ms: "3001", upm: 10, anzahl: 1, laenge: 800 };
const mund1 = { extruderfahrer_1: "Fall", pressdruck_1: 70 };
const none = { rw: false, sw: false };

describe("Automatisches Mundstück 293/1", () => {
  it("Anzahl je Brenntemperaturen", () => {
    expect([0, 1, 2, 3, 4].map(rwAnzahl)).toEqual([1, 1, 2, 2, 3]);
  });
  it("erkennt Leistungen, mehrfach zählt einmal", () => {
    expect(bookedFlags(["Raumgewicht", "Wasseraufnahme", "Raumgewicht"])).toEqual({ rw: true, sw: false });
    expect(bookedFlags(["Schwindung", "Schwindung"])).toEqual({ rw: false, sw: true });
    expect(countBrennen([{ t: 900 }, {}, { t: "" }, { t: 1000 }])).toBe(2);
  });
  it("beide gebucht → zwei Einträge am Ende, RW vor Schwindung, ms in Mundstück MS", () => {
    const r = plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 4, booked: { rw: true, sw: true } });
    expect(r.msAuswahl.slice(1)).toEqual([
      { ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true },
      { ms: "293_1", anzahl: 3, laenge: 150, zweck: ZWECK_SW, auto: true },
    ]);
    expect(r.mundstueck).toEqual([mund1, { ms: "293_1" }, { ms: "293_1" }]);
  });
  it("idempotent", () => {
    const a = plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 2, booked: { rw: true, sw: true } });
    const b = plan({ msAuswahl: a.msAuswahl, mundstueck: a.mundstueck, brennenCount: 2, booked: { rw: true, sw: true } });
    expect(b.changed).toBe(false);
  });
  it("Brenntemperaturen ändern → Anzahl angepasst, Position und Werte bleiben", () => {
    const a = plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 1, booked: { rw: true, sw: false } });
    const mund = [mund1, { ms: "293_1", pressdruck_1: 55 }];
    const b = plan({ msAuswahl: a.msAuswahl, mundstueck: mund, brennenCount: 4, booked: { rw: true, sw: false } });
    expect(b.msAuswahl[1].anzahl).toBe(3);
    expect(b.mundstueck).toEqual(mund);
  });
  it("vorderer Auto-Eintrag fällt weg, hinterer bleibt – Werte bleiben beim richtigen Mundstück", () => {
    const a = plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 1, booked: { rw: true, sw: true } });
    const mund = [mund1, { ms: "293_1" }, { ms: "293_1", pressdruck_1: 80 }];
    const b = plan({ msAuswahl: a.msAuswahl, mundstueck: mund, brennenCount: 1, booked: { rw: false, sw: true } });
    expect(b.msAuswahl).toEqual([manual, { ms: "293_1", anzahl: 3, laenge: 150, zweck: ZWECK_SW, auto: true }]);
    expect(b.mundstueck).toEqual([mund1, { ms: "293_1", pressdruck_1: 80 }]);
  });
  it("wegfallender Auto-Eintrag mit Werten bleibt und wird als verwaist markiert", () => {
    const a = plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 1, booked: { rw: true, sw: false } });
    const mund = [mund1, { ms: "293_1", pressdruck_1: 60 }];
    const b = plan({ msAuswahl: a.msAuswahl, mundstueck: mund, brennenCount: 1, booked: none });
    expect(b.msAuswahl[1].verwaist).toBe(true);
    expect(b.mundstueck).toEqual(mund);
    const c = plan({ msAuswahl: b.msAuswahl, mundstueck: mund, brennenCount: 1, booked: { rw: true, sw: false } });
    expect(c.msAuswahl[1].verwaist).toBeUndefined();
  });
  it("vom Auftraggeber gewählte 293/1-Zeile bleibt unverändert", () => {
    const own = { ms: "293_1", anzahl: 7, laenge: 500 };
    const r = plan({ msAuswahl: [own], mundstueck: [mund1], brennenCount: 0, booked: none });
    expect(r.changed).toBe(false);
    const r2 = plan({ msAuswahl: [own], mundstueck: [mund1], brennenCount: 0, booked: { rw: true, sw: false } });
    expect(r2.msAuswahl[0]).toEqual(own);
    expect(r2.msAuswahl).toHaveLength(2);
  });
  it("nichts gebucht, keine Auto-Einträge → keine Änderung", () => {
    expect(plan({ msAuswahl: [manual], mundstueck: [mund1], brennenCount: 3, booked: none }).changed).toBe(false);
  });
});
