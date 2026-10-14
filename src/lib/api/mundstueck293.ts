import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import {
  planMundstueck293, bookedFlags, countBrennen,
  MS_AUSWAHL_KEY, MUNDSTUECK_KEY, BRENNEN_KEY,
} from "@/lib/rules/mundstueck293";

const parse = (s: string | null | undefined): any[] => {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
};

/**
 * Gleicht das automatische Mundstück 293/1 eines Auftrags ab (idempotent).
 * Läuft nur bei Auslösern (Speichern, Leistung gebucht/entfernt) – keine
 * Nachbearbeitung bestehender Aufträge. Schreibt ausschließlich die bereits
 * vorhandenen Formularwerte (`form:<Formular>:ms_auswahl_1` / `mundstueck_ms_1`).
 */
export async function syncMundstueck293(orderId: string) {
  const ms = (await unwrap(
    dbClient
      .from("order_measurements")
      .select("id, measurement_services(service_name), measurement_results(id, result_name, remarks)")
      .eq("order_id", orderId)
  )) as any[];
  if (!ms?.length) return { changed: false };

  const booked = bookedFlags(ms.map((m) => m.measurement_services?.service_name));
  const results = ms.flatMap((m) =>
    (m.measurement_results ?? []).map((r: any) => ({ ...r, order_measurement_id: m.id }))
  );
  const msRow = results.find((r) => r.result_name?.startsWith("form:") && r.result_name.endsWith(`:${MS_AUSWAHL_KEY}`));
  if (!msRow) return { changed: false }; // kein Extrusionsformular erfasst
  const prefix = msRow.result_name.slice(0, -MS_AUSWAHL_KEY.length);
  const mundRow = results.find((r) => r.result_name === prefix + MUNDSTUECK_KEY);
  const brennenRow = results.find((r) => r.result_name === prefix + BRENNEN_KEY);

  const plan = planMundstueck293({
    msAuswahl: parse(msRow.remarks),
    mundstueck: parse(mundRow?.remarks),
    brennenCount: countBrennen(parse(brennenRow?.remarks)),
    booked,
  });
  if (!plan.changed) return { changed: false };

  await run(dbClient.from("measurement_results").update({ remarks: JSON.stringify(plan.msAuswahl) } as any).eq("id", msRow.id));
  if (mundRow) {
    await run(dbClient.from("measurement_results").update({ remarks: JSON.stringify(plan.mundstueck) } as any).eq("id", mundRow.id));
  } else if (plan.mundstueck.length) {
    await run(dbClient.from("measurement_results").insert({
      order_measurement_id: msRow.order_measurement_id,
      result_name: prefix + MUNDSTUECK_KEY,
      display_label: MUNDSTUECK_KEY,
      is_official: false,
      value: null,
      remarks: JSON.stringify(plan.mundstueck),
    } as any));
  }
  return { changed: true };
}
