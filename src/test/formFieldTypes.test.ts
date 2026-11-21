/**
 * Feldtyp-Definition des Formulardesigners (lib/formFieldTypes.ts).
 */
import { describe, it, expect } from "vitest";
import {
  ALL_FIELD_TYPES,
  FIELD_TYPE_GROUPS,
  SUBFIELD_TYPE_GROUPS,
  fieldTypeLabel,
  slugify,
} from "@/lib/formFieldTypes";

describe("Feldtypen: Gruppen und Bezeichnungen", () => {
  it("jeder Feldtyp kommt genau einmal vor", () => {
    const werte = ALL_FIELD_TYPES.map((t) => t.value);
    expect(new Set(werte).size).toBe(werte.length);
    expect(werte.length).toBe(FIELD_TYPE_GROUPS.reduce((n, g) => n + g.types.length, 0));
  });

  it("liefert die deutsche Bezeichnung eines Feldtyps, unbekannte Typen unverändert", () => {
    expect(fieldTypeLabel("decimal")).toBe("Dezimalzahl");
    expect(fieldTypeLabel("repeater")).toBe("Repeater (wiederholbare Einträge)");
    expect(fieldTypeLabel("gibt_es_nicht")).toBe("gibt_es_nicht");
    expect(fieldTypeLabel("")).toBe("");
  });
});

describe("Feldtypen: zulässige Unterfeldtypen", () => {
  const unterfeldTypen = SUBFIELD_TYPE_GROUPS.flatMap((g) => g.types.map((t) => t.value));

  it("schließt Repeater und Messblock als Unterfeld aus", () => {
    expect(unterfeldTypen).not.toContain("repeater");
    expect(unterfeldTypen).not.toContain("measurement_block");
  });

  it("erlaubt alle übrigen Feldtypen als Unterfeld", () => {
    const erwartet = ALL_FIELD_TYPES.map((t) => t.value).filter((v) => v !== "repeater" && v !== "measurement_block");
    expect(unterfeldTypen).toEqual(erwartet);
  });

  it("lässt Gruppen weg, die dadurch leer würden", () => {
    expect(SUBFIELD_TYPE_GROUPS.map((g) => g.label)).not.toContain("Wiederholbare Gruppen");
    expect(SUBFIELD_TYPE_GROUPS.every((g) => g.types.length > 0)).toBe(true);
    expect(SUBFIELD_TYPE_GROUPS.map((g) => g.label)).toContain("Messdaten");
  });
});

describe("Feldtypen: Feldschlüssel aus Bezeichnung (slugify)", () => {
  it("schreibt klein und ersetzt Sonderzeichen und Leerzeichen durch einen Unterstrich", () => {
    expect(slugify("Dichte (g/cm³)")).toBe("dichte_g_cm");
    expect(slugify("Brenn  Temperatur 1")).toBe("brenn_temperatur_1");
  });

  it("entfernt Akzente und Umlautpunkte", () => {
    expect(slugify("Ätzdauer Café")).toBe("atzdauer_cafe");
  });

  // Bekannter Fehler: tasks/Fehler.md#F-12 (Issue #14)
  it.fails("ersetzt ß durch ss, statt es wegzulassen", () => {
    expect(slugify("Größe")).toBe("grosse");
  });

  // Bekannter Fehler: tasks/Fehler.md#F-12 (Issue #14)
  it.fails("endet auch nach dem Kürzen auf 60 Zeichen nicht auf einem Unterstrich", () => {
    expect(slugify(`${"a".repeat(59)} b`)).toMatch(/[a-z0-9]$/);
  });

  it("entfernt führende und abschließende Unterstriche", () => {
    expect(slugify("  _Wert_  ")).toBe("wert");
    expect(slugify("--- ")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("kürzt auf höchstens 60 Zeichen", () => {
    expect(slugify("a".repeat(80))).toBe("a".repeat(60));
  });
});
