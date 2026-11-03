/**
 * Auftraggeber-Vorgaben je Messdurchlauf (rein lesend)
 * ====================================================
 *
 * Löst für eine Ergebnismatrix-Zeile die Prüfbedingungen auf – aber nur,
 * wenn sie eindeutig an genau diesen Durchlauf gebunden sind:
 *
 *  1. Am Ergebnis gespeicherter Kontext (`measurement_results.instance_context`).
 *     Mehrere Ergebnisse derselben Zeile müssen identischen Kontext tragen.
 *  2. Eintrag in `measurement_orders.shared_form_data`, dessen stabile
 *     `__instance_id` exakt dem `instance_key` des Ergebnisses entspricht und
 *     im gesamten Auftrag genau einmal vorkommt. Gelesen wird nur `__context`.
 *
 * Niemals: Positions-Fallbacks (`idx_*`), Anzeigenamen, aktuelle auftragsweite
 * Werte ohne Durchlauf-ID als Durchlaufbedingungen. Flache measurement_parameters
 * sind nur separat gekennzeichnete Messaufgabenvorgaben nach klassischer Prüfung. Widersprechen
 * sich Quellen, gilt der Durchlauf als nicht eindeutig. Nichts wird geschrieben.
 */
import type { ResultRecord } from "@/hooks/useResultsDatabase";
import { classicTaskEntries } from "./classicTaskConditions";

export type RequesterConditionSource = "result_context" | "run_entry" | "measurement_parameters";

export interface RequesterConditionsResolution {
  status: "assigned" | "task_parameters" | "unavailable";
  reason?: "no_binding" | "positional_only" | "inconsistent_results" | "ambiguous_run_entry" | "source_conflict";
  entries: Array<{ key: string; value: string; unit?: string | null; id?: string }>;
  sources: RequesterConditionSource[];
}

type Ctx = Record<string, string>;

function cleanContext(raw: unknown): Ctx {
  const out: Ctx = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key || v == null || typeof v === "object") continue;
    const value = String(v).trim();
    if (value) out[key] = value;
  }
  return out;
}

const sameCtx = (a: Ctx, b: Ctx) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] === a[k]);
};

/** Alle Einträge mit exakt dieser stabilen Durchlauf-ID (beliebig tief verschachtelt). */
export function findRunEntries(sharedFormData: unknown, instanceId: string): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    const obj = node as Record<string, unknown>;
    if (obj.__instance_id === instanceId) found.push(obj);
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  walk(sharedFormData, 0);
  return found;
}

const unavailable = (reason: RequesterConditionsResolution["reason"]): RequesterConditionsResolution =>
  ({ status: "unavailable", reason, entries: [], sources: [] });

export function resolveRequesterConditions(
  record: Pick<ResultRecord, "instanceKey" | "outputResults"> & Partial<Pick<ResultRecord, "measurementId" | "orderId" | "sampleId" | "serviceId" | "classicTaskSource">> & { orderSharedFormData?: unknown },
): RequesterConditionsResolution {
  const key = (record.instanceKey ?? "").trim();
  const results = record.outputResults ?? [];

  // 1. Gespeicherter Ergebniskontext – alle Ergebnisse der Zeile müssen übereinstimmen.
  const contexts = results.map((r) => cleanContext(r.instance_context));
  const nonEmpty = contexts.filter((c) => Object.keys(c).length > 0);
  let resultCtx: Ctx | null = null;
  if (nonEmpty.length > 0) {
    if (nonEmpty.length !== contexts.length || nonEmpty.some((c) => !sameCtx(c, nonEmpty[0]))) {
      return unavailable("inconsistent_results");
    }
    resultCtx = nonEmpty[0];
  }

  // 2. Durchlaufeintrag in shared_form_data – nur über stabile ID.
  let runCtx: Ctx | null = null;
  if (key && !/^idx_\d+$/.test(key)) {
    const matches = findRunEntries(record.orderSharedFormData, key);
    if (matches.length > 1) return unavailable("ambiguous_run_entry");
    if (matches.length === 1) {
      const c = cleanContext(matches[0].__context);
      if (Object.keys(c).length) runCtx = c;
    }
  } else if (key && !resultCtx) {
    return unavailable("positional_only");
  }

  if (resultCtx && runCtx) {
    for (const k of Object.keys(runCtx)) {
      if (k in resultCtx && resultCtx[k] !== runCtx[k]) return unavailable("source_conflict");
    }
  }
  if (!resultCtx && !runCtx) {
    const entries = classicTaskEntries(record);
    if (entries) return { status: "task_parameters", entries, sources: ["measurement_parameters"] };
    return unavailable("no_binding");
  }

  const merged: Ctx = { ...(runCtx ?? {}), ...(resultCtx ?? {}) };
  const sources: RequesterConditionSource[] = [];
  if (resultCtx) sources.push("result_context");
  if (runCtx) sources.push("run_entry");
  return {
    status: "assigned",
    entries: Object.entries(merged).map(([k, value]) => ({ key: k, value })),
    sources,
  };
}
