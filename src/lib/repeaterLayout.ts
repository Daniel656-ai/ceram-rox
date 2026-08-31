/**
 * Layout-Schema für die Unterfelder eines Repeaters.
 *
 * Wird in `metadata.repeater.layout` gespeichert – sowohl bei lokalen
 * Formularfeldern (`form_fields`) als auch bei globalen Feldern
 * (`global_fields`). Dadurch nutzt jedes Formular, das denselben globalen
 * Repeater referenziert, automatisch dieselbe Darstellung.
 */

export type RepeaterGap = "sm" | "md" | "lg";

export interface RepeaterFieldItem {
  id: string;
  type: "field";
  /** field_key des Unterfeldes */
  key: string;
  width: number; // 1..12
}
export interface RepeaterHeadingItem {
  id: string;
  type: "heading";
  text: string;
  width: number;
}
export interface RepeaterSpacerItem {
  id: string;
  type: "spacer";
  width: number;
}
/**
 * Berechnung innerhalb eines Eintrags (Messpunkt). Verweist auf eine lokale
 * Berechnung des Formulars (`form_calculations.calc_key`). Die Formel wird
 * EINMAL definiert und je Eintrag mit dessen eigenen Werten ausgewertet.
 */
export interface RepeaterCalcItem {
  id: string;
  type: "calculation";
  calc_key: string;
  width: number;
  label_override?: string | null;
}
export interface RepeaterBreakItem {
  id: string;
  type: "break";
}
export type RepeaterLeafItem =
  | RepeaterFieldItem
  | RepeaterHeadingItem
  | RepeaterSpacerItem
  | RepeaterBreakItem
  | RepeaterCalcItem;

export interface RepeaterGroupItem {
  id: string;
  type: "group";
  title: string;
  width: number;
  children: RepeaterLeafItem[];
}

export type RepeaterLayoutItem = RepeaterLeafItem | RepeaterGroupItem;

export interface RepeaterLayout {
  version: 1;
  gap: RepeaterGap;
  items: RepeaterLayoutItem[];
}

export const REPEATER_WIDTHS: { value: number; label: string }[] = [
  { value: 12, label: "Volle Breite (12/12)" },
  { value: 9, label: "3/4 (9/12)" },
  { value: 8, label: "2/3 (8/12)" },
  { value: 6, label: "1/2 (6/12)" },
  { value: 4, label: "1/3 (4/12)" },
  { value: 3, label: "1/4 (3/12)" },
  { value: 2, label: "1/6 (2/12)" },
];

/** Statische Tailwind-Klassen (kein dynamisches Konkatenieren!). */
export const repeaterWidthClass = (w?: number): string => {
  switch (Math.max(1, Math.min(12, Math.round(w ?? 12)))) {
    case 1: return "col-span-12 md:col-span-1";
    case 2: return "col-span-12 md:col-span-2";
    case 3: return "col-span-6 md:col-span-3";
    case 4: return "col-span-6 md:col-span-4";
    case 5: return "col-span-12 md:col-span-5";
    case 6: return "col-span-12 md:col-span-6";
    case 7: return "col-span-12 md:col-span-7";
    case 8: return "col-span-12 md:col-span-8";
    case 9: return "col-span-12 md:col-span-9";
    case 10: return "col-span-12 md:col-span-10";
    case 11: return "col-span-12 md:col-span-11";
    default: return "col-span-12";
  }
};

export const repeaterGapClass = (gap?: RepeaterGap): string =>
  gap === "sm" ? "gap-1.5" : gap === "lg" ? "gap-5" : "gap-3";

export const newItemId = () => Math.random().toString(36).slice(2, 10);

export const emptyRepeaterLayout = (): RepeaterLayout => ({ version: 1, gap: "md", items: [] });

const isLeaf = (t: string) => ["field", "heading", "spacer", "break", "calculation"].includes(t);

/** Alle im Layout referenzierten Berechnungsschlüssel. */
export const collectLayoutCalcKeys = (layout: RepeaterLayout): string[] => {
  const out: string[] = [];
  for (const it of layout.items) {
    if (it.type === "calculation") out.push(it.calc_key);
    if (it.type === "group") for (const c of it.children) if (c.type === "calculation") out.push(c.calc_key);
  }
  return out;
};

/** Alle im Layout referenzierten Unterfeld-Keys. */
export const collectLayoutFieldKeys = (layout: RepeaterLayout): string[] => {
  const out: string[] = [];
  for (const it of layout.items) {
    if (it.type === "field") out.push(it.key);
    if (it.type === "group") for (const c of it.children) if (c.type === "field") out.push(c.key);
  }
  return out;
};

/**
 * Layout robust einlesen: unbekannte Unterfelder entfernen, fehlende
 * Unterfelder am Ende ergänzen. So bleibt das Layout immer konsistent
 * mit der aktuellen Unterfeld-Definition.
 */
export function normalizeRepeaterLayout(
  raw: unknown,
  availableKeys: string[],
  /** Bekannte Berechnungsschlüssel; ohne Angabe bleiben alle erhalten. */
  availableCalcKeys?: string[],
): RepeaterLayout {
  const base = emptyRepeaterLayout();
  const src = (raw && typeof raw === "object" ? (raw as any) : {}) as Partial<RepeaterLayout>;
  const gap: RepeaterGap = src.gap === "sm" || src.gap === "lg" ? src.gap : "md";
  const known = new Set(availableKeys);
  const seen = new Set<string>();

  const cleanLeaf = (it: any): RepeaterLeafItem | null => {
    if (!it || typeof it !== "object" || !isLeaf(it.type)) return null;
    const id = typeof it.id === "string" && it.id ? it.id : newItemId();
    if (it.type === "break") return { id, type: "break" };
    const width = typeof it.width === "number" ? Math.max(1, Math.min(12, it.width)) : 12;
    if (it.type === "heading") return { id, type: "heading", text: String(it.text ?? "Überschrift"), width };
    if (it.type === "spacer") return { id, type: "spacer", width };
    if (it.type === "calculation") {
      const ck = String(it.calc_key ?? "");
      if (!ck) return null;
      if (availableCalcKeys && !availableCalcKeys.includes(ck)) return null;
      return {
        id, type: "calculation", calc_key: ck, width,
        label_override: typeof it.label_override === "string" ? it.label_override : null,
      };
    }
    const key = String(it.key ?? "");
    if (!known.has(key) || seen.has(key)) return null;
    seen.add(key);
    return { id, type: "field", key, width: typeof it.width === "number" ? Math.max(1, Math.min(12, it.width)) : 6 };
  };

  const items: RepeaterLayoutItem[] = [];
  for (const it of Array.isArray(src.items) ? src.items : []) {
    if ((it as any)?.type === "group") {
      const g = it as RepeaterGroupItem;
      items.push({
        id: typeof g.id === "string" && g.id ? g.id : newItemId(),
        type: "group",
        title: String(g.title ?? "Gruppe"),
        width: typeof g.width === "number" ? Math.max(1, Math.min(12, g.width)) : 12,
        children: (Array.isArray(g.children) ? g.children : []).map(cleanLeaf).filter(Boolean) as RepeaterLeafItem[],
      });
      continue;
    }
    const leaf = cleanLeaf(it);
    if (leaf) items.push(leaf);
  }

  // Fehlende Unterfelder anhängen (Standardbreite 1/2)
  for (const k of availableKeys) {
    if (!seen.has(k)) items.push({ id: newItemId(), type: "field", key: k, width: 6 });
  }

  return { ...base, gap, items };
}

/** True, wenn tatsächlich ein individuelles Layout gespeichert wurde. */
export const hasRepeaterLayout = (raw: unknown): boolean =>
  !!raw && typeof raw === "object" && Array.isArray((raw as any).items) && (raw as any).items.length > 0;
