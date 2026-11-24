import { describe, it, expect } from "vitest";
import { analyzeM3Retrofit } from "../retrofit";

const ART = "0020-6047-125-0998";
const rows = (els: string[]) => els.map((e) => ({ element_number: e }));
const none = { status: "none", rowIndices: [] } as any;
const base = { orderId: "o1", orderStatus: "open", articleNumber: ART, marking: none, linkedSamples: [], samplesByNumber: [], measurements: [] };

describe("m³ sample retrofit analysis", () => {
  it("proposes all samples for an order without samples", () => {
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010", "00020"]) });
    expect(r.status).toBe("possible");
    expect(r.plan.samples.map((s) => s.sample_number)).toEqual(["0020-6047-00010", "0020-6047-00020"]);
  });

  it("proposes only the missing sample when some exist", () => {
    const linked = [{ id: "a", sample_number: "0020-6047-00010", order_id: "o1" }, { id: "c", sample_number: "0020-6047-00030", order_id: "o1" }];
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010", "00020", "00030"]), linkedSamples: linked, samplesByNumber: linked });
    expect(r.plan.samples.map((s) => s.sample_number)).toEqual(["0020-6047-00020"]);
  });

  it("needs no change when all samples exist", () => {
    const linked = [{ id: "a", sample_number: "0020-6047-00010", order_id: "o1" }];
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010"]), linkedSamples: linked, samplesByNumber: linked });
    expect(r.status).toBe("complete");
  });

  it("only marked TEST rows when marked", () => {
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010", "00020"]), marking: { status: "ok", rowIndices: [1] } as any });
    expect(r.plan.samples.map((s) => s.sample_number)).toEqual(["0020-6047-00020"]);
  });

  it("assigns the single open unassigned task to the single sample", () => {
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010"]), measurements: [{ id: "m1", service_id: "s1", sample_id: null, status: "open" }] });
    expect(r.plan.assignments).toEqual([{ measurement_id: "m1", sample_number: "0020-6047-00010" }]);
  });

  it("does not guess when one unassigned task meets several samples", () => {
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010", "00020"]), measurements: [{ id: "m1", service_id: "s1", sample_id: null, status: "open" }] });
    expect(r.status).toBe("review");
    expect(r.plan.assignments).toEqual([]);
    expect(r.plan.samples).toEqual([]);
  });

  it("never reassigns a completed task or one with results", () => {
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010"]), measurements: [{ id: "m1", service_id: "s1", sample_id: null, status: "completed", has_results: true }] });
    expect(r.status).toBe("review");
  });

  it("flags unclear history (unreadable rows / foreign sample) instead of linking", () => {
    expect(analyzeM3Retrofit({ ...base, rows: [] }).status).toBe("review");
    const foreign = [{ id: "x", sample_number: "0020-6047-00010", order_id: "other" }];
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010"]), samplesByNumber: foreign });
    expect(r.status).toBe("review");
    expect(r.plan.links).toEqual([]);
  });

  it("is idempotent: after retrofit the same order is complete", () => {
    const linked = [{ id: "a", sample_number: "0020-6047-00010", order_id: "o1" }];
    const r = analyzeM3Retrofit({ ...base, rows: rows(["00010"]), linkedSamples: linked, samplesByNumber: linked, measurements: [{ id: "m1", service_id: "s1", sample_id: "a", status: "completed", has_results: true }] });
    expect(r.status).toBe("complete");
  });
});
