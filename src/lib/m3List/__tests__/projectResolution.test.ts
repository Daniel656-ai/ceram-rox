import { describe, it, expect } from "vitest";
import { resolveReleaseProject } from "../projectResolution";

const projects = [
  { id: "p1", project_name: "Alpha" },
  { id: "p2", project_name: "Beta" },
  { id: "p3", project_name: "beta " },
];

describe("resolveReleaseProject", () => {
  it("nimmt project_id der Freigabe", () => {
    expect(resolveReleaseProject({ project_id: "x", project_name: "Alpha" }, projects)).toEqual({ ok: true, projectId: "x", viaName: false, reason: null });
  });
  it("findet Projekt über eindeutigen Namen", () => {
    expect(resolveReleaseProject({ project_id: null, project_name: " alpha " }, projects)).toEqual({ ok: true, projectId: "p1", viaName: true, reason: null });
  });
  it("mehrdeutiger Name: Fehler", () => {
    const r = resolveReleaseProject({ project_name: "Beta" }, projects);
    expect(r.ok).toBe(false);
  });
  it("unbekannter Name: Fehler", () => {
    expect(resolveReleaseProject({ project_name: "Gamma" }, projects).ok).toBe(false);
  });
  it("weder ID noch Name: Fehler", () => {
    expect(resolveReleaseProject({}, projects).ok).toBe(false);
    expect(resolveReleaseProject(null, projects).ok).toBe(false);
  });
});
