import { describe, it, expect } from "vitest";
import {
  applyGlobalDefinitions,
  instanceSuffix,
  type GlobalDefinitionLike,
  type InheritingField,
} from "@/lib/globalFieldInheritance";

const gf: GlobalDefinitionLike = {
  id: "g1",
  field_key: "temperatur",
  display_name: "Temperatur der Messung",
  description: "Zentrale Beschreibung",
  unit: "°C",
};

const mk = (p: Partial<InheritingField>): InheritingField => ({
  field_key: "temperatur",
  display_name: "Temperatur",
  description: null,
  unit: null,
  global_field_id: "g1",
  ...p,
});

describe("globale Felddefinition", () => {
  it("überlagert Bezeichnung, Einheit und Beschreibung in allen Formularen", () => {
    const [a, b] = applyGlobalDefinitions([mk({}), mk({})], [gf]);
    expect(a.display_name).toBe("Temperatur der Messung");
    expect(b.display_name).toBe("Temperatur der Messung");
    expect(a.unit).toBe("°C");
    expect(a.description).toBe("Zentrale Beschreibung");
  });

  it("erhält Suffixe von Mehrfachverwendungen", () => {
    expect(instanceSuffix("temperatur_2", gf)).toBe(" (Verwendung 2)");
    expect(instanceSuffix("temperatur_2", { ...gf, is_repeatable: true })).toBe(" 2");
    const [f] = applyGlobalDefinitions([mk({ field_key: "temperatur_3" })], [gf]);
    expect(f.display_name).toBe("Temperatur der Messung (Verwendung 3)");
  });

  it("lässt lokale Felder unverändert", () => {
    const local = mk({ global_field_id: null, display_name: "Lokal", unit: "mm" });
    const [f] = applyGlobalDefinitions([local], [gf]);
    expect(f).toEqual(local);
  });

  it("behält die Kopie, wenn die globale Definition fehlt", () => {
    const [f] = applyGlobalDefinitions([mk({ global_field_id: "weg" })], [gf]);
    expect(f.display_name).toBe("Temperatur");
  });

  it("verändert Schlüssel und Werte nicht", () => {
    const [f] = applyGlobalDefinitions([mk({ field_key: "temperatur" })], [gf]);
    expect(f.field_key).toBe("temperatur");
    expect(f.global_field_id).toBe("g1");
  });

  it("übernimmt eine globale Konstante verbindlich und schreibgeschützt", () => {
    const [f] = applyGlobalDefinitions([mk({ metadata: { local: true } })], [{
      ...gf,
      data_source: "constant",
      default_value: "0,972",
      data_type: "decimal",
    }]);
    expect((f as any).default_value).toBe("0,972");
    expect((f as any).readonly).toBe(true);
    expect(f.metadata).toEqual({ local: true, global_field_source: "constant" });
  });
});

describe("Auswahlwerte globaler Felder", () => {
  it("übernimmt nachträglich gepflegte Optionen in bestehende Formularfelder", () => {
    const global: GlobalDefinitionLike = {
      ...gf,
      data_type: "multiselect",
      select_options: [
        { label: "Option 1", value: "option_1" },
        { label: "Option 2", value: "option_2" },
      ],
    };
    const [f] = applyGlobalDefinitions([mk({ select_options: [] })], [global]);
    expect(f.select_options).toEqual([
      { label: "Option 1", value: "option_1" },
      { label: "Option 2", value: "option_2" },
    ]);
  });

  it("lässt gespeicherte Optionen unverändert, wenn das globale Feld keine hat", () => {
    const [f] = applyGlobalDefinitions([mk({ select_options: ["A"] })], [{ ...gf, select_options: [] }]);
    expect(f.select_options).toEqual(["A"]);
  });
});
