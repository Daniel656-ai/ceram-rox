import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aufgabe 023: Abgleich mit Lovable (Prod). Es gibt hier keine echte Datenbank; geprüft wird, dass die Migrationen
 * die zugesagten Schutzregeln enthalten (Text), damit sie nicht versehentlich verloren gehen.
 */
const lese = (datei: string) => readFileSync(resolve(__dirname, "../../drizzle/migrations", datei), "utf8");

describe("0038 – Abgleich mit Lovable", () => {
  const sql = lese("0038_m3_list_delete.sql");

  it("entfernt vorhandene INSERT/UPDATE-Regeln, bevor sie neu angelegt werden", () => {
    for (const art of ["insert", "update"]) {
      const regel = `"Authenticated ${art} production_document_requests"`;
      const drop = sql.indexOf(`DROP POLICY IF EXISTS ${regel}`);
      const create = sql.indexOf(`CREATE POLICY ${regel}`);
      expect(drop, `DROP POLICY IF EXISTS für ${art}`).toBeGreaterThan(-1);
      expect(create).toBeGreaterThan(drop);
    }
  });
});

describe("0048 – Lovable-Trigger entfernen, Funktionen sperren", () => {
  const sql = lese("0048_lovable_abgleich_sperren.sql");

  it("entfernt beide Lovable-Trigger", () => {
    expect(sql).toContain("DROP TRIGGER IF EXISTS trg_guard_requester_order_edit ON public.measurement_orders");
    expect(sql).toContain("DROP TRIGGER IF EXISTS trg_guard_requester_param_edit ON public.measurement_parameters");
  });

  it("sperrt genau die drei Lovable-Funktionen und löscht keine", () => {
    for (const sig of [
      "public.force_delete_order(uuid,text)",
      "public.delete_m3_list(uuid,text)",
      "public.requester_remove_order_measurement(uuid,text)",
    ]) expect(sql).toContain(`'${sig}'`);
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
    expect(sql).not.toMatch(/DROP FUNCTION/i);
  });

  it("vermerkt: in Prod nur gemeinsam mit 0049, neuer Oberfläche und Freigabe", () => {
    expect(sql).toMatch(/NUR 0048 UND 0049 GEMEINSAM/);
    expect(sql).toMatch(/Stefan/);
  });
});

describe("0049 – Schutz begonnener Aufträge per Policy", () => {
  const sql = lese("0049_order_edit_policies.sql");

  it("legt fünf einschränkende Policies an", () => {
    const anzahl = (sql.match(/CREATE POLICY order_edit_restrict_\w+ ON [\w.]+ AS RESTRICTIVE/g) ?? []).length;
    expect(anzahl).toBe(5);
  });

  it("lässt Master immer und unsere Bearbeiten-Funktionen über den Schalter durch", () => {
    const policies = sql.split("CREATE POLICY").slice(1);
    for (const p of policies) {
      expect(p).toContain("has_role(auth.uid(), 'master'");
      expect(p).toContain("current_setting('app.order_edit', true)");
    }
  });

  const normal = (t: string) => t.replace(/\r\n/g, "\n");
  /** Funktionstext apply_order_changes (von CREATE OR REPLACE bis "END $$;") aus einer Migration. */
  const funktion = (text: string) => {
    const t = normal(text);
    const a = t.indexOf("CREATE OR REPLACE FUNCTION public.apply_order_changes(");
    const e = t.indexOf("END $$;", a);
    return t.slice(a, e + "END $$;".length).split("\n");
  };

  it("setzt den Schalter per set_config als erste Anweisung von apply_order_changes (kein ALTER FUNCTION SET, das Supabase ablehnt)", () => {
    const zeilen = funktion(sql);
    const begin = zeilen.indexOf("BEGIN");
    expect(begin).toBeGreaterThan(-1);
    expect(zeilen[begin + 1]).toMatch(/^ {2}PERFORM set_config\('app\.order_edit', 'on', true\);/);
    expect(sql).not.toMatch(/^ALTER FUNCTION[^;]*SET\s+app\.order_edit/im);
  });

  it("apply_order_changes ist Zeile für Zeile die Fassung aus 0042 – nur die Schalter-Zeile kommt hinzu", () => {
    const alt = funktion(lese("0042_order_edit_remove_services.sql"));
    const neu = funktion(sql).filter((z) => !z.includes("PERFORM set_config('app.order_edit'"));
    expect(neu).toEqual(alt);
  });

  it("lässt order_edit_remove_services unverändert (SECURITY DEFINER, Besitzer umgeht die Policies)", () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.order_edit_remove_services/);
    expect(sql).not.toMatch(/ALTER FUNCTION public\.order_edit_remove_services/);
  });

  it("prüft den Schalter in der Selbstprüfung auch bei Windows-Zeilenenden (\\r\\n)", () => {
    expect(sql).toContain("BEGIN\\r?\\n\\s*PERFORM set_config");
  });

  it("behält Rechte von apply_order_changes (nur angemeldete Benutzer)", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.apply_order_changes(uuid, jsonb, text) FROM PUBLIC, anon;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.apply_order_changes(uuid, jsonb, text) TO authenticated;");
  });

  it("macht den Schalter nur transaktionslokal (dritter Parameter true)", () => {
    const aufrufe = sql.match(/set_config\('app\.order_edit',[^)]*\)/g) ?? [];
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const a of aufrufe) expect(a).toMatch(/, true\)$/);
  });

  it("setzt app.order_edit in keiner anderen Migration und gibt keine Funktion, die den Namen als Parameter nimmt", () => {
    const dir = resolve(__dirname, "../../drizzle/migrations");
    const andere = readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.startsWith("0049_"));
    for (const f of andere) {
      expect(readFileSync(resolve(dir, f), "utf8"), f).not.toMatch(/app\.order_edit/);
    }
    const supa = resolve(__dirname, "../../supabase/migrations");
    for (const f of readdirSync(supa).filter((x) => x.endsWith(".sql"))) {
      expect(readFileSync(resolve(supa, f), "utf8"), f).not.toMatch(/app\.order_edit/);
    }
    // Nur feste Namen: kein set_config mit Variable als erstem Argument in 0049
    expect(sql).not.toMatch(/set_config\(\s*[_a-z]/i);
  });

  it("gibt die Hilfsfunktionen nicht an anon", () => {
    for (const f of ["order_is_started", "order_measurement_is_untouched", "order_sync_primary_sample"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\(uuid\\) FROM PUBLIC, anon;`));
    }
  });

  it("vermerkt: in Prod nur gemeinsam mit 0048, neuer Oberfläche und Freigabe", () => {
    expect(sql).toMatch(/NUR 0048 UND 0049 GEMEINSAM/);
    expect(sql).toMatch(/Stefan/);
  });
});

describe("Migrationsliste", () => {
  it("führt 0048 und 0049 im Journal", () => {
    const journal = readFileSync(resolve(__dirname, "../../drizzle/migrations/meta/_journal.json"), "utf8");
    expect(journal).toContain("0048_lovable_abgleich_sperren");
    expect(journal).toContain("0049_order_edit_policies");
  });
});
