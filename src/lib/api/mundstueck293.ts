import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import {
  planMundstueck293, bookedCases, countBrenntemperaturen,
  MS_AUSWAHL_KEY, MUNDSTUECK_MS_KEY, BRENNEN_KEY, EXTRUSION_SERVICE_NAME,
} from "@/lib/rules/mundstueck293";

/**
 * Wendet die Regel „Mundstück 293/1“ auf einen gespeicherten Auftrag an.
 * Läuft nur bei Ereignissen (Auftrag speichern, Formular speichern,
 * Leistung nachträglich buchen/löschen) – nie als Massen-Nachbearbeitung.
 * Formularwerte liegen als `measurement_results.result_name = form:<Formular>:<Feld>`.
 */
const parse = (r: any): unknown => {
  if (!r) return undefined;
  if (r.remarks == null) return r.value ?? undefined;
  try { return JSON.parse(r.remarks); } catch { return r.remarks; }
};

export interface Mundstueck293Change { measurementId: string; key: string; value: unknown }

export const mundstueck293 = {
  syncOrder: async (orderId: string): Promise<{ changes: Mundstueck293Change[]; orphaned: number }> => {
    const ms = (await unwrap(
      dbClient
        .from("order_measurements")
        .select("id, measurement_services(service_name), measurement_results(id, result_name, value, remarks, display_label)")
        .eq("order_id", orderId)
    )) as any[];
    const out = { changes: [] as Mundstueck293Change[], orphaned: 0 };
    if (!ms?.length) return out;

    const cases = bookedCases(ms.map((m) => m.measurement_services?.service_name));
    const suffix = (k: string) => (name: string) => typeof name === "string" && name.startsWith("form:") && name.endsWith(`:${k}`);

    // Brennen: zuerst dieselbe Messung, sonst irgendeine Messung des Auftrags mit demselben Formular.
    const brennenByForm = new Map<string, unknown>();
    for (const m of ms) for (const r of m.measurement_results ?? []) {
      if (suffix(BRENNEN_KEY)(r.result_name)) {
        const fid = r.result_name.split(":")[1];
        if (!brennenByForm.has(fid)) brennenByForm.set(fid, parse(r));
      }
    }

    for (const m of ms) {
      // Regel nur auf Extrusions-Aufgaben anwenden; andere Leistungen bleiben unberührt.
      if (m.measurement_services?.service_name !== EXTRUSION_SERVICE_NAME) continue;
      const results: any[] = m.measurement_results ?? [];
      for (const auswahlRow of results.filter((r) => suffix(MS_AUSWAHL_KEY)(r.result_name))) {
        const fid = auswahlRow.result_name.split(":")[1];
        const auswahl = parse(auswahlRow);
        if (auswahl != null && !Array.isArray(auswahl)) continue; // unerwartetes Format: nicht anfassen
        const msKey = `form:${fid}:${MUNDSTUECK_MS_KEY}`;
        const msRow = results.find((r) => r.result_name === msKey);
        const mundstueck = parse(msRow);
        if (mundstueck != null && !Array.isArray(mundstueck)) continue;
        const brennRow = results.find((r) => r.result_name === `form:${fid}:${BRENNEN_KEY}`);
        const brennen = brennRow ? parse(brennRow) : brennenByForm.get(fid);

        const plan = planMundstueck293({
          ...cases, brennCount: countBrenntemperaturen(brennen), msAuswahl: auswahl, mundstueckMs: mundstueck,
        });
        out.orphaned += plan.orphaned;
        if (!plan.changedAuswahl) continue;

        await run(dbClient.from("measurement_results").update({ remarks: JSON.stringify(plan.msAuswahl), value: null } as any).eq("id", auswahlRow.id));
        out.changes.push({ measurementId: m.id, key: auswahlRow.result_name, value: plan.msAuswahl });
        if (plan.changedMundstueck) {
          const remarks = JSON.stringify(plan.mundstueckMs);
          if (msRow) await run(dbClient.from("measurement_results").update({ remarks, value: null } as any).eq("id", msRow.id));
          else await unwrap(dbClient.from("measurement_results").insert({
            order_measurement_id: m.id, result_name: msKey, display_label: "Mundstück MS", remarks, is_official: false,
          } as any).select("id").single());
          out.changes.push({ measurementId: m.id, key: msKey, value: plan.mundstueckMs });
        }
      }
    }
    return out;
  },
};
