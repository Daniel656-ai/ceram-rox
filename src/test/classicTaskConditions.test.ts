import { describe, expect, it } from "vitest";
import { resolveRequesterConditions } from "@/lib/results/requesterConditions";
import type { ClassicTaskSource } from "@/lib/results/classicTaskConditions";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const result: ResultRecord["outputResults"][number] = { id: "r", result_name: "eta", value: 12, unit: "%", temperature_range_from: null, temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: null, is_official: true, instance_key: null, instance_context: {} };
const source = (): ClassicTaskSource => ({ measurementId: "m1", orderId: "o1", sampleId: "s1", serviceId: "svc", structureChecked: true, repeatedStructure: false,
  results: [{ id: "r", result_name: "eta", instance_key: null, instance_label: null, remarks: null }],
  parameters: [{ id: "p1", order_measurement_id: "m1", parameter_name: "AV", parameter_value: "0.000", unit: "h⁻¹" }] });
const record = () => ({ measurementId: "m1", orderId: "o1", sampleId: "s1", serviceId: "svc", instanceKey: null, outputResults: [result], classicTaskSource: source() });

describe("classic single-task specifications, never a historical snapshot", () => {
  it("shows exactly stored single-run names, zero precision and units under a separate source", () => {
    const resolved = resolveRequesterConditions(record());
    expect(resolved.status).toBe("task_parameters");
    expect(resolved.sources).toEqual(["measurement_parameters"]);
    expect(resolved.entries).toEqual([{ id: "p1", key: "AV", value: "0.000", unit: "h⁻¹" }]);
  });
  it("rejects a second nonofficial instance in the complete result read", () => {
    const r = record(); r.classicTaskSource.results.push({ id: "hidden", result_name: "eta", instance_key: "second", instance_label: null, remarks: null });
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("does not mix tasks of the same sample", () => {
    const r = record(); r.classicTaskSource.measurementId = "m2";
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("does not mix samples of the same order", () => {
    const r = record(); r.classicTaskSource.sampleId = "s2";
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("rejects parameters belonging to another task", () => {
    const r = record(); r.classicTaskSource.parameters[0].order_measurement_id = "m2";
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("does not mix orders or services", () => {
    const r = record(); r.classicTaskSource.orderId = "o2";
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
    r.classicTaskSource.orderId = "o1"; r.classicTaskSource.serviceId = "other";
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("keeps unavailable when no stored parameters exist", () => {
    const r = record(); r.classicTaskSource.parameters = [];
    expect(resolveRequesterConditions(r).reason).toBe("no_binding");
  });
  it("preserves an exact repeater context and never mixes task parameters into it", () => {
    const r = { ...record(), instanceKey: "stable", outputResults: [{ ...result, instance_key: "stable", instance_context: { T: "300 °C" } }] };
    expect(resolveRequesterConditions(r)).toMatchObject({ status: "assigned", sources: ["result_context"], entries: [{ key: "T", value: "300 °C" }] });
  });
  it("does not fall back after a conflicting instance context", () => {
    const r = { ...record(), outputResults: [{ ...result, instance_context: { T: "300" } }, { ...result, id: "r2", instance_context: { T: "400" } }] };
    expect(resolveRequesterConditions(r).reason).toBe("inconsistent_results");
  });
  it.each(["stable", "idx_1"])("rejects keyed instance %s without context", key => {
    expect(resolveRequesterConditions({ ...record(), instanceKey: key }).status).toBe("unavailable");
  });
  it("rejects nested or repeatable structure even when only one official result exists", () => {
    const r = record(); r.classicTaskSource.repeatedStructure = true;
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("fails closed when structure metadata could not be read", () => {
    const r = record(); r.classicTaskSource.structureChecked = false;
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("rejects JSON run data without guessing positions", () => {
    const r = record(); r.classicTaskSource.results[0].remarks = '[{"T":300},{"T":400}]';
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
  it("rejects contradictory instance identity on an output row", () => {
    const r = record(); r.outputResults = [{ ...result, instance_key: "foreign" }];
    expect(resolveRequesterConditions(r).status).toBe("unavailable");
  });
});