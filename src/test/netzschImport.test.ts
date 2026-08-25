import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectImporter, fileImporters } from "@/lib/instrumentImport";
import { parseNetzsch5, decodeNetzschText, isNetzsch5, readMeasurementType } from "@/lib/instrumentImport/netzsch";
import { curveOf, interpolateAt, splitChannelHeader } from "@/lib/curves/dataset";
import { evaluationById } from "@/lib/curves/evaluations";

const load = (name: string) => {
  const buf = readFileSync(resolve(__dirname, "fixtures/netzsch", name));
  return { name, buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
};

const dilFile = () => load("dil-402c.txt");
const staFile = () => load("sta-449f3.txt");

const importer = () => fileImporters.find((i) => i.id === "netzsch5")!;

describe("Spaltenüberschriften", () => {
  it("trennt Name und Einheit", () => {
    expect(splitChannelHeader("Temp./°C")).toEqual({ name: "Temp.", unit: "°C" });
    expect(splitChannelHeader("DSC/(mW/mg)")).toEqual({ name: "DSC", unit: "mW/mg" });
    expect(splitChannelHeader("Gas Flow(purge1)/(ml/min)")).toEqual({ name: "Gas Flow(purge1)", unit: "ml/min" });
    expect(splitChannelHeader("dL/Lo")).toEqual({ name: "dL/Lo", unit: null });
    expect(splitChannelHeader("Mass/%")).toEqual({ name: "Mass", unit: "%" });
  });
});

describe("NETZSCH DIL 402C", () => {
  it("wird inhaltsbasiert erkannt", () => {
    const f = dilFile();
    expect(detectImporter(f)?.id).toBe("netzsch5");
    expect(readMeasurementType(decodeNetzschText(f.buffer))).toBe("DIL");
  });

  it("dekodiert ANSI-Umlaute korrekt", () => {
    const parsed = parseNetzsch5(decodeNetzschText(dilFile().buffer));
    expect(parsed.headerMap["OPERATOR"]).toContain("Fürpaß");
    expect(parsed.headerMap["SAMPLE LENGTH /mm"]).toBe("24.948");
    expect(parsed.instrument).toBe("NETZSCH DIL 402C");
    expect(parsed.separator).toBe(";");
    expect(parsed.decimal).toBe(".");
  });

  it("liest alle Kanäle und Messpunkte", () => {
    const parsed = parseNetzsch5(decodeNetzschText(dilFile().buffer));
    const keys = parsed.dataset.channels.map((c) => c.key);
    expect(keys.slice(0, 3)).toEqual(["temp", "time", "dl_lo"]);
    expect(parsed.dataset.rows.length).toBeGreaterThan(80);
    expect(parsed.dataset.rows[0][0]).toBe(30);
    expect(parsed.dataset.rows[parsed.dataset.rows.length - 1][0]).toBe(840);
    expect(parsed.warnings).toEqual([]);
  });

  it("leitet Alpha-Kanäle ab, wenn sie nicht exportiert wurden", () => {
    const parsed = parseNetzsch5(decodeNetzschText(dilFile().buffer));
    const tAlpha = parsed.dataset.channels.find((c) => c.key === "t_alpha");
    expect(tAlpha?.derived).toBe(true);
    expect(tAlpha?.unit).toBe("1/K");
    expect(parsed.dataset.channels.some((c) => c.key === "alpha")).toBe(true);
  });

  it("stellt Temperatur vs. dL/Lo als Kurve bereit", () => {
    const m = importer().parse(dilFile());
    const curve = curveOf(m.dataset!, "temp", "dl_lo");
    expect(curve.length).toBeGreaterThan(80);
    expect(curve[0].x).toBe(30);
    expect(interpolateAt(curve, 35)).toBeGreaterThan(0);
  });

  it("berechnet den technischen Ausdehnungskoeffizienten für 30–800 °C", () => {
    const m = importer().parse(dilFile());
    const out = evaluationById("technical_expansion_coefficient")!.run({
      dataset: m.dataset!, xKey: "temp", yKey: "dl_lo", from: 30, to: 800,
    });
    expect(out.error).toBeUndefined();
    expect(out.unit).toBe("1/K");
    expect(out.value).toBeGreaterThan(1e-6);
    expect(out.value).toBeLessThan(2e-5);
    expect(out.details.length).toBe(3);
  });
});

describe("NETZSCH STA 449F3 (DSC)", () => {
  it("wird inhaltsbasiert als DSC erkannt", () => {
    const f = staFile();
    expect(detectImporter(f)?.id).toBe("netzsch5");
    expect(readMeasurementType(decodeNetzschText(f.buffer))).toBe("DSC");
  });

  it("liest alle sieben Kanäle mit Einheiten", () => {
    const parsed = parseNetzsch5(decodeNetzschText(staFile().buffer));
    const ch = parsed.dataset.channels;
    expect(ch.map((c) => c.key)).toEqual([
      "temp", "time", "dsc", "mass", "gas_flow_purge1", "gas_flow_protective", "sensit",
    ]);
    expect(ch.find((c) => c.key === "dsc")?.unit).toBe("mW/mg");
    expect(ch.find((c) => c.key === "mass")?.unit).toBe("%");
    expect(parsed.dataset.rows.length).toBeGreaterThan(180);
  });

  it("übernimmt Einwaage und Messbedingungen als Kopfdaten", () => {
    const m = importer().parse(staFile());
    expect(m.measurementType).toBe("DSC");
    expect(m.sampleInformation.sampleName).toBe("MRS440");
    expect(m.sampleInformation.sampleMass).toBeCloseTo(22.16, 3);
    expect(m.sampleInformation.analysisDate).toBe("2025-05-06");
    expect(m.headerMap?.["EXO"]).toBe("-1");
  });

  it("berechnet den Gewichtsverlust 100–500 °C", () => {
    const m = importer().parse(staFile());
    const abs = evaluationById("delta_between")!.run({
      dataset: m.dataset!, xKey: "temp", yKey: "mass", from: 100, to: 500,
    });
    expect(abs.unit).toBe("%");
    expect(abs.value!).toBeLessThan(0);

    const rel = evaluationById("relative_loss")!.run({
      dataset: m.dataset!, xKey: "temp", yKey: "mass", from: 100, to: 500,
    });
    expect(rel.value!).toBeGreaterThan(10);
    expect(rel.unit).toBe("%");
  });

  it("ermittelt Peak-Temperatur und Peak-Fläche der DSC-Kurve", () => {
    const m = importer().parse(staFile());
    const peak = evaluationById("peak_x_min")!.run({
      dataset: m.dataset!, xKey: "temp", yKey: "dsc", from: 100, to: 500,
    });
    expect(peak.unit).toBe("°C");
    expect(peak.value!).toBeGreaterThanOrEqual(100);
    expect(peak.value!).toBeLessThanOrEqual(500);

    const area = evaluationById("peak_area")!.run({
      dataset: m.dataset!, xKey: "temp", yKey: "dsc", from: 100, to: 500,
    });
    expect(area.error).toBeUndefined();
    expect(Number.isFinite(area.value!)).toBe(true);
    expect(area.unit).toBe("mW/mg·°C");
  });
});

describe("Abgrenzung", () => {
  it("erkennt fremde Dateien nicht als NETZSCH", () => {
    const buf = new TextEncoder().encode("Parameter;Wert\nSiO2;12,3\n");
    expect(isNetzsch5(new TextDecoder().decode(buf))).toBe(false);
    expect(importer().detect({ name: "rfa.txt", buffer: buf.buffer as ArrayBuffer })).toBe(false);
  });
});
