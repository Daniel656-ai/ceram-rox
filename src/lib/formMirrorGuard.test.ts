import { describe, it, expect } from "vitest";
import { linkedMirrorDecision, masterDataMirrorDecision } from "./formMirrorGuard";

describe("linkedMirrorDecision", () => {
  it("überschreibt einen gespeicherten Wert nicht, solange die Quelle lädt", () => {
    const d = linkedMirrorDecision({
      interactive: true, sameForm: false, sourcesReady: false,
      srcRaw: null, ownRaw: "gespeichert",
    });
    expect(d.write).toBe(false);
  });

  it("spiegelt nach erfolgreichem Laden auch einen leeren Quellwert", () => {
    const d = linkedMirrorDecision({
      interactive: true, sameForm: false, sourcesReady: true,
      srcRaw: null, ownRaw: "alt",
    });
    expect(d).toEqual({ write: true, value: "" });
  });

  it("spiegelt einen aufgelösten Quellwert", () => {
    const d = linkedMirrorDecision({
      interactive: true, sameForm: false, sourcesReady: true,
      srcRaw: 42, ownRaw: "",
    });
    expect(d).toEqual({ write: true, value: 42 });
  });

  it("spiegelt felder desselben Formulars sofort (synchron, kein Ladezustand)", () => {
    const d = linkedMirrorDecision({
      interactive: true, sameForm: true, sourcesReady: false,
      srcRaw: "x", ownRaw: "",
    });
    expect(d).toEqual({ write: true, value: "x" });
  });

  it("schreibt nicht bei unverändertem Wert", () => {
    const d = linkedMirrorDecision({
      interactive: true, sameForm: false, sourcesReady: true,
      srcRaw: "gleich", ownRaw: "gleich",
    });
    expect(d.write).toBe(false);
  });

  it("schreibt nie im nicht-interaktiven Modus", () => {
    const d = linkedMirrorDecision({
      interactive: false, sameForm: true, sourcesReady: true,
      srcRaw: "x", ownRaw: "",
    });
    expect(d.write).toBe(false);
  });
});

describe("masterDataMirrorDecision", () => {
  it("überschreibt nicht, solange der Katalog lädt", () => {
    const d = masterDataMirrorDecision({
      interactive: true, catalogReady: false, resolved: false,
      value: null, ownRaw: "gespeichert",
    });
    expect(d.write).toBe(false);
  });

  it("überschreibt nicht bei ungültiger/fehlender Referenz", () => {
    const d = masterDataMirrorDecision({
      interactive: true, catalogReady: true, resolved: false,
      value: null, ownRaw: "gespeichert",
    });
    expect(d.write).toBe(false);
  });

  it("spiegelt bei geladenem Katalog und aufgelöster Referenz", () => {
    const d = masterDataMirrorDecision({
      interactive: true, catalogReady: true, resolved: true,
      value: 1.5, ownRaw: "",
    });
    expect(d).toEqual({ write: true, value: "1.5" });
  });

  it("schreibt nicht bei unverändertem Wert", () => {
    const d = masterDataMirrorDecision({
      interactive: true, catalogReady: true, resolved: true,
      value: "a", ownRaw: "a",
    });
    expect(d.write).toBe(false);
  });

  it("schreibt nie im nicht-interaktiven Modus", () => {
    const d = masterDataMirrorDecision({
      interactive: false, catalogReady: true, resolved: true,
      value: "a", ownRaw: "",
    });
    expect(d.write).toBe(false);
  });
});
