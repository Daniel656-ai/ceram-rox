import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { ServiceRule } from "./serviceRules";
import {
  planRuleTriggers, ruleStepKey, isRuleStepKey,
  type TriggerSource, type TriggerExisting,
} from "@/lib/ruleEvaluation";

/**
 * Regel-Aktion „Dienstleistung auslösen“ für gespeicherte Aufträge.
 *
 * Ausgelöste Positionen sind normale Aufgaben (`order_measurements`) mit
 * origin "workflow", `source_measurement_id` = auslösende Position und
 * `source_step_key` = "rule:<Regel-ID>". Keine neue Struktur.
 */
export const ruleTriggers = {
  /** Aktive Regeln je Dienstleistung. */
  rulesByService: async (serviceIds: string[]): Promise<Record<string, ServiceRule[]>> => {
    if (serviceIds.length === 0) return {};
    const rows = (await unwrap(
      dbClient.from("service_rules" as any).select("service_id, definition").in("service_id", serviceIds)
    )) as any[];
    const out: Record<string, ServiceRule[]> = {};
    for (const r of rows ?? []) out[r.service_id] = (r.definition?.rules ?? []) as ServiceRule[];
    return out;
  },

  /** Gibt es im Auftrag bereits eine Position dieser Dienstleistung für diese Probe? */
  exists: async (orderId: string, serviceId: string, sampleId: string | null) => {
    let q = dbClient.from("order_measurements").select("id").eq("order_id", orderId).eq("service_id", serviceId);
    q = sampleId ? q.eq("sample_id", sampleId) : q.is("sample_id", null);
    const rows = (await unwrap(q.limit(1))) as any[];
    return (rows ?? []).length > 0;
  },

  /**
   * Gleicht die ausgelösten Positionen eines Auftrags mit den aktuell
   * gespeicherten Werten ab (idempotent). Ergänzt fehlende Positionen einmalig,
   * entfernt nur unbearbeitete ausgelöste Positionen.
   */
  syncOrder: async (orderId: string) => {
    const ms = (await unwrap(
      dbClient
        .from("order_measurements")
        .select("id, service_id, sample_id, status, assigned_to, priority, origin, source_step_key, measurement_results(result_name, value, remarks), measurement_parameters(parameter_name, parameter_value)")
        .eq("order_id", orderId)
    )) as any[];
    if (!ms?.length) return { added: 0, removed: 0, kept: 0 };

    const serviceIds = [...new Set(ms.map((m) => m.service_id).filter(Boolean))];
    const rulesByService = await ruleTriggers.rulesByService(serviceIds);
    const hasTrigger = Object.values(rulesByService).some((rs) =>
      rs.some((r) => (r.actions ?? []).some((a) => a.type === "trigger_service"))
    );
    const anyRulePositions = ms.some((m) => m.origin === "workflow" && isRuleStepKey(m.source_step_key));
    if (!hasTrigger && !anyRulePositions) return { added: 0, removed: 0, kept: 0 };

    // Auftragsparameter tragen den Anzeigenamen → auf Feldschlüssel zurückführen.
    const fields = (await unwrap(
      dbClient.from("service_data_fields").select("service_id, field_key, display_name").in("service_id", serviceIds)
    )) as any[];
    const keyByName = new Map<string, string>();
    for (const f of fields ?? []) keyByName.set(`${f.service_id}|${f.display_name}`, f.field_key);

    const sources: TriggerSource[] = ms.map((m) => {
      const values: Record<string, unknown> = {};
      for (const p of m.measurement_parameters ?? []) {
        const k = keyByName.get(`${m.service_id}|${p.parameter_name}`) ?? p.parameter_name;
        values[k] = p.parameter_value;
      }
      for (const r of m.measurement_results ?? []) {
        values[r.result_name] = r.value ?? r.remarks;
      }
      return { key: m.id, service_id: m.service_id, sample_id: m.sample_id, values };
    });

    const existing: TriggerExisting[] = ms.map((m) => ({
      key: m.id,
      service_id: m.service_id,
      sample_id: m.sample_id,
      from_rule: m.origin === "workflow" && isRuleStepKey(m.source_step_key),
      edited:
        m.status !== "open" ||
        !!m.assigned_to ||
        (m.measurement_results ?? []).length > 0 ||
        (m.measurement_parameters ?? []).length > 0,
    }));

    const plan = planRuleTriggers({ sources, rulesByService, existing });
    const byId = new Map(ms.map((m) => [m.id, m]));

    for (const a of plan.add) {
      const src = byId.get(a.source_key);
      await unwrap(
        dbClient
          .from("order_measurements")
          .insert({
            order_id: orderId,
            service_id: a.target_service_id,
            sample_id: a.sample_id,
            priority: src?.priority,
            origin: "workflow",
            source_measurement_id: a.source_key,
            source_step_key: ruleStepKey(a.rule_id),
            measurement_number: "WILL_BE_OVERWRITTEN",
          } as any)
          .select("id")
          .single()
      );
    }
    for (const id of plan.remove) {
      await run(dbClient.from("order_measurements").delete().eq("id", id).eq("status", "open"));
    }
    return { added: plan.add.length, removed: plan.remove.length, kept: plan.keep.length };
  },
};
