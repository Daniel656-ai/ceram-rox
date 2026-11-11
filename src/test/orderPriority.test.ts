import { describe, it, expect } from "vitest";
import {
  PRIORITY_LEVELS,
  normalizePriority,
  priorityRank,
  priorityLabelKey,
  priorityBadgeVariant,
  isLegacyPriority,
} from "@/lib/orders/priority";

describe("order priority – vier Stufen", () => {
  it("definiert genau vier echte Stufen in aufsteigender Reihenfolge", () => {
    expect(PRIORITY_LEVELS).toEqual(["niedrig", "normal", "hoch", "sehr_hoch"]);
  });

  it("bildet historische Werte lesend auf Hoch bzw. Sehr hoch ab", () => {
    expect(normalizePriority("wichtig")).toBe("hoch");
    expect(normalizePriority("hoechste")).toBe("sehr_hoch");
    expect(isLegacyPriority("wichtig")).toBe(true);
    expect(isLegacyPriority("hoechste")).toBe(true);
    expect(isLegacyPriority("hoch")).toBe(false);
  });

  it("behandelt fehlende oder unbekannte Werte als Normal", () => {
    expect(normalizePriority(null)).toBe("normal");
    expect(normalizePriority(undefined)).toBe("normal");
    expect(normalizePriority("")).toBe("normal");
    expect(normalizePriority("unbekannt")).toBe("normal");
  });

  it("vergibt eindeutige Ränge – Hoch und Sehr hoch fallen nicht zusammen", () => {
    expect(priorityRank("niedrig")).toBe(0);
    expect(priorityRank("normal")).toBe(1);
    expect(priorityRank("hoch")).toBe(2);
    expect(priorityRank("sehr_hoch")).toBe(3);
    expect(priorityRank("hoch")).not.toBe(priorityRank("sehr_hoch"));
    // Historische Werte erhalten denselben Rang wie ihre neue Stufe
    expect(priorityRank("wichtig")).toBe(priorityRank("hoch"));
    expect(priorityRank("hoechste")).toBe(priorityRank("sehr_hoch"));
  });

  it("liefert eigene Übersetzungsschlüssel je Stufe", () => {
    expect(priorityLabelKey("niedrig")).toBe("priority_low");
    expect(priorityLabelKey("normal")).toBe("priority_normal");
    expect(priorityLabelKey("hoch")).toBe("priority_high");
    expect(priorityLabelKey("sehr_hoch")).toBe("priority_very_high");
    expect(priorityLabelKey("wichtig")).toBe("priority_high");
    expect(priorityLabelKey("hoechste")).toBe("priority_very_high");
  });

  it("unterscheidet die Badge-Varianten aller vier Stufen", () => {
    const variants = PRIORITY_LEVELS.map(priorityBadgeVariant);
    expect(new Set(variants).size).toBe(4);
    expect(priorityBadgeVariant("sehr_hoch")).toBe("destructive");
    expect(priorityBadgeVariant("hoechste")).toBe("destructive");
  });
});

describe("Auftragsliste: Sortierung nach Auftragspriorität", () => {
  it("sortiert sehr_hoch vor hoch vor normal vor niedrig, Altwerte und leer korrekt", () => {
    const vals = ["niedrig", null, "hoechste", "wichtig", "sehr_hoch", "hoch", "normal"];
    const sorted = [...vals].sort((a, b) => (3 - priorityRank(a)) - (3 - priorityRank(b)));
    expect(sorted.map((v) => normalizePriority(v))).toEqual(["sehr_hoch", "sehr_hoch", "hoch", "hoch", "normal", "normal", "niedrig"]);
  });
});
