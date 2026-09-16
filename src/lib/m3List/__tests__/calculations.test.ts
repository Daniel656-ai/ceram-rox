import { describe, it, expect } from "vitest";
import {
  elementsPerCubicMeter, elementCountForRow, markingElements, markingRows, laborKat,
  cellCountFromOrderNumber, cellCountFromConfiguration, noxMicro, soxMicro,
  lengthTolerance, diameterTolerance, innerWallTolerance, labScope, type M3Constants,
} from "../calculations";

const C: M3Constants = {
  crossSectionM: 0.15,
  pressureTestMm: 150,
  rsmMaxMm: 350,
  laborKatAddMm: 50,
  elementRounding: 10,
};

// Beispielwerte der Excel-Vorlage: Auftrag 0020-5436, Länge 520 mm, 8,47 m³.
describe("m³-Liste – Excel-Fachlogik", () => {
  it("Elemente je m³ (Excel P2)", () => {
    expect(elementsPerCubicMeter(520, C)!).toBeCloseTo(1 / (0.15 * 0.15 * 0.52), 6);
  });

  it("Elementanzahl je m³-Zeile (Excel I10)", () => {
    expect(elementCountForRow(4, 520, C)).toBe(340);
    expect(elementCountForRow(8.47, 520, C)).toBe(720);
  });

  it("Kennzeichnungselemente inkl. 10 % (Excel M5/N6)", () => {
    expect(markingElements(4, 4)).toBe(9);
    expect(markingRows(9, elementsPerCubicMeter(520, C))).toBe(1);
  });

  it("Labor-KAT (Excel N8–N15)", () => {
    const k = laborKat(520, C)!;
    expect(k.laborKatLengthMm).toBe(570);
    expect(k.rsmMinMm).toBe(350);
    expect(k.requiredLengthMm).toBe(650);
    expect(k.count).toBe(2);
    expect(laborKat(300, C)!.rsmMinMm).toBe(300);
  });

  it("Zellenzahl: Fertigungsfreigabe primär, Auftragsnummer zur Plausibilität", () => {
    expect(cellCountFromOrderNumber("0020-5436")).toBe(20);
    expect(cellCountFromConfiguration("20 Zellen")).toBe(20);
    expect(cellCountFromConfiguration(null)).toBeNull();
  });

  it("NOx-n und SOx-n (Excel S10–S15)", () => {
    const nox = noxMicro(20, 520, 25)!;
    expect(nox.targetN).toBe(3);
    expect(nox.n).toBe(3);
    expect(nox.label).toBe("Mikro = 3x3 Zellen");
    // AV-NOx < 25 erhöht um 1
    expect(noxMicro(20, 520, 24)!.n).toBe(4);
    // Länge kleiner als erwartete Länge erhöht um 1
    expect(noxMicro(20, 150, 25)!.n).toBe(4);

    const sox = soxMicro(20, 520, 10)!;
    expect(sox.n).toBe(4);
    expect(soxMicro(20, 520, 9)!.n).toBe(5);
    expect(soxMicro(20, 200, 10)!.n).toBe(5);
  });

  it("Toleranzen (Excel I4/C6/R19)", () => {
    expect(lengthTolerance(1)).toBe("(+3/-3) [mm]");
    expect(lengthTolerance(2)).toBe("(+0/-3) [mm]");
    expect(diameterTolerance(1)).toBe("(+/-2) [mm]");
    expect(diameterTolerance(2)).toBe("(+2/-2) [mm]");
    expect(innerWallTolerance(20)).toBe("(+0/-0,1) [mm]");
    expect(innerWallTolerance(30)).toBe("(+0/-0,05) [mm]");
  });

  it("Laborprüfumfang (Excel A10/O21–O23)", () => {
    expect(labScope({ soxRequired: false, deliveryVolumeM3: 8.47, cells: 20 }).text)
      .toBe("Geo, NOx, BET, PV, DP, A, CA");
    expect(labScope({ soxRequired: true, deliveryVolumeM3: 8.47, cells: 20 }).text)
      .toBe("Geo, NOx, SOx, BET, PV, DP, A, CA");
    const big = labScope({ soxRequired: true, deliveryVolumeM3: 25, cells: 20 });
    expect(big.text).toBe("Geo, NOx, BET, PV, DP, A, CA");
    expect(big.soxDroppedByVolume).toBe(true);
    expect(labScope({ soxRequired: true, deliveryVolumeM3: 8, cells: 40 }).text)
      .toBe("Geo, NOx, SOx, BET, PV, DP, CA");
  });
});
