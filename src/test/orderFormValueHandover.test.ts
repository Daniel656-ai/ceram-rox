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

describe("Feldtypabhängige Übergabe (führende Nullen)", () => {
  const t = (raw: unknown, field_type?: string) => build(raw, "f", field_type ? { field_type } : undefined);
  it.each(["014", "1011", "TE014"])("Textfeld behält %s als Text", (v) => {
    expect(t(v, "text")).toMatchObject({ value: null, remarks: v });
    expect(t(v, "select")).toMatchObject({ value: null, remarks: v });
  });
  it("Zahl-/Dezimal-/Prozentfelder bleiben numerisch", () => {
    expect(t("014", "number")?.value).toBe(14);
    expect(t("25,5", "decimal")?.value).toBe(25.5);
    expect(t("12", "percent")?.value).toBe(12);
    expect(t(7, "text")?.value).toBe(7);
  });
  it("leere Werte bleiben ausgelassen", () => {
    expect(t("", "text")).toBeNull();
    expect(t(null, "number")).toBeNull();
  });
  it("Wahr/Falsch, Listen und Objekte unverändert", () => {
    expect(t(false, "text")?.remarks).toBe("false");
    expect(t([{ ms: "014" }], "repeater")?.remarks).toBe('[{"ms":"014"}]');
    expect(t({ a: "014" }, "text")?.remarks).toBe('{"a":"014"}');
  });
  it("unbekannter oder fehlender Feldtyp: bisheriges Verhalten", () => {
    expect(t("014")?.value).toBe(14);
    expect(t("014", "computed")?.value).toBe(14);
  });
});
