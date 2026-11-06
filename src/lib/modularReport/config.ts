/**
 * Modularer Ergebnisbericht – Konfiguration (rein, ohne Seiteneffekte).
 *
 * Eine Konfiguration beschreibt ausschließlich Struktur und Redaktion:
 * Modulreihenfolge, Sichtbarkeit, Überschriften und zweisprachige
 * Standardtexte. Auftrags-, Proben- oder Ergebnisdaten sind hier nie
 * enthalten – sie werden immer aus dem aktuell geöffneten Auftrag geladen.
 */

export const REPORT_LANGUAGES = ["de", "en"] as const;
export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

export const MODULE_KEYS = [
  "cover",
  "objective",
  "samples",
  "requester_specs",
  "activity",
  "chemical",
  "optical",
  "assessment",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type Bilingual = { de: string; en: string };

export interface ModuleConfig {
  key: ModuleKey;
  visible: boolean;
  /** Eigene Überschrift je Sprache; leer = übersetzte Standardüberschrift. */
  heading: Bilingual;
  /** Wiederverwendbarer Standardtext, getrennt je Sprache gepflegt. */
  standardText: Bilingual;
}

export interface ReportLayout {
  version: 1;
  modules: ModuleConfig[];
}

const emptyBi = (): Bilingual => ({ de: "", en: "" });

export function defaultLayout(): ReportLayout {
  return {
    version: 1,
    modules: MODULE_KEYS.map((key) => ({ key, visible: true, heading: emptyBi(), standardText: emptyBi() })),
  };
}

const isModuleKey = (v: unknown): v is ModuleKey => typeof v === "string" && (MODULE_KEYS as readonly string[]).includes(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const bi = (v: unknown): Bilingual => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { de: str(o.de), en: str(o.en) };
};

/**
 * Bereinigt eine (evtl. fremde/alte) Layout-Struktur: nur bekannte Felder,
 * jedes Modul genau einmal, fehlende Module ausgeblendet ans Ende.
 * Unbekannte Felder (z. B. versehentlich gespeicherte Daten) werden verworfen.
 */
export function sanitizeLayout(input: unknown): ReportLayout {
  const raw = (input && typeof input === "object" ? (input as any).modules : null) as unknown;
  if (!Array.isArray(raw)) return defaultLayout();
  const seen = new Set<ModuleKey>();
  const modules: ModuleConfig[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object" || !isModuleKey((m as any).key) || seen.has((m as any).key)) continue;
    const key = (m as any).key as ModuleKey;
    seen.add(key);
    modules.push({ key, visible: (m as any).visible !== false, heading: bi((m as any).heading), standardText: bi((m as any).standardText) });
  }
  for (const key of MODULE_KEYS) {
    if (!seen.has(key)) modules.push({ key, visible: false, heading: emptyBi(), standardText: emptyBi() });
  }
  return { version: 1, modules };
}

export function moveModule(layout: ReportLayout, from: number, to: number): ReportLayout {
  const modules = [...layout.modules];
  if (from < 0 || from >= modules.length || to < 0 || to >= modules.length) return layout;
  const [m] = modules.splice(from, 1);
  modules.splice(to, 0, m);
  return { ...layout, modules };
}

export function updateModule(layout: ReportLayout, key: ModuleKey, patch: Partial<Omit<ModuleConfig, "key">>): ReportLayout {
  return { ...layout, modules: layout.modules.map((m) => (m.key === key ? { ...m, ...patch } : m)) };
}

export const visibleModules = (layout: ReportLayout) => layout.modules.filter((m) => m.visible);

/** Auftragsspezifischer Entwurf (gespeichert in order_reports.draft_overrides.modular_report). */
export interface OrderReportDraft {
  version: 1;
  lang: ReportLanguage;
  layout: ReportLayout;
  /** Einsprachige, auftragsspezifische Texte je Modul – werden nie übersetzt. */
  orderTexts: Partial<Record<ModuleKey, string>>;
  reportTitle: string;
  author: string;
}

export function defaultDraft(): OrderReportDraft {
  return { version: 1, lang: "de", layout: defaultLayout(), orderTexts: {}, reportTitle: "", author: "" };
}

/** Nur redaktionelle Felder – keine Messwerte oder Ergebnisdaten. */
export function sanitizeDraft(input: unknown): OrderReportDraft {
  if (!input || typeof input !== "object") return defaultDraft();
  const o = input as Record<string, unknown>;
  const texts: Partial<Record<ModuleKey, string>> = {};
  const rawTexts = (o.orderTexts && typeof o.orderTexts === "object" ? o.orderTexts : {}) as Record<string, unknown>;
  for (const k of MODULE_KEYS) if (typeof rawTexts[k] === "string" && rawTexts[k]) texts[k] = rawTexts[k] as string;
  return {
    version: 1,
    lang: o.lang === "en" ? "en" : "de",
    layout: sanitizeLayout(o.layout),
    orderTexts: texts,
    reportTitle: str(o.reportTitle),
    author: str(o.author),
  };
}
