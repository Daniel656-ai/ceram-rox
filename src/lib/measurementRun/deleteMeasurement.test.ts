import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canSubmitDelete, deleteErrorText, describeSideEffects, BLOCKER_LABELS } from "./deleteMeasurement";

const sql = readFileSync(resolve(__dirname, "../../../drizzle/migrations/0020_delete_order_measurement.sql"), "utf8");
const deleteFn = sql.slice(sql.indexOf("FUNCTION public.delete_order_measurement"));

describe("Löschen einzelner Dienstleistungen – Anzeige-Regeln", () => {
  it("Begründungspflicht ≥ 5 Zeichen und nur bei erlaubter Löschung", () => {
    expect(canSubmitDelete(true, "abcd")).toBe(false);
    expect(canSubmitDelete(true, "   abcd   ")).toBe(false);
    expect(canSubmitDelete(true, "abcde")).toBe(true);
    expect(canSubmitDelete(false, "lange Begründung")).toBe(false);
  });
  it("übersetzt Serverablehnungen verständlich", () => {
    expect(deleteErrorText("not permitted")).toMatch(/nur Admin/);
    expect(deleteErrorText("reason too short")).toMatch(/5 Zeichen/);
    expect(deleteErrorText("Auftrag ist abgeschlossen und schreibgeschützt")).toMatch(/gesperrt/);
    expect(deleteErrorText("delete blocked: results,work_logs")).toMatch(/Ergebnisse.*Arbeitszeit/);
    expect(deleteErrorText("")).toMatch(/nichts verändert/);
  });
  it("zeigt alle automatischen Entkopplungen vor Bestätigung", () => {
    const e = describeSideEffects({ parameters: 2, prepared_samples: 1, replacement_measurements: 1, knetung_materials: 3, history_entries: 4 });
    expect(e).toHaveLength(5);
    expect(e.join(" ")).toMatch(/Teilprobe/);
    expect(e.join(" ")).toMatch(/Ersatzmessung/);
    expect(e.join(" ")).toMatch(/Knetung/);
    expect(describeSideEffects({})).toEqual([]);
  });
  it("hat Texte für sämtliche Löschblockaden", () => {
    for (const k of ["order_locked", "status_not_open", "results", "raw_data", "corrections", "work_logs", "documents", "uploads"]) {
      expect(BLOCKER_LABELS[k]).toBeTruthy();
      expect(sql).toContain(`'${k}'`);
    }
  });
});

describe("Migration 0020 – serverseitige Sicherheitsregeln", () => {
  it("prüft Admin (master) serverseitig in Vorschau und Löschung", () => {
    expect(sql.match(/has_role\(auth\.uid\(\), 'master'::app_role\)|has_role\(_uid, 'master'::app_role\)/g)!.length).toBeGreaterThanOrEqual(2);
  });
  it("vergibt keine Tabellen-Löschrechte und keine Policy", () => {
    expect(sql).not.toMatch(/CREATE POLICY|GRANT\s+DELETE|ALTER TABLE/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\._order_measurement_delete_facts\(uuid\) FROM PUBLIC, anon, authenticated/);
  });
  it("erzwingt Begründung, Sperren, Status und Auftragssperre", () => {
    expect(deleteFn).toMatch(/length\(btrim\(_reason\)\) < 5/);
    expect(deleteFn).toMatch(/measurement_orders WHERE id = _order_id FOR UPDATE/);
    expect(deleteFn).toMatch(/order_measurements WHERE id = _measurement_id FOR UPDATE/);
    expect(sql).toMatch(/status::text <> 'open'/);
    expect(sql).toMatch(/is_order_locked/);
  });
  it("schreibt Audit vor dem Löschen ohne Aufgabenbezug, mit Pflichtangaben", () => {
    const ins = deleteFn.indexOf("'measurement_deleted'");
    const del = deleteFn.indexOf("DELETE FROM public.order_measurements");
    expect(ins).toBeGreaterThan(0);
    expect(del).toBeGreaterThan(ins);
    for (const k of ["order_number", "measurement_number", "service_name", "reason", "deleted_at"]) expect(deleteFn).toContain(`'${k}'`);
    expect(deleteFn).toMatch(/_uid, _order_id, NULL/);
    expect(deleteFn).toMatch(/SET order_measurement_id = NULL/);
  });
  it("Rollback: Blockade bricht vor jeder Änderung mit Fehler ab (eine Transaktion)", () => {
    const raise = deleteFn.indexOf("RAISE EXCEPTION 'delete blocked");
    expect(raise).toBeGreaterThan(0);
    expect(raise).toBeLessThan(deleteFn.indexOf("UPDATE public.activity_log"));
    expect(deleteFn).not.toMatch(/COMMIT|EXCEPTION WHEN/);
  });
  it("Auftragsstatus wird über den bestehenden Trigger aktualisiert (keine Eigenlogik)", () => {
    expect(deleteFn).not.toMatch(/UPDATE public\.measurement_orders/);
  });
});
