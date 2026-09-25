/**
 * Gemeinsame Auswertung der Regeln je Dienstleistung (`service_rules`).
 *
 * Eine einzige Bedingungslogik für Anzeige-/Pflichtaktionen und für die
 * Aktion „Dienstleistung auslösen“ (`trigger_service`).
 */
import type { RuleCondition, ServiceRule } from "@/lib/api/serviceRules";

export type ValueGetter = (fieldKey: string) => unknown;

/** Prüft eine einzelne Bedingung – Verhalten identisch zur bisherigen Anzeige-Logik. */
export function evaluateCondition(c: RuleCondition, v: unknown): boolean {
  if (v instanceof RepeaterColumn) {
    // Repeater-Unterfeld: „ist leer“ nur, wenn ALLE Einträge leer sind; sonst
    // genügt ein Eintrag, der die Bedingung erfüllt. Werte werden nicht berechnet.
    if (c.operator === "is_empty") return v.items.every((x) => evaluateCondition(c, x));
    return v.items.some((x) => evaluateCondition(c, x));
  }
  switch (c.operator) {
    case "equals": return String(v ?? "") === String(c.value ?? "");
    case "not_equals": return String(v ?? "") !== String(c.value ?? "");
    case "is_empty": return v == null || v === "";
    case "is_not_empty": return !(v == null || v === "");
    case "contains": return String(v ?? "").includes(String(c.value ?? ""));
    case "gte": return Number(v) >= Number(c.value);
    case "lte": return Number(v) <= Number(c.value);
    case "greater_than": return Number(v) > Number(c.value);
    case "less_than": return Number(v) < Number(c.value);
    default: return false;
  }
}

/** Ist die (aktivierte) Regel für die gegebenen Werte erfüllt? */
export function isRuleSatisfied(rule: ServiceRule, get: ValueGetter): boolean {
  if (!rule.enabled) return false;
  const checks = (rule.conditions ?? []).map((c) => evaluateCondition(c, get(c.field_key)));
  return rule.logic === "or" ? checks.some(Boolean) : checks.every(Boolean);
}

/**
 * Wertzugriff für Auslöser: reiner Feldschlüssel, sonst Formularwert
 * `form:<Formular>:<Feldschlüssel>` derselben Position. Leere Zahlen-Strings
 * mit Komma werden als Zahl gelesen.
 */
/** Werte eines Repeater-Unterfelds über alle Einträge (Schlüssel `bereich.unterfeld`). */
export class RepeaterColumn {
  constructor(public readonly items: unknown[]) {}
}

const normalizeNumber = (v: unknown) =>
  typeof v === "string" && /^\s*[+-]?\d+,\d+\s*$/.test(v) ? v.replace(",", ".").trim() : v;

export function makeValueGetter(values: Record<string, unknown>): ValueGetter {
  const lookup = (key: string): unknown => {
    let v: unknown = values[key];
    if (v === undefined) {
      const suffix = `:${key}`;
      for (const [k, val] of Object.entries(values)) {
        if (k.startsWith("form:") && k.endsWith(suffix)) { v = val; break; }
      }
    }
    return v;
  };
  return (key) => {
    let v = lookup(key);
    if (v === undefined && key.includes(".")) {
      const dot = key.indexOf(".");
      const rows = lookup(key.slice(0, dot));
      if (Array.isArray(rows)) {
        const child = key.slice(dot + 1);
        return new RepeaterColumn(
          rows.map((r) => normalizeNumber(r && typeof r === "object" ? (r as Record<string, unknown>)[child] : undefined))
        );
      }
    }
    return normalizeNumber(v);
  };
}

// ---------------------------------------------------------------------------
// Auslöser „Dienstleistung auslösen“
// ---------------------------------------------------------------------------

export interface TriggerSource {
  /** Positionskennung (Entwurfs-uid oder Messungs-ID). */
  key: string;
  service_id: string;
  sample_id?: string | null;
  values: Record<string, unknown>;
}

export interface TriggerExisting {
  key: string;
  service_id: string;
  sample_id?: string | null;
  /** true, wenn die Position durch eine Regel ausgelöst wurde. */
  from_rule: boolean;
  /** true, wenn bereits Eingaben/Ergebnisse/Bearbeitung vorliegen. */
  edited: boolean;
}

export interface TriggerPlan {
  add: Array<{ source_key: string; rule_id: string; target_service_id: string; sample_id: string | null }>;
  /** Ausgelöste, unbearbeitete Positionen, deren Bedingung nicht mehr erfüllt ist. */
  remove: string[];
  /** Ausgelöste Positionen ohne erfüllte Bedingung, die wegen Bearbeitung erhalten bleiben. */
  keep: string[];
}

const slot = (serviceId: string, sampleId?: string | null) => `${serviceId}|${sampleId ?? ""}`;

/**
 * Duplikatschutz: je Auftrag, Zieldienstleistung und Probe höchstens eine
 * Position – egal wie viele Regeln/Quellpositionen sie auslösen und ob sie
 * bereits (manuell, aus Auswahl, Paket, Abhängigkeit) vorhanden ist.
 */
export function planRuleTriggers(params: {
  sources: TriggerSource[];
  rulesByService: Record<string, ServiceRule[] | undefined>;
  existing: TriggerExisting[];
}): TriggerPlan {
  const { sources, rulesByService, existing } = params;
  const desired = new Map<string, TriggerPlan["add"][number]>();

  for (const src of sources) {
    const rules = rulesByService[src.service_id] ?? [];
    if (rules.length === 0) continue;
    const get = makeValueGetter(src.values);
    for (const rule of rules) {
      const targets = (rule.actions ?? []).filter(
        (a) => a.type === "trigger_service" && a.target_service_id && a.target_service_id !== src.service_id
      );
      if (targets.length === 0 || !isRuleSatisfied(rule, get)) continue;
      for (const a of targets) {
        const k = slot(a.target_service_id!, src.sample_id);
        if (!desired.has(k)) {
          desired.set(k, {
            source_key: src.key,
            rule_id: rule.id,
            target_service_id: a.target_service_id!,
            sample_id: src.sample_id ?? null,
          });
        }
      }
    }
  }

  const present = new Set(existing.map((e) => slot(e.service_id, e.sample_id)));
  const add = [...desired.entries()].filter(([k]) => !present.has(k)).map(([, v]) => v);

  const remove: string[] = [];
  const keep: string[] = [];
  for (const e of existing) {
    if (!e.from_rule || desired.has(slot(e.service_id, e.sample_id))) continue;
    if (e.edited) keep.push(e.key);
    else remove.push(e.key);
  }
  return { add, remove, keep };
}

/** Kennzeichen einer ausgelösten Position (`order_measurements.source_step_key`). */
export const RULE_STEP_PREFIX = "rule:";
export const ruleStepKey = (ruleId: string) => `${RULE_STEP_PREFIX}${ruleId}`;
export const isRuleStepKey = (k: string | null | undefined) => !!k && k.startsWith(RULE_STEP_PREFIX);
