import { describe, expect, it } from "vitest";
import { resolveOrderMasseType, orderMasseTypeFilterValues, type OrderMasseTypeSource } from "@/lib/orders/orderMasseType";
import { orderFilterColumns, type OrderFilterRow } from "@/lib/orders/orderFilterColumns";
import { processRows } from "@/components/data-table/dataTableUtils";
import { SAMPLE_CATEGORIES, EMPTY_SAMPLE_PARAMETERS, sampleParametersToPayload } from "@/lib/sampleParameters";

const labor = (...categories: Array<string | null>): OrderMasseTypeSource => ({
  id: "order", order_kind: "labor", order_samples: categories.map((category, index) => ({
    sample_id: `s${index}`, samples: { id: `s${index}`, sample_name: null, sample_number: null, category },
  })),
});
const pp = (fields: Partial<OrderMasseTypeSource>): OrderMasseTypeSource => ({ id: "pp", order_kind: "pilot_plant", ...fields });

describe("read-only order mass types", () => {
  it.each([
    ["dieselkatalysator", "DK"], ["stationaerer_katalysator", "SK"],
    ["stationaerer_katalysator_gk", "GK"], ["stationaerer_katalysator_kk", "KK"],
    ["plattenkatalysator", "PK"], ["heat_media", "Heat Media"],
    ["marinekatalysator", "MK"], ["oxidationskatalysator", "OK"],
  ])("maps %s to %s without rewriting samples", (category, type) => {
    const order = labor(category);
    const original = JSON.stringify(order);
    expect(resolveOrderMasseType(order)).toEqual([type]);
    expect(JSON.stringify(order)).toBe(original);
  });
  it.each(["DK", "SK", "GK", "KK", "PK", "Heat Media", "MK", "OK"])("supports explicit short form %s", type => {
    expect(resolveOrderMasseType(labor(type))).toEqual([type]);
  });
  it("retains historic SK without guessing GK or KK", () => {
    expect(resolveOrderMasseType(labor("stationaerer_katalysator"))).toEqual(["SK"]);
  });
  it("deduplicates equal types across distinct samples", () => expect(resolveOrderMasseType(labor("DK", "dieselkatalysator"))).toEqual(["DK"]));
  it("keeps multiple distinct types in a stable display order", () => expect(resolveOrderMasseType(labor("PK", "DK", "PK"))).toEqual(["DK", "PK"]));
  it("only reads hydrated current-order sample relations", () => {
    expect(resolveOrderMasseType({ id: "o", order_kind: "labor", sample_id: "own", current_sample: { id: "foreign", sample_name: null, sample_number: null, category: "GK" } })).toEqual([]);
  });
  it("uses the column before all form values", () => {
    expect(resolveOrderMasseType(pp({ pp_masse_type: "GK", shared_form_data: { template: { values: { massetyp: "DK", masse_type: "KK" } }, pp: { stammdaten: { massetyp: "PK" } } } }))).toEqual(["GK"]);
  });
  it("uses massetyp before masse_type and legacy values", () => {
    expect(resolveOrderMasseType(pp({ shared_form_data: { template: { values: { massetyp: "Heat Media", masse_type: "DK" } }, pp: { stammdaten: { masse_type: "GK" } } } }))).toEqual(["Heat Media"]);
  });
  it("uses masse_type before legacy values", () => {
    expect(resolveOrderMasseType(pp({ shared_form_data: { template: { values: { masse_type: "KK" } }, pp: { stammdaten: { masse_type: "DK" } } } }))).toEqual(["KK"]);
  });
  it.each(["massetyp", "masse_type"])("reads the historic %s field", key => {
    expect(resolveOrderMasseType(pp({ shared_form_data: { pp: { stammdaten: { [key]: "MK" } } } }))).toEqual(["MK"]);
  });
  it("skips invalid higher-priority values for a known lower-priority source", () => {
    expect(resolveOrderMasseType(pp({ pp_masse_type: "unknown", shared_form_data: { template: { values: { massetyp: "", masse_type: "DK" } } } }))).toEqual(["DK"]);
  });
  it.each([null, "", "unknown"])("returns no type for missing or unknown %s", value => {
    expect(resolveOrderMasseType(labor(value))).toEqual([]);
    expect(resolveOrderMasseType(pp({ pp_masse_type: value, shared_form_data: [] }))).toEqual([]);
  });
  it("does not use PP fields for Labor or sample categories as a PP fallback", () => {
    expect(resolveOrderMasseType({ ...labor("DK"), pp_masse_type: "GK" })).toEqual(["DK"]);
    expect(resolveOrderMasseType({ ...labor("DK"), order_kind: "pilot_plant" })).toEqual([]);
  });
  it("uses central legacy classification", () => {
    expect(resolveOrderMasseType(pp({ order_kind: "legacy", pp_masse_type: "GK", order_measurements: [{ measurement_services: { category: "pilot_plant" } }] }))).toEqual(["GK"]);
  });
  it.each(["stationaerer_katalysator_gk", "stationaerer_katalysator_kk"])("adds %s without changing the category payload", category => {
    expect(SAMPLE_CATEGORIES).toContain(category);
    expect(SAMPLE_CATEGORIES).toContain("stationaerer_katalysator");
    expect(sampleParametersToPayload({ ...EMPTY_SAMPLE_PARAMETERS, category }).category).toBe(category);
  });
});

describe("mass-type filters and search use the existing table engine", () => {
  const rows: OrderFilterRow[] = [
    { ...labor("GK"), id: "gk", status: "open", created_by: "me", order_type: "rnd" },
    { ...labor("KK"), id: "kk", status: "completed" },
    { ...labor("stationaerer_katalysator"), id: "sk", status: "open" },
    { ...labor("DK", "PK"), id: "mixed", status: "open" },
  ];
  const columns = orderFilterColumns(rows, [], "me", key => key);
  const select = (values: string[]) => processRows(rows, columns, "", { mass_type: { kind: "status", values } }, null).map(o => o.id);
  it.each([["GK", ["gk"]], ["KK", ["kk"]], ["SK", ["sk"]], ["DK", ["mixed"]], ["PK", ["mixed"]], ["stationaerer_katalysator", ["gk", "kk", "sk"]]] as const)("filters %s independently", (value, ids) => expect(select([value])).toEqual(ids));
  it("retains individual and group tokens", () => {
    expect(orderMasseTypeFilterValues(labor("GK"))).toEqual(["GK", "stationaerer_katalysator"]);
    expect(orderMasseTypeFilterValues(labor("KK"))).toEqual(["KK", "stationaerer_katalysator"]);
    expect(orderMasseTypeFilterValues(labor("stationaerer_katalysator"))).toEqual(["SK", "stationaerer_katalysator"]);
  });
  it.each([["gk", ["gk"]], ["kk", ["kk"]], ["dk", ["mixed"]]] as const)("searches %s case-insensitively", (q, ids) => expect(processRows(rows, columns, q, {}, null).map(o => o.id)).toEqual(ids));
  it("combines mass type with existing status, requester, type and mine filters", () => {
    expect(processRows(rows, columns, "gk", {
      mass_type: { kind: "status", values: ["stationaerer_katalysator"] },
      status: { kind: "status", values: ["open"] }, requester: { kind: "status", values: ["me"] },
      type: { kind: "status", values: ["rnd"] }, mine: { kind: "status", values: ["created"] },
    }, null).map(o => o.id)).toEqual(["gk"]);
  });
  it("empty selection keeps all readable orders", () => expect(select([])).toEqual(["gk", "kk", "sk", "mixed"]));
});