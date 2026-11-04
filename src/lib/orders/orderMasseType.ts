import { resolveOrderKind } from "./orderKind";
import { orderSamples, type OrderSampleSource } from "./orderSamples";

export const MASSE_TYPES = ["DK", "SK", "GK", "KK", "PK", "Heat Media", "MK", "OK"] as const;
export type MasseType = (typeof MASSE_TYPES)[number];
export type OrderMasseTypeSource = OrderSampleSource & Parameters<typeof resolveOrderKind>[0] & {
  pp_masse_type?: string | null;
  shared_form_data?: unknown;
};

const CATEGORY_TYPES: Record<string, MasseType> = {
  dieselkatalysator: "DK", dk: "DK",
  stationaerer_katalysator: "SK", sk: "SK",
  stationaerer_katalysator_gk: "GK", gk: "GK",
  stationaerer_katalysator_kk: "KK", kk: "KK",
  plattenkatalysator: "PK", pk: "PK",
  heat_media: "Heat Media", "heat media": "Heat Media",
  marinekatalysator: "MK", mk: "MK",
  oxidationskatalysator: "OK", ok: "OK",
};

function normalize(value: unknown): MasseType | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CATEGORY_TYPES, key) ? CATEGORY_TYPES[key] : undefined;
}

function read(root: unknown, path: string[]): unknown {
  let value = root;
  for (const key of path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Read-only display resolution: explicit sources only, no guessing or backfills. */
export function resolveOrderMasseType(order: OrderMasseTypeSource): MasseType[] {
  if (resolveOrderKind(order) === "pilot_plant") {
    const candidates = [
      order.pp_masse_type,
      read(order.shared_form_data, ["template", "values", "massetyp"]),
      read(order.shared_form_data, ["template", "values", "masse_type"]),
      read(order.shared_form_data, ["pp", "stammdaten", "massetyp"]),
      read(order.shared_form_data, ["pp", "stammdaten", "masse_type"]),
    ];
    for (const candidate of candidates) {
      const type = normalize(candidate);
      if (type) return [type];
    }
    return [];
  }
  const types = new Set(orderSamples(order).flatMap(sample => {
    const type = normalize(sample.category);
    return type ? [type] : [];
  }));
  return MASSE_TYPES.filter(type => types.has(type));
}

export function orderMasseTypeFilterValues(order: OrderMasseTypeSource): string[] {
  const types = resolveOrderMasseType(order);
  // SK needs its own token as well as the group token to stay independently selectable.
  return types.some(type => type === "GK" || type === "KK" || type === "SK")
    ? [...types, "stationaerer_katalysator"] : types;
}