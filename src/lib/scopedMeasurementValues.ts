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
/** Requester-instance keys (av_1, av2 …) are never a local AV themselves. */
const REQUESTER_AV_KEY = /^av_?\d+$/i;
const LOCAL_AV_KEY = /^av(?:_[a-z0-9]+)?$/i;
const NUMERIC_TYPES = ["number", "decimal", "percent"];

/** Editable numeric field prefilled ("copy") from the requester AV1 – a local measurement input. */
export function isLocalAvPrefillField(f: FormField & { data_source?: unknown }): boolean {
  if (!NUMERIC_TYPES.includes(f.field_type) || f.readonly) return false;
  const src = readValueSource(f);
  return !!src && src.mode === "copy" && AV_SOURCE_KEYS.includes(src.source.field_key.toLowerCase());
}

function pickLocalAv(candidates: FormField[]): LocalAvResolution {
  const editable = candidates.filter((f) => NUMERIC_TYPES.includes(f.field_type) && !f.readonly);
  const linked = editable.filter((f) => isLocalAvPrefillField(f as FormField & { data_source?: unknown }));
  const legacy = editable.filter((f) => LOCAL_AV_KEY.test(f.field_key) && !REQUESTER_AV_KEY.test(f.field_key) &&
    !isLinkedField(f as FormField & { data_source?: unknown }));
  const pool = linked.length ? linked : legacy;
  if (pool.length === 1) return { status: "ok", field: pool[0], via: linked.length ? "data_source" : "legacy_key" };
  if (pool.length > 1) return { status: "ambiguous", candidates: pool.map((f) => f.id) };
  return { status: "none" };
}

/**
 * Identifies the editable local AV of a repeater. Strongest identity: an editable
 * prefill ("copy") link to av_1/av1. Otherwise an unlinked key "av" or "av_<suffix>"
 * (never a requester instance av_<n>). Exactly one candidate, else no override.
 */
export function resolveLocalAvField(owner: FormField, fields: FormField[], calcs: FormCalculation[]): LocalAvResolution {
  if (owner.field_type !== "repeater") return { status: "none" };
  return pickLocalAv(containerFields(owner, fields, calcs));
}

/** K-value calculation identity: calc_key k_wert / k-wert (+ optional suffix) or display name starting with "K-Wert". */
export const isKValueCalc = (c: Pick<FormCalculation, "calc_key" | "display_name">) =>
  /^k[-_]?wert(?:_[a-z0-9]+)?$/i.test(c.calc_key) || /^k-wert(?![a-z])/i.test(c.display_name?.trim() ?? "");
const K_CALC = isKValueCalc;
const warned = new Set<string>();

function avOverlay(calc: FormCalculation, value: number | null): Record<string, unknown> | null {
  const refs = extractReferences(calc.formula || "").filter((k) => AV_SOURCE_KEYS.includes(k.toLowerCase()));
  return refs.length ? Object.fromEntries(refs.map((k) => [k, value])) : null;
}

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
    const o = avOverlay(c, value);
    if (o) overrides[c.calc_key] = o;
  }
  return overrides;
}

/**
 * Legacy repeater (no stored IDs): local AV among the repeater's own sub-fields;
 * overlay only for K-value calculations of the same form. Entry values keyed by field_key.
 */
export function legacyEntryKValueInputs(owner: FormField, children: FormField[], calcs: FormCalculation[], entry: Record<string, unknown> | undefined) {
  const resolved = pickLocalAv(children);
  if (resolved.status !== "ok") return {};
  const value = parseControlledNumber(entry?.[resolved.field.field_key]);
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const c of calcs) {
    if ((owner.form_id && c.form_id && c.form_id !== owner.form_id) || !K_CALC(c)) continue;
    const o = avOverlay(c, value);
    if (o) overrides[c.calc_key] = o;
  }
  return overrides;
}

/**
 * Flat numbered forms (temperatur_n / av_n / k_wert_n as top-level fields):
 * K-value calculation k_wert_<n> (n ≥ 2) uses its own av_<n> as operand av_1, if
 * that field exists in the form. k_wert_1 and all other calculations stay unchanged.
 */
export function flatKValueInputs(fields: FormField[], calcs: FormCalculation[], values: Record<string, unknown>) {
  const overrides: Record<string, Record<string, unknown>> = {};
  const topKeys = new Set(fields.filter((f) => !f.parent_field_id).map((f) => f.field_key.toLowerCase()));
  for (const c of calcs) {
    const m = /^k[-_]?wert_(\d+)$/i.exec(c.calc_key);
    if (!m || m[1] === "1") continue;
    const avKey = [`av_${m[1]}`, `av${m[1]}`].find((k) => topKeys.has(k));
    if (!avKey) continue;
    const field = fields.find((f) => f.field_key.toLowerCase() === avKey)!;
    const o = avOverlay(c, parseControlledNumber(values[field.field_key]));
    if (o) overrides[c.calc_key] = o;
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
  /** false = evaluate with the requester AV only (integrity check of historical values). */
  useLocalAv = true,
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
  ], useLocalAv ? localKValueInputs(owner, fields, definitions, own) : {});
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