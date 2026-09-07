/**
 * Stabile Element-/Verbindungsschlüssel für den Messdatenimport.
 *
 * Grundprinzip: Die Zuordnung importierter Messwerte zu Ergebnisfeldern darf
 * niemals nur über die sichtbare Bezeichnung erfolgen. Jede erkennbare
 * chemische Bezeichnung (Formel, Trivialname, Elementname in DE/EN) wird auf
 * einen eindeutigen internen Schlüssel abgebildet, z. B.:
 *
 *   "SiO₂" | "SiO2" | "Silicon dioxide" | "Siliziumdioxid" | "Silica"  ->  "SiO2"
 *
 * Die Darstellung bleibt davon unberührt (tiefgestellte Zahlen etc.).
 * Das Modul ist generisch: es kennt keine Messfälle und keine Formulare.
 */

const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** Formel-Schreibweise vereinheitlichen: tiefgestellte Ziffern, Leerzeichen. */
function plainFormula(raw: string): string {
  return String(raw ?? "")
    .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)))
    .replace(/[_^{}]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** Vergleichsform eines Klartextnamens (sprachunabhängig, ohne Sonderzeichen). */
function plainWord(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Chemische Elemente (Symbol -> Namen DE/EN) für Reinelement-Angaben. */
const ELEMENTS: Record<string, string[]> = {
  H: ["hydrogen", "wasserstoff"], Li: ["lithium"], Be: ["beryllium"], B: ["boron", "bor"],
  C: ["carbon", "kohlenstoff"], N: ["nitrogen", "stickstoff"], O: ["oxygen", "sauerstoff"],
  F: ["fluorine", "fluor"], Na: ["sodium", "natrium"], Mg: ["magnesium"],
  Al: ["aluminium", "aluminum"], Si: ["silicon", "silizium", "silicium"],
  P: ["phosphorus", "phosphor"], S: ["sulfur", "sulphur", "schwefel"],
  Cl: ["chlorine", "chlor"], K: ["potassium", "kalium"], Ca: ["calcium", "kalzium"],
  Sc: ["scandium"], Ti: ["titanium", "titan"], V: ["vanadium", "vanadin"],
  Cr: ["chromium", "chrom"], Mn: ["manganese", "mangan"], Fe: ["iron", "eisen"],
  Co: ["cobalt", "kobalt"], Ni: ["nickel"], Cu: ["copper", "kupfer"], Zn: ["zinc", "zink"],
  Ga: ["gallium"], Ge: ["germanium"], As: ["arsenic", "arsen"], Se: ["selenium", "selen"],
  Br: ["bromine", "brom"], Rb: ["rubidium"], Sr: ["strontium"], Y: ["yttrium"],
  Zr: ["zirconium", "zirkonium", "zirkon"], Nb: ["niobium", "niob"],
  Mo: ["molybdenum", "molybdaen", "molybdan"], Ag: ["silver", "silber"], Cd: ["cadmium"],
  Sn: ["tin", "zinn"], Sb: ["antimony", "antimon"], Te: ["tellurium", "tellur"],
  I: ["iodine", "jod", "iod"], Cs: ["caesium", "cesium", "zaesium"], Ba: ["barium"],
  La: ["lanthanum", "lanthan"], Ce: ["cerium", "cer"], Hf: ["hafnium"],
  Ta: ["tantalum", "tantal"], W: ["tungsten", "wolfram"], Pt: ["platinum", "platin"],
  Au: ["gold"], Hg: ["mercury", "quecksilber"], Tl: ["thallium"], Pb: ["lead", "blei"],
  Bi: ["bismuth", "wismut"], Th: ["thorium"], U: ["uranium", "uran"],
};

/** Trivial-/Klartextnamen häufiger Oxide und Verbindungen -> Formel. */
const COMPOUND_NAMES: Record<string, string> = {
  silica: "SiO2", silicondioxide: "SiO2", siliciumdioxid: "SiO2", siliziumdioxid: "SiO2",
  quarz: "SiO2", quartz: "SiO2", kieselsaure: "SiO2",
  alumina: "Al2O3", aluminiumoxid: "Al2O3", aluminumoxide: "Al2O3", aluminiumoxide: "Al2O3",
  tonerde: "Al2O3",
  ironoxide: "Fe2O3", eisenoxid: "Fe2O3", ferricoxide: "Fe2O3", haematit: "Fe2O3",
  titania: "TiO2", titaniumdioxide: "TiO2", titandioxid: "TiO2",
  lime: "CaO", calciumoxide: "CaO", kalziumoxid: "CaO", calciumoxid: "CaO", branntkalk: "CaO",
  magnesia: "MgO", magnesiumoxide: "MgO", magnesiumoxid: "MgO",
  bariumoxide: "BaO", bariumoxid: "BaO",
  sodiumoxide: "Na2O", natriumoxid: "Na2O",
  potassiumoxide: "K2O", kaliumoxid: "K2O",
  sulfurtrioxide: "SO3", schwefeltrioxid: "SO3", sulphurtrioxide: "SO3",
  phosphoruspentoxide: "P2O5", phosphorpentoxid: "P2O5",
  vanadiumpentoxide: "V2O5", vanadiumpentoxid: "V2O5",
  tungstenoxide: "WO3", wolframoxid: "WO3", wolframtrioxid: "WO3",
  molybdenumoxide: "MoO3", molybdaenoxid: "MoO3", molybdantrioxid: "MoO3",
  zirconia: "ZrO2", zirkoniumdioxid: "ZrO2", zirkonoxid: "ZrO2",
  chromiumoxide: "Cr2O3", chromoxid: "Cr2O3",
  manganeseoxide: "MnO", manganoxid: "MnO",
  zincoxide: "ZnO", zinkoxid: "ZnO",
  loi: "LOI", gluehverlust: "LOI", glueverlust: "LOI", lossonignition: "LOI",
};

/** Kanonische Schreibweise einer chemischen Formel (Si O2 -> SiO2). */
function canonicalFormula(input: string): string | null {
  const f = plainFormula(input);
  if (!f || f.length > 24) return null;
  // Nur Formelzeichen zulassen: Buchstaben, Ziffern, Klammern, Punkte
  if (!/^[A-Za-z0-9().·*]+$/.test(f)) return null;

  const re = /([A-Z][a-z]?)(\d*)|(\(|\)|\d+|[.·*])/g;
  let out = "";
  let sawElement = false;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(f))) {
    consumed += m[0].length;
    if (m[1]) {
      if (!(m[1] in ELEMENTS) && !(m[1][0] in ELEMENTS)) return null;
      if (!(m[1] in ELEMENTS)) return null;
      sawElement = true;
      out += m[1] + (m[2] ?? "");
    } else if (m[3]) {
      out += m[3] === "·" || m[3] === "*" ? "." : m[3];
    }
  }
  if (!sawElement || consumed !== f.length) return null;
  return out;
}

/**
 * Schreibweise ohne Groß-/Kleinschreibung reparieren: "sio2" -> "SiO2".
 * Es wird greedy das längste bekannte Elementsymbol gelesen.
 */
function recase(input: string): string {
  const f = plainFormula(input);
  const symbols = Object.keys(ELEMENTS);
  let out = "";
  let i = 0;
  while (i < f.length) {
    const c = f[i];
    if (/[0-9().·*]/.test(c)) { out += c; i += 1; continue; }
    const two = f.slice(i, i + 2).toLowerCase();
    const one = c.toLowerCase();
    const m2 = symbols.find((s) => s.length === 2 && s.toLowerCase() === two);
    const m1 = symbols.find((s) => s.length === 1 && s.toLowerCase() === one);
    if (m2) { out += m2; i += 2; continue; }
    if (m1) { out += m1; i += 1; continue; }
    return f;
  }
  return out;
}

/**
 * Stabiler Element-/Verbindungsschlüssel einer beliebigen Bezeichnung.
 * Gibt `null` zurück, wenn es sich um keine chemische Bezeichnung handelt.
 */
export function elementKey(rawName: string): string | null {
  const raw = String(rawName ?? "").trim();
  if (!raw) return null;

  // 1) Klartext-/Trivialnamen (Silicon dioxide, Tonerde, Glühverlust …)
  const word = plainWord(raw);
  if (word && COMPOUND_NAMES[word]) return COMPOUND_NAMES[word];
  for (const [sym, names] of Object.entries(ELEMENTS)) {
    if (names.includes(word)) return sym;
  }

  // 2) Formelschreibweise (SiO₂, Fe2O3, As, Pb …)
  const formula = canonicalFormula(raw) ?? canonicalFormula(recase(raw));
  if (formula) return formula;

  return null;
}

/** Vergleichsschlüssel: Element-Key falls erkennbar, sonst null. */
export const sameElement = (a: string, b: string): boolean => {
  const ka = elementKey(a);
  const kb = elementKey(b);
  return !!ka && ka === kb;
};

/** Anzeige mit tiefgestellten Zahlen: "SiO2" -> "SiO₂". */
export function formatElementKey(key: string): string {
  return String(key ?? "").replace(/\d/g, (d) => SUB[Number(d)]);
}

/* ------------------------------------------------------------------ */
/* Element-Zuordnung eines Ergebnisfeldes                              */
/* ------------------------------------------------------------------ */

/**
 * Ein Ergebnisfeld kann einen fest hinterlegten Element-Schlüssel besitzen
 * (`metadata.element_key`). Ist keiner gepflegt, wird er aus Bezeichnung,
 * Ergebnis-Label oder Feldschlüssel abgeleitet. Die sichtbare Bezeichnung
 * bleibt frei formatierbar ("SiO₂") – die Zuordnung erfolgt über den Schlüssel.
 */
export interface ElementKeyFieldLike {
  metadata?: unknown;
  display_name?: string | null;
  result_label?: string | null;
  field_key?: string | null;
}

/** Ausschließlich der manuell konfigurierte Schlüssel (ohne Ableitung). */
export function explicitFieldElementKey(field: ElementKeyFieldLike): string | null {
  const m = (field?.metadata ?? {}) as Record<string, unknown>;
  const v = m.element_key;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Konfigurierter Schlüssel, sonst automatisch erkannter Schlüssel. */
export function fieldElementKey(field: ElementKeyFieldLike): string | null {
  const explicit = explicitFieldElementKey(field);
  if (explicit) return elementKey(explicit) ?? explicit;
  for (const cand of [field.display_name, field.result_label, field.field_key]) {
    if (!cand) continue;
    const k = elementKey(String(cand));
    if (k) return k;
  }
  return null;
}

/** Schreibt den Element-Schlüssel in die Feld-Metadaten (leer = entfernen). */
export function writeFieldElementKey(
  metadata: unknown,
  value: string | null | undefined
): Record<string, unknown> {
  const m = { ...((metadata ?? {}) as Record<string, unknown>) };
  const v = (value ?? "").trim();
  if (v) m.element_key = elementKey(v) ?? v;
  else delete m.element_key;
  return m;
}
