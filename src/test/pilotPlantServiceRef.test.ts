import { describe, it, expect } from "vitest";
import {
  planServiceSync,
  readServiceSelectionEntries,
  INVALID_SERVICE_REF_SUFFIX,
} from "@/lib/orderServiceSelection";

const services = [
  { id: "s-ext", service_name: "Extrusionsversuch" },
  { id: "s-ph", service_name: "pH-Bestimmung" },
  { id: "s-feu", service_name: "Feuchte" },
];

const field = (options: any[]) => ({
  field_key: "analyse_ppp",
  display_name: "Analyse PPP",
  field_type: "multiselect",
  select_options: options,
});

const run = (options: any[], selected: string[], svc = services) =>
  planServiceSync({
    selection: readServiceSelectionEntries({ analyse_ppp: selected }, [field(options)], svc),
    services: svc,
    measurements: [],
  });

describe("Pilot-Plant-Liste → Auszulösende Dienstleistung", () => {
  it("gültige service_id löst genau diese Dienstleistung aus, trotz abweichendem Namen", () => {
    const p = run([{ value: "extrusion", label: "Extrusion", service_id: "s-ext" }], ["extrusion"]);
    expect(p.add.map((a) => a.service.id)).toEqual(["s-ext"]);
    expect(p.unresolved).toEqual([]);
  });

  it("ohne service_id bleibt der bisherige Namensvergleich", () => {
    const p = run(
      [{ value: "feuchte", label: "Feuchte" }, { value: "x", label: "Extrusion", service_id: "s-ext" }],
      ["feuchte"]
    );
    expect(p.add.map((a) => a.service.id)).toEqual(["s-feu"]);
  });

  it("ungültige/archivierte service_id: kein Namens-Fallback, Hinweis", () => {
    // Name würde passen – darf aber nicht verwendet werden.
    const p = run([{ value: "feuchte", label: "Feuchte", service_id: "s-weg" }], ["feuchte"]);
    expect(p.add).toEqual([]);
    expect(p.unresolved).toEqual(["feuchte" + INVALID_SERVICE_REF_SUFFIX]);
  });

  it("Umbenennung des Listeneintrags zerstört die Zuordnung nicht", () => {
    const p = run([{ value: "extrusion", label: "Extrusion (neu)", service_id: "s-ext" }], ["extrusion"]);
    expect(p.add[0].service.id).toBe("s-ext");
  });

  it("Umbenennung der Dienstleistung zerstört die Zuordnung nicht", () => {
    const renamed = services.map((s) => (s.id === "s-ext" ? { ...s, service_name: "Extrusion Pilot" } : s));
    const p = run([{ value: "extrusion", label: "Extrusion", service_id: "s-ext" }], ["extrusion"], renamed);
    expect(p.add[0].service).toMatchObject({ id: "s-ext", service_name: "Extrusion Pilot" });
  });

  it("mehrere Einträge gemischt mit und ohne Zuordnung, keine Duplikate", () => {
    const p = run(
      [
        { value: "extrusion", label: "Extrusion", service_id: "s-ext" },
        { value: "ph", label: "pH", service_id: "s-ph" },
        { value: "feuchte", label: "Feuchte" },
        { value: "unbekannt", label: "Unbekannt" },
      ],
      ["extrusion", "ph", "feuchte", "unbekannt"]
    );
    expect(p.add.map((a) => a.service.id)).toEqual(["s-ext", "s-ph", "s-feu"]);
    expect(p.unresolved).toEqual(["unbekannt"]);
  });
});
