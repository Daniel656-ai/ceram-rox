import type { FormField } from "@/lib/api/formFields";
import { readRepeaterMeta, repeaterChildren } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { readMeasurementBlockMeta, newInstanceId, INSTANCE_ID_KEY } from "@/lib/measurementBlocks";
import { normalizeRepeaterLayout, type RepeaterLayout } from "@/lib/repeaterLayout";
import { evaluateLocalCalculations, buildFormulaFromTokens, type LocalCalcResult } from "@/lib/localCalculations";
import { extractReferences } from "@/lib/formulaEngine";
import { isLinkedField, readValueSource } from "@/lib/fieldLinks";

const AV_SOURCE_KEYS = ["av_1", "av1"];
const NUMERIC_TEXT = /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
/** Default result precision when a calculation has no `decimals` (same as the renderer display default). */
export const DEFAULT_RESULT_DECIMALS = 2;

/** Controlled number parsing: finite numbers or a single plain decimal with dot OR comma; never "" -> 0. */
export function parseControlledNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || !NUMERIC_TEXT.test(raw.trim())) return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Integrity comparison only: tolerance is half of the last displayed decimal. Stored values are never changed. */
export function storedMatchesLive(stored: unknown, live: number | null | undefined, decimals?: number | null): boolean {
  const s = stored === null || stored === undefined ? null : parseControlledNumber(stored);
  const l = live ?? null;
  if (s === null || l === null) return s === null && l === null && (stored === null || stored === undefined);
  const d = Number.isInteger(decimals) && (decimals as number) >= 0 ? (decimals as number) : DEFAULT_RESULT_DECIMALS;
  return Math.abs(s - l) <= 0.5 * Math.pow(10, -d) + 1e-12;
}

export type LocalAvResolution =
  | { status: "ok"; field: FormField; via: "data_source" | "legacy_key" }
  | { status: "none" }
  | { status: "ambiguous"; candidates: string[] };

/**
 * Identifies the editable local AV of a repeater. Strongest identity: an editable
 * prefill ("copy") link to the requester operand av_1/av1. Legacy identity: the
 * exact, unlinked field key "av". Display names or "av*" prefixes never qualify.
 */
export function resolveLocalAvField(owner: FormField, fields: FormField[], calcs: FormCalculation[]): LocalAvResolution {
  if (owner.field_type !== "repeater") return { status: "none" };
  const editable = containerFields(owner, fields, calcs).filter((f) =>
    ["number", "decimal"].includes(f.field_type) && !f.readonly);
  const linked = editable.filter((f) => {
    const src = readValueSource(f as FormField & { data_source?: unknown });
    return !!src && src.mode === "copy" && AV_SOURCE_KEYS.includes(src.source.field_key.toLowerCase());
  });
  const legacy = editable.filter((f) => f.field_key.toLowerCase() === "av" &&
    !isLinkedField(f as FormField & { data_source?: unknown }));
  const pool = linked.length ? linked : legacy;
  if (pool.length === 1) return { status: "ok", field: pool[0], via: linked.length ? "data_source" : "legacy_key" };
  if (pool.length > 1) return { status: "ambiguous", candidates: pool.map((f) => f.id) };
  return { status: "none" };
}

const K_CALC = (c: FormCalculation) => /^k_wert(?:_\d+)?$/i.test(c.calc_key) || /^k-wert(?:\s*\d+)?$/i.test(c.display_name?.trim() ?? "");
const warned = new Set<string>();

/** Overrides only av_1/av1 inside K-value calculations placed in this repeater; nothing else. */
function localKValueInputs(owner: FormField, fields: FormField[], calcs: FormCalculation[], own: Record<string, unknown>) {
  const resolved = resolveLocalAvField(owner, fields, calcs);
  if (resolved.status === "ambiguous") {
    if (!warned.has(owner.id)) {
      warned.add(owner.id);
      console.warn("[ROX] Lokales AV mehrdeutig – kein Override", { repeater: owner.id, candidates: resolved.candidates });
    }
    return {};
  }
  if (resolved.status !== "ok") return {};
  // No verified Excel fallback: missing/invalid local AV is not calculable.
  const value = parseControlledNumber(own[resolved.field.field_key]);
  const placed = new Set(containerLayout(owner, fields, calcs).items.flatMap((i) => i.type === "group" ? i.children : [i])
    .flatMap((i) => i.type === "calculation" ? [i.calc_key] : []));
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const c of calcs) {
    if (c.form_id !== owner.form_id || !placed.has(c.calc_key) || !K_CALC(c)) continue;
    const references = extractReferences(c.formula || "").filter((key) => AV_SOURCE_KEYS.includes(key.toLowerCase()));
    if (references.length) overrides[c.calc_key] = Object.fromEntries(references.map((key) => [key, value]));
  }
  return overrides;
}

/** Only the approved block -> repeater nesting, never arbitrary recursion. */
export function eligibleLocalReferences(owner: FormField, fields: FormField[]): FormField[] {
  return fields.filter((f) => f.form_id === owner.form_id && f.id !== owner.id &&
    f.field_type !== "measurement_block" &&
    (f.field_type !== "repeater" || owner.field_type === "measurement_block"));
}

export function containerLayout(owner: FormField, fields: FormField[], calcs: FormCalculation[] = []): RepeaterLayout {
  const eligible = eligibleLocalReferences(owner, fields);
  const children = repeaterChildren(fields, owner.id).filter((f) => eligible.some((e) => e.id === f.id));
  const meta = owner.field_type === "measurement_block" ? readMeasurementBlockMeta(owner) : readRepeaterMeta(owner);
  return normalizeRepeaterLayout(meta.layout, children.map((f) => f.field_key), calcs.map((c) => c.calc_key), {
    fields: eligible, calculations: calcs.filter((c) => c.form_id === owner.form_id),
  });
}

export function containerFields(owner: FormField, fields: FormField[], calcs: FormCalculation[] = []): FormField[] {
  const layout = containerLayout(owner, fields, calcs);
  const leaves = layout.items.flatMap((i) => i.type === "group" ? i.children : [i]);
  const out: FormField[] = [];
  for (const item of leaves) {
    if (item.type !== "field") continue;
    const target = fields.find((f) => item.field_id ? f.id === item.field_id : f.field_key === item.key);
    if (target && !out.some((f) => f.id === target.id)) out.push(target);
  }
  return out;
}

export function hasScopedReferences(owner: FormField): boolean {
  const meta = owner.field_type === "measurement_block" ? readMeasurementBlockMeta(owner) : readRepeaterMeta(owner);
  const raw = meta.layout as Partial<RepeaterLayout> | null;
  return (raw?.items ?? []).some((i) => {
    const leaves = i.type === "group" ? i.children : [i];
    return leaves.some((l) => (l.type === "field" && !!l.field_id) || (l.type === "calculation" && !!l.calc_id));
  });
}

/** Resolve current definition names without renaming stored entry keys. */
export function entryDefinitionScope(owner: FormField, fields: FormField[], calcs: FormCalculation[], entry: Record<string, unknown>) {
  const layout = containerLayout(owner, fields, calcs);
  const scope: Record<string, unknown> = {};
  for (const item of layout.items.flatMap((i) => i.type === "group" ? i.children : [i])) {
    if (item.type === "field") scope[item.key] = entry[item.value_key ?? item.key] ?? null;
  }
  return scope;
}

/** Uses the existing engine; ID-backed visual operands are resolved in memory only. */
export function evaluateScopedEntry(
  owner: FormField, fields: FormField[], calcs: FormCalculation[], root: Record<string, unknown>,
  entry: Record<string, unknown>, parent: Record<string, unknown> = {},
): Record<string, LocalCalcResult> {
  const definitions = calcs.map((c) => {
    if (!c.expression?.length) return c;
    const tokens = c.expression.map((t) => {
      if (t.type !== "operand" || !t.ref_id || t.source === "const") return t;
      const ref = t.source === "field" ? fields.find((f) => f.id === t.ref_id)?.field_key : calcs.find((d) => d.id === t.ref_id)?.calc_key;
      return { ...t, ref: ref ?? `missing_reference_${t.ref_id.replace(/-/g, "_")}` };
    });
    return { ...c, formula: buildFormulaFromTokens(tokens) };
  });
  const own = entryDefinitionScope(owner, fields, calcs, entry);
  const values = { ...root, ...parent, ...own };
  // Never let an incomplete/cyclic upstream calculation use its old stored value.
  for (const c of definitions) values[c.calc_key] = null;
  return evaluateLocalCalculations(definitions, values, [
    ...fields.map((f) => f.field_key), ...Object.keys(parent), ...Object.keys(own),
  ], localKValueInputs(owner, fields, definitions, own));
}

function calculatedEntry(owner: FormField, fields: FormField[], calcs: FormCalculation[], root: Record<string, unknown>, entry: Record<string, unknown>, parent: Record<string, unknown>) {
  const layout = containerLayout(owner, fields, calcs);
  const results = evaluateScopedEntry(owner, fields, calcs, root, entry, parent);
  const next = { ...entry };
  for (const item of layout.items.flatMap((i) => i.type === "group" ? i.children : [i])) {
    if (item.type === "calculation") next[item.value_key ?? item.calc_key] = results[item.calc_key]?.value ?? null;
  }
  return next;
}

/** Called only on an explicit edit, not hydration or definition changes. Keeps one JSON value. */
export function updateScopedContainer(
  owner: FormField, fields: FormField[], calcs: FormCalculation[], root: Record<string, unknown>,
  entries: Array<Record<string, unknown>>, previous: Array<Record<string, unknown>> = [],
  parent: Record<string, unknown> = {},
): Array<Record<string, unknown>> {
  return entries.map((entry) => {
    if (previous.includes(entry)) return entry;
    let next = calculatedEntry(owner, fields, calcs, root, entry, parent);
    if (owner.field_type !== "measurement_block") return next;
    const runScope = { ...next, ...entryDefinitionScope(owner, fields, calcs, next) };
    const oldEntry = previous.find((p) => p[INSTANCE_ID_KEY] === entry[INSTANCE_ID_KEY]);
    const oldScope = oldEntry ? { ...oldEntry, ...entryDefinitionScope(owner, fields, calcs, oldEntry) } : {};
    const parentChanged = Object.keys(runScope).some((key) => !Array.isArray(runScope[key]) &&
      !key.startsWith("__") && JSON.stringify(runScope[key]) !== JSON.stringify(oldScope[key]));
    for (const nested of containerFields(owner, fields, calcs).filter((f) => f.field_type === "repeater")) {
      const placement = containerLayout(owner, fields, calcs).items.flatMap((i) => i.type === "group" ? i.children : [i])
        .find((i) => i.type === "field" && (i.field_id === nested.id || i.key === nested.field_key));
      const key = placement?.type === "field" ? placement.value_key ?? nested.field_key : nested.field_key;
      const raw = next[key];
      const oldPoints = oldEntry?.[key];
      if (!Array.isArray(raw)) continue; // Never redistribute old root arrays.
      next = { ...next, [key]: raw.map((point) => {
        if (!point || typeof point !== "object" || Array.isArray(point)) return point;
        if (!parentChanged && Array.isArray(oldPoints) && oldPoints.includes(point)) return point;
        return calculatedEntry(nested, fields, calcs, root, point, runScope);
      }) };
    }
    return next;
  });
}

export function newTemperatureEntry(): Record<string, unknown> {
  return { [INSTANCE_ID_KEY]: newInstanceId() };
}

export function duplicateScopedEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
  copy[INSTANCE_ID_KEY] = newInstanceId();
  for (const [key, value] of Object.entries(copy)) {
    if (Array.isArray(value)) copy[key] = value.map((p) => p && typeof p === "object" && INSTANCE_ID_KEY in p
      ? { ...p, [INSTANCE_ID_KEY]: newInstanceId() } : p);
  }
  return copy;
}