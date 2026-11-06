import { describe, it, expect } from "vitest";
import {
  computeServiceSla,
  aggregateSla,
  diffCalendarDays,
  viennaTodayISO,
  slaInputFromMeasurement,
  type SlaServiceInput,
} from "../slaCalculator";

const TODAY = "2026-11-06"; // Fixiertes „Heute" für deterministische Tests

const svc = (over: Partial<SlaServiceInput> = {}): SlaServiceInput => ({
  status: "open",
  monitoringEnabled: true,
  warningDays: 5,
  ...over,
});

describe("diffCalendarDays", () => {
  it("rechnet reine Kalendertage ohne Zeitzoneneinfluss", () => {
    expect(diffCalendarDays("2026-11-06", "2026-11-06")).toBe(0);
    expect(diffCalendarDays("2026-11-06", "2026-11-11")).toBe(5);
    expect(diffCalendarDays("2026-11-06", "2026-11-05")).toBe(-1);
    expect(diffCalendarDays("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("viennaTodayISO", () => {
  it("liefert YYYY-MM-DD in Europe/Vienna unabhängig von der Client-Zone", () => {
    // 2026-11-06T23:30 UTC ist in Wien bereits der 07.11. (UTC+1).
    const utcLate = new Date("2026-11-06T23:30:00Z");
    expect(viennaTodayISO(utcLate)).toBe("2026-11-07");
    // 2026-11-06T00:30 UTC ist in Wien 01:30 am selben Tag.
    const utcEarly = new Date("2026-11-06T00:30:00Z");
    expect(viennaTodayISO(utcEarly)).toBe("2026-11-06");
  });
});

describe("computeServiceSla", () => {
  it("1. Fälligkeit heute → Gelb", () => {
    expect(computeServiceSla(svc(), "2026-11-06", TODAY).color).toBe("yellow");
  });

  it("2. Fälligkeit gestern → Rot", () => {
    const r = computeServiceSla(svc(), "2026-11-05", TODAY);
    expect(r.color).toBe("red");
    expect(r.daysUntilDue).toBe(-1);
  });

  it("3. Fälligkeit in 5 Tagen bei Vorwarnzeit 5 → Gelb", () => {
    expect(computeServiceSla(svc({ warningDays: 5 }), "2026-11-11", TODAY).color).toBe("yellow");
  });

  it("4. Fälligkeit in 6 Tagen bei Vorwarnzeit 5 → Grün", () => {
    expect(computeServiceSla(svc({ warningDays: 5 }), "2026-11-12", TODAY).color).toBe("green");
  });

  it("5. Vorwarnzeit 0 → nur am Fälligkeitstag Gelb, ab Folgetag Rot", () => {
    expect(computeServiceSla(svc({ warningDays: 0 }), "2026-11-06", TODAY).color).toBe("yellow");
    expect(computeServiceSla(svc({ warningDays: 0 }), "2026-11-07", TODAY).color).toBe("green");
    expect(computeServiceSla(svc({ warningDays: 0 }), "2026-11-05", TODAY).color).toBe("red");
  });

  it("6. Überwachung deaktiviert → Neutral", () => {
    expect(computeServiceSla(svc({ monitoringEnabled: false }), "2026-11-05", TODAY).color).toBe("neutral");
  });

  it("kein Fälligkeitsdatum → Neutral", () => {
    expect(computeServiceSla(svc(), null, TODAY).color).toBe("neutral");
  });

  it("abgeschlossene Dienstleistung → Abgeschlossen (auch bei Verzug)", () => {
    expect(computeServiceSla(svc({ status: "completed" }), "2026-11-01", TODAY).color).toBe("completed");
  });

  it("Bearbeitungsstatus (in_progress) beeinflusst die Farbe nicht", () => {
    expect(computeServiceSla(svc({ status: "in_progress" }), "2026-11-05", TODAY).color).toBe("red");
  });

  it("Beispiel aus der Freigabe: Fälligkeit 20.11., Vorwarnzeit 5", () => {
    const due = "2026-11-20";
    expect(computeServiceSla(svc(), due, "2026-11-14").color).toBe("green");
    expect(computeServiceSla(svc(), due, "2026-11-15").color).toBe("yellow");
    expect(computeServiceSla(svc(), due, "2026-11-20").color).toBe("yellow");
    expect(computeServiceSla(svc(), due, "2026-11-21").color).toBe("red");
  });
});

describe("aggregateSla", () => {
  it("7. Auftrag ohne Fälligkeitsdatum → Neutral", () => {
    expect(aggregateSla([svc()], null, TODAY).color).toBe("neutral");
  });

  it("8. Keine überwachte offene Dienstleistung → Neutral", () => {
    expect(
      aggregateSla([svc({ monitoringEnabled: false }), svc({ monitoringEnabled: false })], "2026-11-05", TODAY).color,
    ).toBe("neutral");
  });

  it("9. Alle vorhandenen Dienstleistungen abgeschlossen → Abgeschlossen", () => {
    expect(
      aggregateSla([svc({ status: "completed" }), svc({ status: "completed" })], "2026-11-05", TODAY).color,
    ).toBe("completed");
  });

  it("10. Leere Dienstleistungsliste → nicht fälschlich Abgeschlossen", () => {
    expect(aggregateSla([], "2026-11-05", TODAY).color).toBe("neutral");
    expect(aggregateSla([], null, TODAY).color).toBe("neutral");
  });

  it("11. Eine grüne und eine gelbe Dienstleistung → Auftragsampel Gelb", () => {
    const r = aggregateSla(
      [svc({ warningDays: 0 }), svc({ warningDays: 10 })],
      "2026-11-11", // 5 Tage: bei 0 grün, bei 10 gelb
      TODAY,
    );
    expect(r.color).toBe("yellow");
  });

  it("12. Eine abgeschlossene und eine rote Dienstleistung → Auftragsampel Rot", () => {
    const r = aggregateSla(
      [svc({ status: "completed" }), svc()],
      "2026-11-05",
      TODAY,
    );
    expect(r.color).toBe("red");
  });

  it("13. Unterschiedliche Vorwarnzeiten → individuelle Ampeln korrekt", () => {
    const a = computeServiceSla(svc({ warningDays: 3 }), "2026-11-10", TODAY);
    const b = computeServiceSla(svc({ warningDays: 7 }), "2026-11-10", TODAY);
    expect(a.color).toBe("green");
    expect(b.color).toBe("yellow");
  });

  it("14. Geändertes Fälligkeitsdatum → sofortige Neuberechnung", () => {
    const before = aggregateSla([svc()], "2026-11-20", TODAY);
    const after = aggregateSla([svc()], "2026-11-05", TODAY);
    expect(before.color).toBe("green");
    expect(after.color).toBe("red");
  });

  it("nicht überwachte rote Dienstleistung beeinflusst die Aggregation nicht", () => {
    const r = aggregateSla(
      [svc({ monitoringEnabled: false }), svc({ warningDays: 0 })],
      "2026-11-05", // überwachte mit Vorwarnzeit 0: gestern → rot? nein: nur nicht überwachte ist offen
      TODAY,
    );
    // Die überwachte Dienstleistung (warningDays 0) ist offen und überwacht → rot.
    expect(r.color).toBe("red");
    // Nur die nicht überwachte offene → neutral.
    expect(aggregateSla([svc({ monitoringEnabled: false })], "2026-11-05", TODAY).color).toBe("neutral");
  });
});

describe("slaInputFromMeasurement", () => {
  it("mappt order_measurements-Zeilen robust", () => {
    expect(
      slaInputFromMeasurement({
        status: "open",
        measurement_services: { sla_monitoring_enabled: true, sla_yellow_warning_days: 4 },
      }),
    ).toEqual({ status: "open", monitoringEnabled: true, warningDays: 4 });
    expect(slaInputFromMeasurement(null)).toEqual({
      status: null,
      monitoringEnabled: false,
      warningDays: null,
    });
  });
});
