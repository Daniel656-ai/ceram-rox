import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const f = (t: string) => (dbClient.from as any)(t);

/**
 * Projektberichte.
 *
 * Es werden KEINE Ergebnisdaten kopiert – ein Bericht speichert ausschließlich
 * die Referenz auf bereits als „offiziell" freigegebene `measurement_results`.
 */
export const projectReports = {
  list: (projectId: string) =>
    unwrap(
      f("project_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  create: (input: {
    project_id: string;
    title: string;
    report_kind?: string;
    note?: string | null;
    created_by?: string | null;
  }) => unwrap(f("project_reports").insert(input).select().single()),

  update: (id: string, patch: { title?: string; report_kind?: string; note?: string | null }) =>
    unwrap(f("project_reports").update(patch).eq("id", id).select().single()),

  delete: (id: string) => run(f("project_reports").delete().eq("id", id)),

  /** Referenzen (Bericht → offizielles Ergebnis) aller Berichte eines Projekts. */
  listSelections: (projectId: string) =>
    unwrap(
      f("project_report_results")
        .select("id, report_id, measurement_result_id, project_reports!inner(project_id)")
        .eq("project_reports.project_id", projectId)
    ),

  /** Auswahl eines Berichts vollständig setzen (nur Referenzen). */
  async setSelection(reportId: string, resultIds: string[]) {
    await run(f("project_report_results").delete().eq("report_id", reportId));
    if (resultIds.length === 0) return;
    await run(
      f("project_report_results").insert(
        resultIds.map((measurement_result_id) => ({ report_id: reportId, measurement_result_id }))
      )
    );
  },
};
