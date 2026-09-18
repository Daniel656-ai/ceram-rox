import { describe, it, expect } from "vitest";
import { planServiceSync, readServiceSelection, readServiceSelectionEntries } from "@/lib/orderServiceSelection";

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

describe("Stammdatenliste mit technischem Wert", () => {
  const fields = [
    {
      field_key: "dienstleistungen",
      display_name: "Dienstleistungen",
      field_type: "multiselect",
      select_options: [
        { label: "Knetung", value: "knetung" },
        { label: "Extrusion", value: "extrusion" },
        { label: "Trocknung", value: "trocknung" },
      ],
    },
  ];

  it("Fall 1: nur Knetung", () => {
    const entries = readServiceSelectionEntries({ dienstleistungen: ["knetung"] }, fields);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add.map((a) => a.service.service_name)).toEqual(["Knetung"]);
    expect(plan.unresolved).toEqual([]);
  });

  it("Fall 2: nur Extrusion", () => {
    const entries = readServiceSelectionEntries({ dienstleistungen: ["extrusion"] }, fields);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add.map((a) => a.service.service_name)).toEqual(["Extrusion"]);
  });

  it("Fall 3: Knetung + Extrusion ergeben zwei Positionen", () => {
    const entries = readServiceSelectionEntries(
      { dienstleistungen: ["knetung", "extrusion"] },
      fields
    );
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add.map((a) => a.service.id)).toEqual(["s1", "s2"]);
  });

  it("meldet Auswahl ohne Dienstleistung weiterhin als nicht zugeordnet", () => {
    const entries = readServiceSelectionEntries({ dienstleistungen: ["trocknung"] }, fields);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add).toEqual([]);
    expect(plan.unresolved).toEqual(["trocknung"]);
  });

  it("legt vorhandene Positionen nicht doppelt an", () => {
    const entries = readServiceSelectionEntries({ dienstleistungen: ["knetung"] }, fields);
    const plan = planServiceSync({
      selection: entries,
      services,
      measurements: [
        { uid: "u1", service_id: "s1", service_name: "Knetung", origin: "template", selection_token: "knetung" },
      ],
    });
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
});

describe("Frei benanntes Auswahlfeld (Erkennung über Inhalt)", () => {
  // Feld heißt nicht "Dienstleistungen", sondern z.B. "Analyse PPP".
  // Es wird erkannt, weil ein Eintrag exakt einer Dienstleistung entspricht.
  const pppFields = [
    {
      field_key: "analyse_ppp",
      display_name: "Analyse PPP",
      field_type: "multiselect",
      select_options: [
        { label: "Knetung", value: "knetung" },
        { label: "Extrusion", value: "extrusion" },
      ],
    },
  ];

  it("Test 1: Knetung-Checkbox zeigt sofort die Knetung-Position", () => {
    const entries = readServiceSelectionEntries({ analyse_ppp: ["knetung"] }, pppFields, services);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add.map((a) => a.service.service_name)).toEqual(["Knetung"]);
    expect(plan.unresolved).toEqual([]);
  });

  it("Test 2: Extrusion-Checkbox zeigt sofort die Extrusion-Position", () => {
    const entries = readServiceSelectionEntries({ analyse_ppp: ["extrusion"] }, pppFields, services);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add.map((a) => a.service.service_name)).toEqual(["Extrusion"]);
  });

  it("Test 3: beide Checkboxen ergeben beide Positionen; Abwahl entfernt sie wieder", () => {
    const entries = readServiceSelectionEntries(
      { analyse_ppp: ["knetung", "extrusion"] },
      pppFields,
      services
    );
    const added = planServiceSync({ selection: entries, services, measurements: [] });
    expect(added.add.map((a) => a.service.id)).toEqual(["s1", "s2"]);
    const current = added.add.map((a, i) => ({
      uid: `u${i}`,
      service_id: a.service.id,
      service_name: a.service.service_name,
      origin: "template" as const,
      selection_token: a.token,
    }));
    const removed = planServiceSync({ selection: [], services, measurements: current });
    expect(removed.remove).toEqual(["u0", "u1"]);
  });

  it("meldet Einträge ohne exakt passende Dienstleistung transparent (keine Namensähnlichkeit)", () => {
    const fields = [
      {
        field_key: "analyse_ppp",
        display_name: "Analyse PPP",
        field_type: "multiselect",
        select_options: [
          { label: "Kneten", value: "kneten" },
          { label: "Extrusion", value: "extrusion" },
        ],
      },
    ];
    const entries = readServiceSelectionEntries({ analyse_ppp: ["kneten"] }, fields, services);
    const plan = planServiceSync({ selection: entries, services, measurements: [] });
    expect(plan.add).toEqual([]);
    expect(plan.unresolved).toEqual(["kneten"]);
  });

  it("ignoriert Mehrfachauswahlen ohne Dienstleistungsbezug (z.B. Versuchsziel)", () => {
    const fields = [
      {
        field_key: "versuchsziel",
        display_name: "Versuchsziel",
        field_type: "multiselect",
        select_options: ["Knetverhalten", "Extrusionsverhalten", "Sonstiges"],
      },
    ];
    expect(
      readServiceSelectionEntries({ versuchsziel: ["Knetverhalten"] }, fields, services)
    ).toEqual([]);
  });

  it("ohne Dienstleistungskatalog bleibt die namenbasierte Erkennung unverändert", () => {
    expect(readServiceSelectionEntries({ analyse_ppp: ["knetung"] }, pppFields)).toEqual([]);
  });
});
