import { describe, it, expect } from "vitest";
import {
  msFromSchwindungKey, resolveMsOptionValue, schwMsFromAnalysePpp, planMundstueck293, ZWECK_RW, ZWECK_SCHW,
} from "@/lib/rules/mundstueck293";

const OPTIONS = ["293_1", "3001", "0275_1", "9001"];
const plan = (schwKeys: string[], extra: Partial<Parameters<typeof planMundstueck293>[0]> = {}) =>
  planMundstueck293({
    rw: false, schw: false, brennCount: 0, msAuswahl: [], mundstueckMs: [],
    schwMs: schwMsFromAnalysePpp(schwKeys, OPTIONS).values, ...extra,
  });

describe("MS-Auswahlwert aus analyse_ppp", () => {
  it("1–4: Schlüssel ergeben exakt den Optionswert, führende Nullen bleiben", () => {
    expect(schwMsFromAnalysePpp(["schwindung_ms_293_1"], OPTIONS).values).toEqual(["293_1"]);
    expect(schwMsFromAnalysePpp(["schwindung_ms_3001"], OPTIONS).values).toEqual(["3001"]);
    expect(schwMsFromAnalysePpp(["schwindung_ms_0275_1"], OPTIONS).values).toEqual(["0275_1"]);
    expect(msFromSchwindungKey("schwindung_ms_0275_1")).toBe("0275_1");
    expect(plan(["schwindung_ms_0275_1"]).msAuswahl[0].ms).toBe("0275_1");
  });

  it("5: nicht vorhandener Optionswert erzeugt keinen Eintrag", () => {
    const r = schwMsFromAnalysePpp(["schwindung_ms_4711"], OPTIONS);
    expect(r).toEqual({ values: [], rejected: ["schwindung_ms_4711"] });
    expect(plan(["schwindung_ms_4711"]).msAuswahl).toEqual([]);
  });

  it("6: nicht eindeutige Option erzeugt keinen Eintrag", () => {
    expect(resolveMsOptionValue("293_1", ["293_1", "293_1"])).toBe("293_1"); // gleicher Wert doppelt gelistet = eindeutig
    expect(resolveMsOptionValue("ab_1", ["AB_1", "ab_1"])).toBeNull();
    expect(schwMsFromAnalysePpp(["schwindung_ms_ab_1"], ["AB_1", "ab_1"]).values).toEqual([]);
  });

  it("nie Label/Leistungsname: andere analyse_ppp-Werte werden ignoriert", () => {
    expect(schwMsFromAnalysePpp(["extrusion", "Schwindung 293/1", { value: "schwindung_ms_3001" }], OPTIONS).values).toEqual(["3001"]);
  });
});

describe("Zweckunabhängiger Duplikatschutz", () => {
  it("7/9/10/11: Schwindung 293_1 neben RW ergibt nur einen 293_1-Eintrag, RW unverändert", () => {
    const p = plan(["schwindung_ms_293_1"], { rw: true, brennCount: 4 });
    expect(p.msAuswahl).toEqual([{ ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true }]);
    expect(p.mundstueckMs).toEqual([{ ms: "293_1" }]);
  });

  it("9/10: vorhandener automatischer RW-Eintrag bleibt vollständig erhalten", () => {
    const rw = { ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true };
    const ms = [{ ms: "293_1", pressdruck_1: 60 }];
    const p = plan(["schwindung_ms_293_1"], { rw: true, brennCount: 4, msAuswahl: [rw], mundstueckMs: ms });
    expect(p.changedAuswahl).toBe(false);
    expect(p.msAuswahl).toEqual([rw]);
    expect(p.mundstueckMs).toEqual(ms);
  });

  it("8/11: vorhandener Auftraggeber-Eintrag verhindert weiteren Eintrag", () => {
    const user = { ms: "3001", anzahl: 1, laenge: 800, zweck: "Sonstiges" };
    const p = plan(["schwindung_ms_3001"], { msAuswahl: [user], mundstueckMs: [{ a: 1 }] });
    expect(p.changedAuswahl).toBe(false);
    expect(p.msAuswahl).toEqual([user]);
    expect(p.mundstueckMs).toEqual([{ a: 1 }]);
  });

  it("14: wiederholte Synchronisation erzeugt keine Duplikate", () => {
    const p1 = plan(["schwindung_ms_3001", "schwindung_ms_293_1"], { rw: true, brennCount: 2 });
    const p2 = plan(["schwindung_ms_3001", "schwindung_ms_293_1"], { rw: true, brennCount: 2, msAuswahl: p1.msAuswahl, mundstueckMs: p1.mundstueckMs });
    expect(p2.changedAuswahl).toBe(false);
    expect(p1.msAuswahl.map((r) => r.ms)).toEqual(["293_1", "3001"]);
  });

  it("15: RW-Automatik unverändert (Anzahl nach Brenntemperaturen, Länge 200)", () => {
    const p = plan([], { rw: true, brennCount: 5 });
    expect(p.msAuswahl).toEqual([{ ms: "293_1", anzahl: 3, laenge: 200, zweck: ZWECK_RW, auto: true }]);
  });
});

describe("Bereinigung des fehlerhaften Eintrags (Auftrag 5678)", () => {
  const rw = { ms: "293_1", anzahl: 2, laenge: 200, zweck: ZWECK_RW, auto: true };
  const user = { ms: "3001", anzahl: 1, laenge: 800 };
  const faulty = { ms: "293/1", anzahl: 3, laenge: 150, zweck: ZWECK_SCHW, auto: true };

  it("12/16: fehlerhafter Auto-Eintrag ohne Werte wird samt Paarzeile entfernt", () => {
    const ms = [{ ms: "3001", p: 1 }, { ms: "293_1", pressdruck_1: 50 }, { ms: "293/1" }];
    const p = plan(["schwindung_ms_293_1"], { rw: true, brennCount: 2, msAuswahl: [user, rw, faulty], mundstueckMs: ms });
    expect(p.msAuswahl).toEqual([user, rw]);
    expect(p.mundstueckMs).toEqual([{ ms: "3001", p: 1 }, { ms: "293_1", pressdruck_1: 50 }]);
  });

  it("13: erfasste Werte schützen den Eintrag (verwaist, nicht gelöscht)", () => {
    const ms = [{ ms: "3001" }, { ms: "293_1" }, { ms: "293/1", pressdruck_1: 70 }];
    const p = plan(["schwindung_ms_293_1"], { rw: true, brennCount: 2, msAuswahl: [user, rw, faulty], mundstueckMs: ms });
    expect(p.msAuswahl).toEqual([user, rw, { ...faulty, verwaist: true }]);
    expect(p.mundstueckMs).toEqual(ms);
  });

  it("unsichere Paarung (Mundstück-Zeile mit anderer Kennung): Eintrag bleibt unverändert", () => {
    const ms = [{ ms: "3001" }, { ms: "293_1" }, { ms: "9001" }];
    const p = plan(["schwindung_ms_293_1"], { rw: true, brennCount: 2, msAuswahl: [user, rw, faulty], mundstueckMs: ms });
    expect(p.msAuswahl).toContainEqual(faulty);
    expect(p.mundstueckMs).toEqual(ms);
  });
});
