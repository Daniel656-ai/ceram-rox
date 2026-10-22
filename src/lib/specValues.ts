/**
 * Gemeinsame, reine Wertformatierung der Auftraggeber-Vorgaben
 * (Bildschirm `OrderRequesterSpecs` und Laufzettel-Ausdrucke).
 * Interpretiert gespeicherte Werte nur für die Anzeige; ändert nichts.
 */
import { RAW_MATERIAL_ID_KEYS } from "@/lib/rawMaterials/displayLabel";

export const parseSpecValue = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try { return JSON.parse(s); } catch { return raw; }
  }
  return raw;
};

export const isEmptySpecValue = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

export const primSpecValue = (v: unknown): string => {
  if (v === true || v === "true") return "Ja";
  if (v === false || v === "false") return "Nein";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const label = o.label ?? o.name ?? o.display_name ?? o.value;
    if (label != null && typeof label !== "object") return String(label);
    return Object.entries(o).filter(([, x]) => !isEmptySpecValue(x)).map(([k, x]) => `${k}: ${primSpecValue(x)}`).join(", ");
  }
  return String(v);
};

export const specLabelOf = (name: string) => name.replace(/^repeat:/, "");

export const specColLabel = (c: string) => (RAW_MATERIAL_ID_KEYS.has(c) ? "Rohstoff" : c);

export type SpecValueShape =
  | { kind: "table"; cols: string[]; rows: Record<string, unknown>[] }
  | { kind: "list"; items: unknown[] }
  | { kind: "single"; value: unknown };

/** Struktur eines gespeicherten Werts: Tabelle (Liste von Objekten), Liste oder Einzelwert. */
export function specValueShape(raw: unknown): SpecValueShape {
  const v = parseSpecValue(raw);
  if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && !Array.isArray(x))) {
    const rows = v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__")))));
    return { kind: "table", cols, rows };
  }
  if (Array.isArray(v)) return { kind: "list", items: v.filter((x) => !isEmptySpecValue(x)) };
  return { kind: "single", value: v };
}
