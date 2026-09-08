/**
 * Fertigungsfreigabe-Typen (Registry).
 *
 * Jeder Typ bringt sein eigenes Vorgaben-Schema mit. Das übrige
 * Fertigungsfreigabe-Modul (Kopfdaten, Revisionen, PDF-Import) ist typ-
 * unabhängig und liest alles Typ-Spezifische ausschließlich aus dieser Datei.
 *
 * Neue Typen (z. B. Plattenkatalysator) werden hier als weiterer Eintrag
 * ergänzt – das NOx-Datenmodell bleibt davon unberührt.
 */

export const DEFAULT_RELEASE_TYPE = "nox_aktivitaetsmessung";

/** Ein Parameter eines Vorgabensatzes (Wert und Einheit getrennt). */
export interface SpecParameterDef {
  key: string;
  /** Anzeigename – chemische Formeln mit Unicode-Tiefstellung */
  labelDe: string;
  labelEn: string;
  /** Standard-Einheit, falls die Freigabe keine nennt ("" = einheitenlos) */
  defaultUnit: string;
  /** Aliasse, wie sie in Freigaben vorkommen (klein geschrieben) */
  aliases: string[];
}

export interface ReleaseTypeDef {
  key: string;
  labelDe: string;
  labelEn: string;
  /** Bezeichnung eines Vorgabensatzes, z. B. „Messpunkt" */
  setLabelDe: string;
  parameters: SpecParameterDef[];
}

/** NOx – Aktivitätsmessung: Parameterkatalog. Reihenfolge = Anzeige. */
const NOX_PARAMETERS: SpecParameterDef[] = [
  { key: "temperature", labelDe: "Temperatur", labelEn: "Temperature", defaultUnit: "°C", aliases: ["temperatur", "temperature", "temp", "t"] },
  { key: "av", labelDe: "AV", labelEn: "AV", defaultUnit: "m/h", aliases: ["av", "area velocity"] },
  { key: "sv", labelDe: "SV", labelEn: "SV", defaultUnit: "1/h", aliases: ["sv", "space velocity", "raumgeschwindigkeit"] },
  { key: "flowrate", labelDe: "Flowrate", labelEn: "Flowrate", defaultUnit: "Nm³/h", aliases: ["flowrate", "flow rate", "durchfluss", "volumenstrom"] },
  { key: "fr", labelDe: "FR", labelEn: "FR", defaultUnit: "", aliases: ["fr"] },
  { key: "no_concentration", labelDe: "NO-Konzentration", labelEn: "NO concentration", defaultUnit: "ppm", aliases: ["no-konzentration", "no konzentration", "no concentration", "no_concentration"] },
  { key: "no", labelDe: "NO", labelEn: "NO", defaultUnit: "ppm", aliases: ["no"] },
  { key: "nox", labelDe: "NOₓ", labelEn: "NOx", defaultUnit: "ppm", aliases: ["nox"] },
  { key: "nh3", labelDe: "NH₃", labelEn: "NH3", defaultUnit: "ppm", aliases: ["nh3", "nh₃", "ammoniak"] },
  { key: "alpha", labelDe: "α", labelEn: "alpha", defaultUnit: "-", aliases: ["alpha", "α", "a", "nh3/no", "nh3/nox"] },
  { key: "h2o", labelDe: "H₂O", labelEn: "H2O", defaultUnit: "%", aliases: ["h2o", "h₂o", "wasser", "water"] },
  { key: "o2", labelDe: "O₂", labelEn: "O2", defaultUnit: "%", aliases: ["o2", "o₂", "sauerstoff", "oxygen"] },
  { key: "target_k", labelDe: "Soll K", labelEn: "Target K", defaultUnit: "m/h", aliases: ["soll k", "soll-k", "k soll", "target k", "target_k", "k"] },
];

export const RELEASE_TYPES: ReleaseTypeDef[] = [
  {
    key: DEFAULT_RELEASE_TYPE,
    labelDe: "NOx – Aktivitätsmessung",
    labelEn: "NOx – activity measurement",
    setLabelDe: "Vorgabensatz",
    parameters: NOX_PARAMETERS,
  },
];

export const RELEASE_TYPE_BY_KEY: Record<string, ReleaseTypeDef> = Object.fromEntries(
  RELEASE_TYPES.map((t) => [t.key, t])
);

export function releaseTypeDef(key: string | null | undefined): ReleaseTypeDef {
  return RELEASE_TYPE_BY_KEY[key ?? ""] ?? RELEASE_TYPE_BY_KEY[DEFAULT_RELEASE_TYPE];
}

export function releaseTypeLabel(key: string | null | undefined): string {
  return releaseTypeDef(key).labelDe;
}

/** Erkannter Typ aus der KI-Antwort – unbekannte Typen fallen auf den Standard zurück. */
export function normalizeReleaseType(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (RELEASE_TYPE_BY_KEY[s]) return s;
  if (/nox|aktivit|activity|deno/.test(s)) return DEFAULT_RELEASE_TYPE;
  return DEFAULT_RELEASE_TYPE;
}

/** Tiefstellung für chemische Formeln (NOx, NH3, O2, H2O, SO2 …). */
export function subscriptFormula(label: string): string {
  const sub: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", x: "ₓ" };
  return label
    .replace(/\bNOx\b/g, "NOₓ")
    .replace(/\b([A-Z][a-z]?)(\d)(?=[A-Z\b\s,/()-]|$)/g, (_m, el: string, d: string) => `${el}${sub[d] ?? d}`)
    .replace(/\b(N|H|S|C)(H|O|O)(\d)\b/g, (_m, a: string, b: string, d: string) => `${a}${b}${sub[d] ?? d}`);
}

/** Ordnet eine Bezeichnung aus dem Dokument einem Parameter des Typs zu. */
export function matchParameterKey(type: ReleaseTypeDef, raw: string): SpecParameterDef | null {
  const s = raw.trim().toLowerCase().replace(/[₀-₉]/g, (c) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(c))).replace(/ₓ/g, "x");
  if (!s) return null;
  const direct = type.parameters.find((p) => p.key === s);
  if (direct) return direct;
  return type.parameters.find((p) => p.aliases.includes(s)) ?? null;
}

/** Technischer Schlüssel für einen nicht im Katalog geführten Parameter. */
export function slugParameterKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "sonstiges";
}

export function parameterLabel(type: ReleaseTypeDef, key: string, fallback?: string | null): string {
  return type.parameters.find((p) => p.key === key)?.labelDe ?? subscriptFormula(fallback || key);
}

/** Zahl aus einem Dokumentwert lesen (deutsch/englisch); null = keine Zahl. */
export function parseSpecNumber(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/[-+]?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|[-+]?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  let t = m[0].replace(/\s/g, "");
  if (/,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, "");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Anzeige „205 °C", „1,2 Nm³/h", „α 1,2". */
export function formatSpecValue(v: { value_num?: number | null; value_text?: string | null; unit?: string | null }): string {
  const unit = (v.unit ?? "").trim();
  const num = v.value_num;
  const text = num !== null && num !== undefined
    ? num.toLocaleString("de-AT", { maximumFractionDigits: 4 })
    : (v.value_text ?? "").trim();
  if (!text) return "–";
  if (!unit || unit === "-") return text;
  return `${text} ${unit}`;
}
