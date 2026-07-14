/**
 * Report / Laufzettel Binding-Helfer.
 *
 * Report-Templates referenzieren Werte aus `order_instances.shared_data`
 * über Pfad-Ausdrücke der Form:
 *
 *   "{{stepKey.fieldKey}}"          → shared_data[stepKey][fieldKey]
 *   "{{stepKey.subObj.field}}"      → verschachtelt
 *   "{{order.order_number}}"        → order-Wurzel-Felder
 *
 * Der Resolver ist bewusst reine Frontend-Logik und darf `shared_data`
 * nicht mutieren.
 */

export type SharedData = Record<string, unknown>;

export interface BindingContext {
  shared: SharedData;
  order?: Record<string, unknown>;
}

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Löst einen einzelnen Pfad wie `stepA.fieldB.0.value` gegen den Kontext auf. */
export function resolveBindingPath(path: string, ctx: BindingContext): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  const [head, ...rest] = parts;
  let cursor: any;
  if (head === "order") cursor = ctx.order ?? {};
  else cursor = (ctx.shared ?? {}) as any;

  const chain = head === "order" ? rest : parts;
  for (const seg of chain) {
    if (cursor == null) return undefined;
    cursor = cursor[seg];
  }
  return cursor;
}

/** Ersetzt alle `{{path}}` Tokens im String. */
export function renderBindingString(tpl: string, ctx: BindingContext): string {
  return tpl.replace(TOKEN_RE, (_m, path) => {
    const v = resolveBindingPath(path, ctx);
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

/** Rekursive Auflösung eines Binding-Baums (Objekte/Arrays/Strings). */
export function renderBindings<T>(value: T, ctx: BindingContext): T {
  if (typeof value === "string") return renderBindingString(value, ctx) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => renderBindings(v, ctx)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = renderBindings(v, ctx);
    return out as unknown as T;
  }
  return value;
}

/** Flacht `shared_data` in eine Liste (stepKey, fieldKey, value) für Tabellenansichten. */
export function flattenSharedData(shared: SharedData): Array<{ stepKey: string; fieldKey: string; value: unknown }> {
  const rows: Array<{ stepKey: string; fieldKey: string; value: unknown }> = [];
  for (const [stepKey, stepData] of Object.entries(shared ?? {})) {
    if (stepData && typeof stepData === "object" && !Array.isArray(stepData)) {
      for (const [fieldKey, value] of Object.entries(stepData as Record<string, unknown>)) {
        rows.push({ stepKey, fieldKey, value });
      }
    } else {
      rows.push({ stepKey, fieldKey: "", value: stepData });
    }
  }
  return rows;
}
