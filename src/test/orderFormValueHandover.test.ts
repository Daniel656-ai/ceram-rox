import { describe, it, expect } from "vitest";
import { buildFormValueResultPayload } from "@/lib/orderFormValueHandover";

const build = (raw: unknown, fieldKey = "av_1", def?: any) =>
  buildFormValueResultPayload({
    measurementId: "m1",
    formId: "nox",
    fieldKey,
    raw,
    def,
    measuredBy: "u1",
  });

describe("Auftraggeberwerte → Formularwerte derselben Messung", () => {
  it("legt av_1 / av_2 unter dem bestehenden Feldschlüssel ab", () => {
    const av1 = build("25", "av_1", { display_name: "AV 1", unit: "m/h" });
    const av2 = build("40", "av_2", { display_name: "AV 2", unit: "m/h" });
    expect(av1?.result_name).toBe("form:nox:av_1");
    expect(av1?.value).toBe(25);
    expect(av1?.unit).toBe("m/h");
    expect(av2?.result_name).toBe("form:nox:av_2");
    expect(av2?.value).toBe(40);
  });

  it("akzeptiert Dezimalkomma und Zahlen", () => {
    expect(build("25,5")?.value).toBe(25.5);
    expect(build(40)?.value).toBe(40);
  });

  it("übernimmt leere Werte nicht und macht daraus nie 0", () => {
    expect(build("")).toBeNull();
    expect(build("   ")).toBeNull();
    expect(build(null)).toBeNull();
    expect(build(undefined)).toBeNull();
  });

  it("behält Texte und komplexe Werte unverändert bei", () => {
    expect(build("k. A.")?.remarks).toBe("k. A.");
    expect(build({ a: 1 })?.remarks).toBe('{"a":1}');
    expect(build(true)?.remarks).toBe("true");
  });

  it("markiert übernommene Werte nicht als offizielles Ergebnis", () => {
    expect(build("25")?.is_official).toBe(false);
  });
});
