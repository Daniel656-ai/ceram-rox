/**
 * Zentrale Definition der auftragsspezifischen Probenparameter (globale Auftragsvariablen).
 * Diese Werte stehen allen Formularen, Workflows, Berichten und Auswertungen zur Verfügung.
 */

export const SAMPLE_CATEGORIES = [
  "dieselkatalysator",
  "stationaerer_katalysator",
  "plattenkatalysator",
  "marinekatalysator",
  "heat_media",
] as const;

export type SampleCategory = (typeof SAMPLE_CATEGORIES)[number];

/** Kategorien ohne V2O5-Anteil: Feld wird automatisch auf 0,00 % gesetzt. */
export const CATEGORIES_WITHOUT_V2O5: string[] = ["heat_media"];

export function categoryHasV2O5(category?: string | null): boolean {
  if (!category) return true;
  return !CATEGORIES_WITHOUT_V2O5.includes(category);
}

export interface SampleParameters {
  category: string;
  v2o5_content: string;
  operating_hours: string;
  is_used_catalyst: boolean;
  raw_material_id: string;
  raw_material_code: string;
  lot_number: string;
  bigbag_number: string;
}

export const EMPTY_SAMPLE_PARAMETERS: SampleParameters = {
  category: "",
  v2o5_content: "",
  operating_hours: "",
  is_used_catalyst: false,
  raw_material_id: "",
  raw_material_code: "",
  lot_number: "",
  bigbag_number: "",
};

/** Wandelt die Formularwerte in DB-taugliche Werte um. */
export function sampleParametersToPayload(p: SampleParameters) {
  const hasV2O5 = categoryHasV2O5(p.category);
  const v2o5 = hasV2O5 ? (p.v2o5_content === "" ? null : Number(p.v2o5_content)) : 0;
  return {
    category: p.category || null,
    v2o5_content: v2o5 === null || isNaN(v2o5 as number) ? null : v2o5,
    operating_hours: p.operating_hours === "" ? null : Math.trunc(Number(p.operating_hours)) || 0,
    is_used_catalyst: !!p.is_used_catalyst,
    raw_material_id: p.raw_material_id || null,
    raw_material_code: p.raw_material_code.trim() || null,
    lot_number: p.lot_number.trim() || null,
    bigbag_number: p.bigbag_number.trim() || null,
  };
}

/* ------------------------------------------------------------------ */
/* Automatische Schlagworterzeugung aus der Beschreibung               */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "der","die","das","den","dem","des","ein","eine","einer","eines","einem","einen",
  "und","oder","mit","ohne","von","vom","für","fuer","auf","aus","bei","zum","zur",
  "im","in","an","am","als","ist","sind","war","wird","werden","nach","über","ueber",
  "the","and","with","for","from","this","that","was","are","has","have",
]);

/** Fachbegriffe, die zusätzlich als Schlagwort erkannt werden. */
const DOMAIN_TERMS: Array<{ match: RegExp; tag: string }> = [
  { match: /\bscr\b/i, tag: "SCR" },
  { match: /\bdeno?x\b/i, tag: "DeNOx" },
  { match: /v\s?2\s?o\s?5|v₂o₅|vanadium/i, tag: "V₂O₅" },
  { match: /katalysator|catalyst/i, tag: "Katalysator" },
  { match: /diesel/i, tag: "Dieselkatalysator" },
  { match: /platte|plate/i, tag: "Plattenkatalysator" },
  { match: /marine/i, tag: "Marinekatalysator" },
  { match: /station/i, tag: "Stationärer Katalysator" },
  { match: /heat\s?media/i, tag: "Heat Media" },
  { match: /gebraucht|used/i, tag: "gebraucht" },
  { match: /wabe|honeycomb/i, tag: "Wabe" },
  { match: /pulver|powder/i, tag: "Pulver" },
];

/**
 * Erzeugt Schlagwörter aus einem Beschreibungstext.
 * Kombination aus Fachbegriff-Erkennung und relevanten Einzelwörtern.
 */
export function generateTagsFromDescription(description: string, max = 8): string[] {
  const text = (description || "").trim();
  if (!text) return [];

  const tags: string[] = [];
  const push = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
  };

  for (const { match, tag } of DOMAIN_TERMS) {
    if (match.test(text)) push(tag);
  }

  const words = text
    .split(/[^\p{L}\p{N}₂₅äöüÄÖÜß-]+/u)
    .map((w) => w.replace(/^[-]+|[-]+$/g, ""))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));

  for (const w of words) {
    if (tags.length >= max) break;
    push(w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }

  return tags.slice(0, max);
}
