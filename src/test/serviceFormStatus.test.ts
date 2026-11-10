import { describe, it, expect } from "vitest";
import {
  classicRequiredKeys,
  linkedRequiredKeys,
  evaluateServiceFormStatus,
} from "@/lib/orderCreation/serviceFormStatus";
import { normalizeRestoredDraft } from "@/lib/orderDraftSafety";

const fields = [
  { id: "f1", field_key: "masse", is_required: true },
  { id: "f2", field_key: "notiz", is_required: false },
  { id: "f3", field_key: "temp", is_required: true },
  { id: "f4", field_key: "alt", is_required: true, archived: true },
];

const sections = [
  { fields: [{ field_id: "f1" }, { field_id: "f2" }] },
  { fields: [{ field_id: "f3", hidden: true }] },
  { repeatable: { enabled: true }, fields: [{ field_id: "f4" }] },
];

describe("Statusanzeige – Pflichtfeldauflösung", () => {
  it("nur platzierte, sichtbare, nicht archivierte Pflichtfelder zählen", () => {
    const keys = classicRequiredKeys({ fields, sections, ruleRequired: new Set(), ruleHidden: new Set() });
    expect(keys).toEqual(["masse"]); // f3 versteckt, f4 archiviert + Repeater
  });

  it("Regeln können Pflichtfelder setzen und Felder ausblenden", () => {
    const keys = classicRequiredKeys({
      fields,
      sections,
      ruleRequired: new Set(["notiz"]),
      ruleHidden: new Set(["masse"]),
    });
    expect(keys).toEqual(["notiz"]);
  });

  it("ohne Customer-Layout gibt es keine Pflichtfelder", () => {
    expect(classicRequiredKeys({ fields, sections: null, ruleRequired: new Set(), ruleHidden: new Set() })).toEqual([]);
    expect(classicRequiredKeys({ fields, sections: [], ruleRequired: new Set(), ruleHidden: new Set() })).toEqual([]);
  });

  it("verknüpfte Formulare liefern namensraumbasierte Schlüssel", () => {
    expect(linkedRequiredKeys("form1", [
      { field_key: "a", is_required: true },
      { field_key: "b", is_required: false },
    ])).toEqual(["form:form1:a"]);
  });
});

describe("Statusanzeige – Auswertung", () => {
  it("Offen: keine Eingaben", () => {
    expect(evaluateServiceFormStatus({ values: {}, requiredKeys: ["masse"], metaReady: true })).toBe("offen");
    expect(evaluateServiceFormStatus({ values: { masse: "" }, requiredKeys: ["masse"], metaReady: true })).toBe("offen");
  });

  it("In Bearbeitung: Eingaben, aber Metadaten noch nicht geladen", () => {
    expect(evaluateServiceFormStatus({ values: { masse: "1" }, requiredKeys: [], metaReady: false })).toBe("in_bearbeitung");
  });

  it("In Bearbeitung: Eingaben, aber keine Pflichtfelder definiert", () => {
    expect(evaluateServiceFormStatus({ values: { notiz: "x" }, requiredKeys: [], metaReady: true })).toBe("in_bearbeitung");
  });

  it("Unvollständig: Pflichtfeld ohne Wert", () => {
    expect(evaluateServiceFormStatus({ values: { notiz: "x" }, requiredKeys: ["masse"], metaReady: true })).toBe("unvollstaendig");
  });

  it("Vollständig: alle Pflichtfelder erfüllt (0 und false zählen als Eingabe)", () => {
    expect(evaluateServiceFormStatus({ values: { masse: 0 }, requiredKeys: ["masse"], metaReady: true })).toBe("vollstaendig");
    expect(evaluateServiceFormStatus({ values: { masse: false }, requiredKeys: ["masse"], metaReady: true })).toBe("vollstaendig");
  });

  it("namensraumbasierte Pflichtfelder verknüpfter Formulare werden geprüft", () => {
    expect(evaluateServiceFormStatus({ values: { "form:f:a": "x" }, requiredKeys: ["form:f:a"], metaReady: true })).toBe("vollstaendig");
    expect(evaluateServiceFormStatus({ values: { "form:f:b": "x" }, requiredKeys: ["form:f:a"], metaReady: true })).toBe("unvollstaendig");
  });
});

describe("Entwurf: aktiver Reiter wird gespeichert und wiederhergestellt", () => {
  it("normalizeRestoredDraft übernimmt aktiven Reiter und Reihenfolge", () => {
    const p = normalizeRestoredDraft({ activeMeasurementUid: "uid-9", serviceTabOrder: ["uid-3", "uid-9"] });
    expect(p.activeMeasurementUid).toBe("uid-9");
    expect(p.serviceTabOrder).toEqual(["uid-3", "uid-9"]);
  });

  it("alte Entwürfe ohne Reiterangaben bleiben ladbar", () => {
    const p = normalizeRestoredDraft({});
    expect(p.activeMeasurementUid).toBeNull();
    expect(p.serviceTabOrder).toEqual([]);
  });
});
