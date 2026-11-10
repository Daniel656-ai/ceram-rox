import type { FormField } from "@/lib/api/formFields";
import { readRepeaterMeta, repeaterChildren } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { readMeasurementBlockMeta, newInstanceId, INSTANCE_ID_KEY } from "@/lib/measurementBlocks";
import { normalizeRepeaterLayout, type RepeaterLayout } from "@/lib/repeaterLayout";
import { evaluateLocalCalculations, buildFormulaFromTokens, type LocalCalcResult } from "@/lib/localCalculations";
import { extractReferences } from "@/lib/formulaEngine";
import { isLinkedField } from "@/lib/fieldLinks";

/** Deliberately exact identities, not a general AV alias/renaming rule. */
function localKValueInputs(owner: FormField, fields: FormField[], calcs: FormCalculation[], own: Record<string, unknown>) {
  if (owner.field_type !== "repeater") return {};
  const localAv = containerFields(owner, fields, calcs).filter((f) =>
    f.form_id === owner.form_id && f.field_key.toLowerCase() === "av" &&
    ["number", "decimal"].includes(f.field_type) && !f.readonly &&
    !isLinkedField(f as FormField & { data_source?: unknown }));
  if (localAv.length !== 1) return {};
  const raw = own[localAv[0].field_key];
  // No verified Excel fallback: missing/invalid local AV is not calculable.
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw :
    typeof raw === "string" && /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(raw.trim())
      ? Number(raw.trim().replace(",", ".")) : null;
  const placed = new Set(containerLayout(owner, fields, calcs).items.flatMap((i) => i.type === "group" ? i.children : [i])
    .flatMap((i) => i.type === "calculation" ? [i.calc_key] : []));
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const c of calcs) {
    if (c.form_id !== owner.form_id || !placed.has(c.calc_key) ||
      !(c.calc_key.toLowerCase() === "k_wert" || c.display_name?.trim().toLowerCase() === "k-wert")) continue;
    const references = extractReferences(c.formula || "").filter((key) =>
      ["av_1", "av1"].includes(key.toLowerCase()) && fields.some((f) => f.form_id === owner.form_id && f.field_key === key));
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