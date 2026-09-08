/**
 * Vorgabensätze: reine Umwandlungs-/Diagnosefunktionen ohne Browser-Abhängigkeiten
 * (testbar ohne PDF-Werkzeuge).
 */
import type { ProductionReleaseSpecSet, ProductionReleaseSpecValue } from "@/lib/api/productionReleases";
import {
  releaseTypeDef, matchParameterKey, slugParameterKey, parseSpecNumber, subscriptFormula,
} from "./releaseTypes";

function asText(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Rohe Vorgabensätze der Erkennung in die gespeicherte Struktur überführen.
 * Unsichere Werte werden markiert – nie stillschweigend als sicher übernommen.
 */
export function normalizeSpecSets(
  raw: Record<string, unknown>[],
  releaseType: string
): ProductionReleaseSpecSet[] {
  const type = releaseTypeDef(releaseType);
  const order = new Map(type.parameters.map((p, i) => [p.key, i]));
  const out: ProductionReleaseSpecSet[] = [];
  for (const [i, s] of raw.entries()) {
    const params = Array.isArray(s.parameters) ? (s.parameters as Record<string, unknown>[]) : [];
    const values: ProductionReleaseSpecValue[] = [];
    for (const p of params) {
      const rawKey = asText(p.key);
      const rawLabel = asText(p.label);
      const def = matchParameterKey(type, rawKey) ?? (rawLabel ? matchParameterKey(type, rawLabel) : null);
      const key = def?.key ?? slugParameterKey(rawKey || rawLabel);
      const valueText = asText(p.value);
      if (!valueText) continue;
      const conf = (["high", "medium", "low"].includes(asText(p.confidence)) ? asText(p.confidence) : "low") as
        ProductionReleaseSpecValue["confidence"];
      const unit = asText(p.unit) || def?.defaultUnit || null;
      values.push({
        parameter_key: key,
        parameter_label: def?.labelDe ?? subscriptFormula(rawLabel || rawKey),
        value_text: valueText,
        value_num: parseSpecNumber(valueText),
        unit: unit === "" ? null : unit,
        confidence: conf,
        needs_review: conf !== "high" || !def,
      });
    }
    if (!values.length) continue;
    values.sort((a, b) => (order.get(a.parameter_key) ?? 999) - (order.get(b.parameter_key) ?? 999));
    values.forEach((v, j) => { v.sort_order = j; });
    out.push({
      release_type: releaseType,
      label: asText(s.label) || `${type.setLabelDe} ${i + 1}`,
      sort_order: i,
      source_type: "pdf",
      page: typeof s.page === "number" ? s.page : null,
      values,
    });
  }
  return out;
}

/** Verständliche, aber vollständige Beschreibung eines Speicherfehlers. */
export function describeSaveError(e: unknown): string {
  if (e instanceof Error) return e.message || "Unbekannte Ursache.";
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown; step?: unknown };
    const parts = [
      o.step ? `Schritt: ${String(o.step)}` : "",
      o.message ? String(o.message) : "",
      o.details ? `Details: ${String(o.details)}` : "",
      o.hint ? `Hinweis: ${String(o.hint)}` : "",
      o.code ? `Fehlercode: ${String(o.code)}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" – ");
  }
  if (typeof e === "string" && e.trim()) return e;
  return "Unbekannte Ursache.";
}
