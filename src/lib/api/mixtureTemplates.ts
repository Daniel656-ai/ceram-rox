import { dbClient } from "./client";
import { unwrap } from "./_helpers";

const db = dbClient as any;

export const mixtureTemplates = {
  /** Duplizieren einer kompletten Mischung (Rezeptur + Prozess), liefert neue mixture id. */
  copy: (sourceId: string, newName: string, newNumber?: string | null, asTemplate = false) =>
    unwrap<string>(
      db.rpc("copy_mixture", {
        _source_id: sourceId,
        _new_name: newName,
        _new_number: newNumber ?? null,
        _as_template: asTemplate,
      })
    ),

  /** Liefert {items, sections} mit added/removed/changed. */
  diff: (versionA: string, versionB: string) =>
    unwrap<any>(
      db.rpc("diff_recipe_versions", { _version_a: versionA, _version_b: versionB })
    ),
};
