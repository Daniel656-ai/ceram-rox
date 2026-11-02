import { describe, expect, it } from "vitest";
import { orderIdentity, resolveExperimentNumber } from "@/lib/orders/orderIdentity";

const pp = (extra: object = {}) => ({ order_kind: "pilot_plant", order_number: "SW-260001", ...extra });

describe("resolveExperimentNumber – zentrale Prioritäts- und Konfliktlogik", () => {
  it("nur pp_experiment_number vorhanden → dieser Wert wird angezeigt", () => {
    const r = resolveExperimentNumber(pp({ pp_experiment_number: "TE26-001" }));
    expect(r).toEqual({ value: "TE26-001", source: "pp_experiment_number", conflicts: [] });
  });

  it("nur Legacy-Pfad vorhanden → Legacy-Wert wird angezeigt", () => {
    const r = resolveExperimentNumber(pp({ shared_form_data: { pp: { stammdaten: { versuchsnummer: "TE26-002" } } } }));
    expect(r).toEqual({ value: "TE26-002", source: "legacy_pp_stammdaten", conflicts: [] });
  });

  it("nur Template-Pfad vorhanden → Template-Wert wird angezeigt", () => {
    const r = resolveExperimentNumber(pp({ shared_form_data: { template: { values: { versuchsnummer: "NC26-003" } } } }));
    expect(r).toEqual({ value: "NC26-003", source: "template_values", conflicts: [] });
  });

  it("alle Quellen mit identischem Wert → Anzeige ohne Konflikt", () => {
    const r = resolveExperimentNumber(pp({
      pp_experiment_number: "TE26-004",
      shared_form_data: { pp: { stammdaten: { versuchsnummer: "TE26-004" } }, template: { values: { versuchsnummer: "TE26-004" } } },
    }));
    expect(r.value).toBe("TE26-004");
    expect(r.source).toBe("pp_experiment_number");
    expect(r.conflicts).toEqual([]);
  });

  it("alle Quellen mit unterschiedlichen Werten → höchste Priorität gewinnt, Konflikt erkannt", () => {
    const r = resolveExperimentNumber(pp({
      pp_experiment_number: "TE26-005",
      shared_form_data: { pp: { stammdaten: { versuchsnummer: "ALT-1" } }, template: { values: { versuchsnummer: "ALT-2" } } },
    }));
    expect(r.value).toBe("TE26-005");
    expect(r.source).toBe("pp_experiment_number");
    expect(r.conflicts).toEqual([
      { source: "legacy_pp_stammdaten", value: "ALT-1" },
      { source: "template_values", value: "ALT-2" },
    ]);
  });

  it("aktuelle Spalte und Legacy-Pfad unterschiedlich → aktuelle Spalte gewinnt", () => {
    const r = resolveExperimentNumber(pp({
      pp_experiment_number: "TE26-006",
      shared_form_data: { pp: { stammdaten: { versuchsnummer: "ALT-3" } } },
    }));
    expect(r.value).toBe("TE26-006");
    expect(r.conflicts).toEqual([{ source: "legacy_pp_stammdaten", value: "ALT-3" }]);
  });

  it("aktuelle Spalte leer, Legacy-Wert vorhanden → Legacy-Wert gewinnt", () => {
    const r = resolveExperimentNumber(pp({
      pp_experiment_number: "  ",
      shared_form_data: { pp: { stammdaten: { versuchsnummer: " TE26-007 " } } },
    }));
    expect(r).toEqual({ value: "TE26-007", source: "legacy_pp_stammdaten", conflicts: [] });
  });

  it("alle Quellen leer → bisherige Darstellung bleibt (technische Nummer)", () => {
    const id = orderIdentity(pp({ pp_experiment_number: null, shared_form_data: { pp: { stammdaten: {} }, template: { values: {} } } }));
    expect(id.number).toBe("SW-260001");
    expect(id.hasExperimentNumber).toBe(false);
    expect(id.missingExperimentNumber).toBe(true);
    expect(id.experimentNumberSource).toBeNull();
  });

  it("shared_form_data fehlt → kein Fehler", () => {
    expect(() => resolveExperimentNumber(pp())).not.toThrow();
    expect(resolveExperimentNumber(pp()).value).toBeNull();
    expect(resolveExperimentNumber(pp({ shared_form_data: null })).value).toBeNull();
  });

  it("verschachtelte Objekte fehlen teilweise → kein Fehler", () => {
    expect(resolveExperimentNumber(pp({ shared_form_data: { pp: {} } })).value).toBeNull();
    expect(resolveExperimentNumber(pp({ shared_form_data: { template: {} } })).value).toBeNull();
    expect(resolveExperimentNumber(pp({ shared_form_data: { pp: { stammdaten: { versuchsnummer: 42 } } } })).value).toBeNull();
  });

  it("unerwarteter Objektaufbau → kein Absturz", () => {
    expect(() => resolveExperimentNumber(pp({ shared_form_data: "kaputt" }))).not.toThrow();
    expect(() => resolveExperimentNumber(pp({ shared_form_data: [1, 2] }))).not.toThrow();
    expect(resolveExperimentNumber(pp({ shared_form_data: { pp: ["x"] } })).value).toBeNull();
  });

  it("orderIdentity nutzt die Fallback-Auflösung und meldet Herkunft und Konflikt", () => {
    const id = orderIdentity(pp({ shared_form_data: { template: { values: { versuchsnummer: "NC26-008" } } } }));
    expect(id.number).toBe("NC26-008");
    expect(id.hasExperimentNumber).toBe(true);
    expect(id.experimentNumberSource).toBe("template_values");
    expect(id.technicalNumber).toBe("SW-260001");
  });

  it("Laboraufträge bleiben unverändert (keine Fallback-Auflösung)", () => {
    const id = orderIdentity({ order_kind: "labor", order_number: "ABC260009", shared_form_data: { pp: { stammdaten: { versuchsnummer: "X" } } } });
    expect(id.number).toBe("ABC260009");
    expect(id.experimentNumberSource).toBeNull();
    expect(id.experimentNumberConflicts).toEqual([]);
  });
});
