import { describe, it, expect } from "vitest";
import {
  planMundstueck293, bookedCases, rwAnzahl, countBrenntemperaturen, removePairedRow,
  schwindungMs, ZWECK_RW, ZWECK_SCHW,
} from "@/lib/rules/mundstueck293";

const user = { ms: "3001", upm: 10, anzahl: 1, laenge: 800 };
const brennen = (n: number) => Array.from({ length: n }, (_, i) => ({ temp: 1000 + i }));

describe("Mundstück 293/1 – Anzahl", () => {
  it.each([[0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3]])("%i Brenntemperaturen → %i", (n, a) => {
    expect(rwAnzahl(countBrenntemperaturen(brennen(n)))).toBe(a);
  });
  it("leere Brennen-Zeilen zählen nicht", () => {
    expect(countBrenntemperaturen([{ temp: "" }, {}, { temp: 900 }])).toBe(1);
  });
  it("Leistungen zählen einmal, auch mehrfach gebucht", () => {
    expect(bookedCases(["Raumgewicht", "Wasseraufnahme", "Raumgewicht"])).toEqual({ rw: true, schw: false, schwMs: [] });
    expect(bookedCases(["Schwindung", " schwindung "])).toEqual({ rw: false, schw: true, schwMs: [] });
    expect(bookedCases(["BET"])).toEqual({ rw: false, schw: false, schwMs: [] });
  });
});

describe("Mundstück 293/1 – Planung", () => {
  it("hängt beide Auto-Einträge am Ende an (RW vor Schwindung) mit ms-Kennung", () => {
    const p = planMundstueck293({ rw: true, schw: true, brennCount: 4, msAuswahl: [user], mundstueckMs: [{ pressdruck_1: 70 }] });
    expect(p.msAuswahl).toEqual([
      user,
      { ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true },
      { ms: "293_1", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true },
    ]);
    expect(p.mundstueckMs).toEqual([{ pressdruck_1: 70 }, { ms: "293_1" }, { ms: "293_1" }]);
  });

  it("ist idempotent", () => {
    const p1 = planMundstueck293({ rw: true, schw: true, brennCount: 2, msAuswahl: [user], mundstueckMs: [] });
    const p2 = planMundstueck293({ rw: true, schw: true, brennCount: 2, msAuswahl: p1.msAuswahl, mundstueckMs: p1.mundstueckMs });
    expect(p2.changedAuswahl).toBe(false);
    expect(p2.msAuswahl).toEqual(p1.msAuswahl);
  });

  it("passt die Anzahl an, wenn sich die Brenntemperaturen ändern, Werte bleiben", () => {
    const p1 = planMundstueck293({ rw: true, schw: false, brennCount: 1, msAuswahl: [], mundstueckMs: [] });
    const filled = [{ ms: "293_1", pressdruck_1: 55 }];
    const p2 = planMundstueck293({ rw: true, schw: false, brennCount: 4, msAuswahl: p1.msAuswahl, mundstueckMs: filled });
    expect(p2.msAuswahl[0].anzahl).toBe(3);
    expect(p2.mundstueckMs).toEqual(filled);
  });

  it("vom Auftraggeber gewählter 293/1 bleibt unverändert", () => {
    const manual = { ms: "293_1", anzahl: 7, laenge: 999 };
    const p = planMundstueck293({ rw: false, schw: false, brennCount: 0, msAuswahl: [manual], mundstueckMs: [{ x: 1 }] });
    expect(p.changedAuswahl).toBe(false);
    expect(p.msAuswahl).toEqual([manual]);
  });

  it("entfernt Auto-Eintrag ohne Werte samt Mundstück-Zeile", () => {
    const p1 = planMundstueck293({ rw: true, schw: false, brennCount: 0, msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    const p2 = planMundstueck293({ rw: false, schw: false, brennCount: 0, msAuswahl: p1.msAuswahl, mundstueckMs: p1.mundstueckMs });
    expect(p2.msAuswahl).toEqual([user]);
    expect(p2.mundstueckMs).toEqual([{ a: 1 }]);
  });

  it("behält Auto-Eintrag mit Werten und markiert ihn als verwaist", () => {
    const p1 = planMundstueck293({ rw: true, schw: false, brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    const p2 = planMundstueck293({ rw: false, schw: false, brennCount: 0, msAuswahl: p1.msAuswahl, mundstueckMs: [{ ms: "293_1", pressdruck_1: 60 }] });
    expect(p2.msAuswahl[0].verwaist).toBe(true);
    expect(p2.mundstueckMs).toEqual([{ ms: "293_1", pressdruck_1: 60 }]);
    expect(p2.orphaned).toBe(1);
  });

  it("vorderer Auto-Eintrag fällt weg, hinterer bleibt – Werte bleiben beim richtigen Mundstück", () => {
    const p1 = planMundstueck293({ rw: true, schw: true, brennCount: 2, msAuswahl: [user], mundstueckMs: [{ p: "3001" }] });
    const ms = [{ p: "3001" }, { ms: "293_1" }, { ms: "293_1", pressdruck_1: 88 }];
    const p2 = planMundstueck293({ rw: false, schw: true, brennCount: 2, msAuswahl: p1.msAuswahl, mundstueckMs: ms });
    expect(p2.msAuswahl.map((r) => r.zweck ?? r.ms)).toEqual(["3001", ZWECK_SCHW]);
    expect(p2.mundstueckMs).toEqual([{ p: "3001" }, { ms: "293_1", pressdruck_1: 88 }]);
  });

  it("keine doppelten Auto-Einträge", () => {
    const dup = { ms: "293_1", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true };
    const p = planMundstueck293({ rw: false, schw: true, brennCount: 0, msAuswahl: [dup, dup], mundstueckMs: [] });
    expect(p.msAuswahl).toEqual([dup]);
  });

  it("überzählige Mundstück-Zeilen gehen nie verloren", () => {
    const p = planMundstueck293({ rw: false, schw: true, brennCount: 0, msAuswahl: [user], mundstueckMs: [{ a: 1 }, { extra: 2 }] });
    expect(p.mundstueckMs).toContainEqual({ extra: 2 });
  });
});

describe("Schwindungs-Mundstücke – generische Automatik", () => {
  it("liest die MS-Nummer aus dem Leistungsnamen (Originalschreibweise)", () => {
    expect(schwindungMs("Schwindung 3001")).toBe("3001");
    expect(schwindungMs("Schwindung 293/1")).toBe("293/1");
    expect(schwindungMs("schwindung  0042")).toBe("0042");
    expect(schwindungMs("Schwindung")).toBeNull();
    expect(schwindungMs("BET")).toBeNull();
  });

  it("bookedCases sammelt alle Schwindungs-Mundstücke, mehrfach zählt einmal", () => {
    expect(bookedCases(["Schwindung 3001", "Schwindung 293/1", "schwindung 3001"]).schwMs)
      .toEqual(["3001", "293/1"]);
    expect(bookedCases(["Schwindung"]).schwMs).toEqual([]);
  });

  it("Schwindung 3001 erzeugt Auto-Eintrag mit ms 3001 und Mundstück-Zeile", () => {
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["3001"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    expect(p.msAuswahl).toEqual([{ ms: "3001", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true }]);
    expect(p.mundstueckMs).toEqual([{ ms: "3001" }]);
  });

  it("Schwindung 293/1 erzeugt Auto-Eintrag mit ms 293/1 (Schrägstrich erhalten)", () => {
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["293/1"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    expect(p.msAuswahl[0].ms).toBe("293/1");
  });

  it("führende Nullen bleiben erhalten", () => {
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["0042"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    expect(p.msAuswahl[0].ms).toBe("0042");
  });

  it("mehrere Schwindungsleistungen erzeugen jeweils eigene Einträge", () => {
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["3001", "293/1"], brennCount: 0, msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    expect(p.msAuswahl).toEqual([
      user,
      { ms: "3001", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true },
      { ms: "293/1", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true },
    ]);
    expect(p.mundstueckMs).toEqual([{ a: 1 }, { ms: "3001" }, { ms: "293/1" }]);
  });

  it("vom Auftraggeber gewähltes Mundstück verhindert den Auto-Eintrag", () => {
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["3001"], brennCount: 0, msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    expect(p.changedAuswahl).toBe(false);
    expect(p.msAuswahl).toEqual([user]);
  });

  it("293/1 und 293_1 gelten als identisch – keine Doppelzeile", () => {
    const manual = { ms: "293_1", anzahl: 7 };
    const p = planMundstueck293({ rw: false, schw: false, schwMs: ["293/1"], brennCount: 0, msAuswahl: [manual], mundstueckMs: [{ x: 1 }] });
    expect(p.msAuswahl).toEqual([manual]);
    const p2 = planMundstueck293({ rw: false, schw: false, schwMs: ["293/1", "293_1"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    expect(p2.msAuswahl).toHaveLength(1);
    expect(p2.msAuswahl[0].ms).toBe("293/1");
  });

  it("bearbeiteter Schwindungs-Auto-Eintrag bleibt bei Wegfall als verwaist erhalten", () => {
    const p1 = planMundstueck293({ rw: false, schw: false, schwMs: ["3001"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    const p2 = planMundstueck293({ rw: false, schw: false, schwMs: [], brennCount: 0, msAuswahl: p1.msAuswahl, mundstueckMs: [{ ms: "3001", pressdruck_1: 60 }] });
    expect(p2.msAuswahl[0].verwaist).toBe(true);
    expect(p2.mundstueckMs).toEqual([{ ms: "3001", pressdruck_1: 60 }]);
    expect(p2.orphaned).toBe(1);
  });

  it("unbearbeiteter Schwindungs-Auto-Eintrag wird bei Wegfall entfernt", () => {
    const p1 = planMundstueck293({ rw: false, schw: false, schwMs: ["3001"], brennCount: 0, msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    const p2 = planMundstueck293({ rw: false, schw: false, schwMs: [], brennCount: 0, msAuswahl: p1.msAuswahl, mundstueckMs: p1.mundstueckMs });
    expect(p2.msAuswahl).toEqual([user]);
    expect(p2.mundstueckMs).toEqual([{ a: 1 }]);
  });

  it("mehrfaches Synchronisieren erzeugt keine Duplikate", () => {
    const p1 = planMundstueck293({ rw: false, schw: false, schwMs: ["3001", "293/1"], brennCount: 0, msAuswahl: [], mundstueckMs: [] });
    const p2 = planMundstueck293({ rw: false, schw: false, schwMs: ["3001", "293/1"], brennCount: 0, msAuswahl: p1.msAuswahl, mundstueckMs: p1.mundstueckMs });
    expect(p2.changedAuswahl).toBe(false);
    expect(p2.msAuswahl).toEqual(p1.msAuswahl);
  });

  it("RW-Automatik und Schwindungs-Mundstücke arbeiten zusammen, Paarung bleibt positionsgleich", () => {
    const p = planMundstueck293({ rw: true, schw: false, schwMs: ["3001"], brennCount: 4, msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    expect(p.msAuswahl).toEqual([
      user,
      { ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true },
      { ms: "3001", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true },
    ]);
    expect(p.mundstueckMs).toEqual([{ a: 1 }, { ms: "293_1" }, { ms: "3001" }]);
  });
});

describe("Formular: gekoppeltes Entfernen", () => {
  it("entfernt Zeile an gleicher Position in beiden Listen", () => {
    const r = removePairedRow([{ ms: "a" }, { ms: "b" }], [{}, { x: 1 }], 0);
    expect(r).toEqual({ ok: true, auswahl: [{ ms: "b" }], mundstueck: [{ x: 1 }] });
  });
  it("verweigert, wenn die Mundstück-Zeile Werte hat", () => {
    expect(removePairedRow([{ ms: "a" }], [{ pressdruck_1: 5 }], 0)).toEqual({ ok: false });
  });
});
