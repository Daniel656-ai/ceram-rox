import { describe, it, expect } from "vitest";
import { planServiceSync, readServiceSelection } from "@/lib/orderServiceSelection";

const services = [
  { id: "s1", service_name: "Knetung", category: "pilot_plant" },
  { id: "s2", service_name: "Extrusion", category: "pilot_plant" },
];

describe("readServiceSelection", () => {
  it("liest die Mehrfachauswahl 'Dienstleistungen'", () => {
    const fields = [
      { field_key: "dl", display_name: "Dienstleistungen", field_type: "multiselect" },
      { field_key: "other", display_name: "Bemerkung", field_type: "text" },
    ];
    expect(readServiceSelection({ dl: ["Knetung", "Extrusion"], other: "x" }, fields)).toEqual([
      "Knetung",
      "Extrusion",
    ]);
  });

  it("verträgt Objekt-Optionen und Einzelwerte", () => {
    const fields = [{ field_key: "services", display_name: null, field_type: "multiselect" }];
    expect(readServiceSelection({ services: [{ value: "Knetung" }] }, fields)).toEqual(["Knetung"]);
  });
});

describe("planServiceSync", () => {
  it("legt für neue Auswahl Positionen an", () => {
    const plan = planServiceSync({ selection: ["Knetung"], services, measurements: [] });
    expect(plan.add.map((a) => a.service.id)).toEqual(["s1"]);
    expect(plan.remove).toEqual([]);
  });

  it("entfernt abgewählte, unbearbeitete Positionen", () => {
    const plan = planServiceSync({
      selection: [],
      services,
      measurements: [
        { uid: "u1", service_id: "s1", service_name: "Knetung", origin: "template", selection_token: "Knetung" },
      ],
    });
    expect(plan.remove).toEqual(["u1"]);
  });

  it("behält bearbeitete Positionen", () => {
    const plan = planServiceSync({
      selection: [],
      services,
      measurements: [
        { uid: "u1", service_id: "s1", service_name: "Knetung", origin: "template", selection_token: "Knetung" },
      ],
      isEdited: () => true,
    });
    expect(plan.remove).toEqual([]);
    expect(plan.keep).toEqual(["u1"]);
  });

  it("lässt manuell gebuchte Zusatzleistungen unberührt", () => {
    const plan = planServiceSync({
      selection: ["Knetung"],
      services,
      measurements: [
        { uid: "m1", service_id: "s2", service_name: "Extrusion", origin: "manual" },
      ],
    });
    expect(plan.remove).toEqual([]);
    expect(plan.add.map((a) => a.service.id)).toEqual(["s1"]);
  });

  it("meldet Auswahlwerte ohne Dienstleistung", () => {
    const plan = planServiceSync({ selection: ["Extrabeprobung"], services, measurements: [] });
    expect(plan.unresolved).toEqual(["Extrabeprobung"]);
  });
});
