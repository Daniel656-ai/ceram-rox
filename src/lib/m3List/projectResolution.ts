export interface ProjectRef {
  id: string;
  project_name?: string | null;
}

export interface ProjectResolution {
  /** true = Projekt gefunden (projectId gesetzt), false = Grund in `reason`. */
  ok: boolean;
  projectId: string | null;
  viaName: boolean;
  reason: string | null;
}

/**
 * Projekt für den Beprobungsauftrag: bevorzugt die Verknüpfung der Fertigungsfreigabe
 * (`project_id`), sonst das Projekt mit exakt dem Namen aus `project_name`
 * (Groß-/Kleinschreibung und Leerzeichen am Rand egal). Nur bei genau einem Treffer.
 */
export function resolveReleaseProject(
  release: { project_id?: string | null; project_name?: string | null } | null | undefined,
  projects: ReadonlyArray<ProjectRef>
): ProjectResolution {
  if (release?.project_id) return { ok: true, projectId: release.project_id, viaName: false, reason: null };
  const name = release?.project_name?.trim().toLowerCase();
  if (!name) {
    return {
      ok: false,
      projectId: null,
      viaName: false,
      reason: "Der Fertigungsfreigabe ist weder ein Projekt noch ein Projektname zugeordnet.",
    };
  }
  const hits = projects.filter((p) => p.project_name?.trim().toLowerCase() === name);
  if (hits.length === 1) return { ok: true, projectId: hits[0].id, viaName: true, reason: null };
  return {
    ok: false,
    projectId: null,
    viaName: false,
    reason: hits.length
      ? `Der Projektname „${release?.project_name?.trim()}“ der Fertigungsfreigabe ist nicht eindeutig (${hits.length} Projekte).`
      : `Zum Projektnamen „${release?.project_name?.trim()}“ der Fertigungsfreigabe gibt es kein Projekt.`,
  };
}
