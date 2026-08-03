import type {
  FormFieldRule,
  RuleCondition,
  RuleConditionGroup,
} from "@/lib/api/formFieldRules";
import type { EffectivePermission, FieldVisibility } from "@/lib/api/formFieldPermissions";
import type { FormField } from "@/lib/api/formFields";

/**
 * Phase 4: Auswertung der Feldregeln zur Laufzeit.
 * Reine Funktionen ohne Seiteneffekte – wird nur angewendet, wenn Regeln
 * vorhanden sind. Bestehende Formulare bleiben dadurch unverändert.
 */

export interface RuleContext {
  /** Aktuelle Formularwerte, Schlüssel = field_key */
  values: Record<string, unknown>;
  /** Kontextdaten wie Auftragsstatus, Rolle etc. */
  context?: Record<string, unknown>;
}

const norm = (v: unknown): string => (v == null ? "" : String(v)).trim().toLowerCase();
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export function evaluateCondition(c: RuleCondition, ctx: RuleContext): boolean {
  const raw =
    c.source === "field"
      ? ctx.values?.[c.field_key]
      : (ctx.context ?? {})[c.field_key];

  switch (c.op) {
    case "empty":
      return raw == null || String(raw) === "" || (Array.isArray(raw) && raw.length === 0);
    case "not_empty":
      return !(raw == null || String(raw) === "" || (Array.isArray(raw) && raw.length === 0));
    case "truthy":
      return !!raw && raw !== "false";
    case "falsy":
      return !raw || raw === "false";
    case "eq":
      return norm(raw) === norm(c.value);
    case "neq":
      return norm(raw) !== norm(c.value);
    case "contains":
      return norm(raw).includes(norm(c.value));
    case "in":
      return String(c.value ?? "")
        .split(",")
        .map((s) => norm(s))
        .includes(norm(raw));
    case "gt":
      return num(raw) > num(c.value);
    case "gte":
      return num(raw) >= num(c.value);
    case "lt":
      return num(raw) < num(c.value);
    case "lte":
      return num(raw) <= num(c.value);
    default:
      return false;
  }
}

export function evaluateGroup(group: RuleConditionGroup | undefined, ctx: RuleContext): boolean {
  const conds = group?.conditions ?? [];
  if (conds.length === 0) return false;
  return group?.logic === "or"
    ? conds.some((c) => evaluateCondition(c, ctx))
    : conds.every((c) => evaluateCondition(c, ctx));
}

export interface RuleOverride {
  visibility?: FieldVisibility;
  required?: boolean;
}

/** Ergibt je Feld-ID die durch aktive Regeln erzwungenen Überschreibungen. */
export function computeRuleOverrides(
  rules: FormFieldRule[],
  ctx: RuleContext
): Map<string, RuleOverride> {
  const out = new Map<string, RuleOverride>();
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (!evaluateGroup(rule.condition, ctx)) continue;
    for (const fid of rule.target_field_ids ?? []) {
      const cur = out.get(fid) ?? {};
      switch (rule.action) {
        case "show":
          cur.visibility = cur.visibility === "read" ? "read" : "write";
          break;
        case "hide":
          cur.visibility = "hidden";
          break;
        case "readonly":
          if (cur.visibility !== "hidden") cur.visibility = "read";
          break;
        case "editable":
          if (cur.visibility !== "hidden") cur.visibility = "write";
          break;
        case "require":
          cur.required = true;
          break;
        case "optional":
          cur.required = false;
          break;
      }
      out.set(fid, cur);
    }
  }
  return out;
}

/**
 * Felder, die Ziel einer "show"-Regel sind, sind standardmäßig ausgeblendet,
 * solange die Bedingung nicht erfüllt ist (klassisches Conditional-Show).
 */
export function conditionalHiddenTargets(rules: FormFieldRule[]): Set<string> {
  const s = new Set<string>();
  for (const r of rules) {
    if (!r.is_active || r.action !== "show") continue;
    for (const fid of r.target_field_ids ?? []) s.add(fid);
  }
  return s;
}

/** Verschmilzt Rollenrechte mit Regel-Overrides. Rechte-Sperren bleiben stärker. */
export function mergePermissionsWithRules(
  base: Map<string, EffectivePermission> | undefined,
  fields: FormField[],
  rules: FormFieldRule[],
  ctx: RuleContext
): Map<string, EffectivePermission> {
  const result = new Map<string, EffectivePermission>();
  const fallback: EffectivePermission = {
    visibility: "write",
    required: false,
    can_add: true,
    can_remove: true,
  };
  for (const f of fields) result.set(f.id, { ...(base?.get(f.id) ?? fallback) });

  if (rules.length === 0) return base ? new Map(base) : result;

  const hiddenByDefault = conditionalHiddenTargets(rules);
  for (const fid of hiddenByDefault) {
    const cur = result.get(fid);
    if (cur && cur.visibility !== "hidden") result.set(fid, { ...cur, visibility: "hidden" });
  }

  const overrides = computeRuleOverrides(rules, ctx);
  for (const [fid, ov] of overrides) {
    const cur = result.get(fid);
    if (!cur) continue;
    // Gesperrte Felder (z.B. abgeschlossener Auftrag) niemals wieder öffnen.
    const nextVisibility =
      cur.locked && ov.visibility === "write" ? "read" : ov.visibility ?? cur.visibility;
    result.set(fid, {
      ...cur,
      visibility: nextVisibility,
      required: cur.locked ? false : ov.required ?? cur.required,
    });
  }
  return result;
}
