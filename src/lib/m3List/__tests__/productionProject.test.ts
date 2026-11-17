import { describe, it, expect } from "vitest";
import { resolveProductionProject, resolveSampleProductionProject, missingSamplingReleaseData } from "../productionProject";

describe("resolveProductionProject", () => {
  it("returns null for orders without a linked release (normal PM orders unchanged)", () => {
    expect(resolveProductionProject([])).toBeNull();
    expect(resolveProductionProject(null)).toBeNull();
  });
  it("takes project and customer from the release", () => {
    expect(resolveProductionProject([{ project_name: " Miratech SCR ", customer_name: "Miratech" }]))
      .toEqual({ projectName: "Miratech SCR", customerName: "Miratech", ambiguous: false });
  });
  it("conflicting releases show nothing instead of guessing", () => {
    const r = resolveProductionProject([{ project_name: "A" }, { project_name: "B" }]);
    expect(r?.projectName).toBeNull();
    expect(r?.ambiguous).toBe(true);
  });
  it("resolves a sample via its order's release", () => {
    expect(resolveSampleProductionProject({ m3_order: { production_releases: [{ project_name: "X" }] } })?.projectName).toBe("X");
    expect(resolveSampleProductionProject({ m3_order: null })).toBeNull();
  });
});

describe("missingSamplingReleaseData", () => {
  const ok = { id: "r1", release_number: "FR-1", article_number: "0040-6129-1", project_name: "Miratech SCR" };
  it("complete release passes, customer optional, PM project_id irrelevant", () => {
    expect(missingSamplingReleaseData({ ...ok, project_id: null })).toEqual([]);
    expect(missingSamplingReleaseData({ ...ok, project_id: "pm-uuid" })).toEqual([]);
  });
  it("missing release or project name blocks creation", () => {
    expect(missingSamplingReleaseData(null)).toEqual(["Fertigungsfreigabe"]);
    expect(missingSamplingReleaseData({ ...ok, project_name: " " })).toHaveLength(1);
    expect(missingSamplingReleaseData({ ...ok, release_number: "" })).toEqual(["Freigabenummer"]);
  });
  it("article number may come from the derived m³ values", () => {
    expect(missingSamplingReleaseData({ ...ok, article_number: null }, "0040-1")).toEqual([]);
    expect(missingSamplingReleaseData({ ...ok, article_number: null })).toEqual(["Artikelnummer"]);
  });
});
