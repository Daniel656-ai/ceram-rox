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
 * Entfernt Einheiten-Anhängsel einer Bezeichnung: „V2O5 (%)“ -> „V2O5“,
 * „As (PPM)“ -> „As“, „SiO2 %“ -> „SiO2“. Die Einheit ist niemals Bestandteil
 * des Elements und darf die Zuordnung nicht verhindern.
 */
function stripUnitSuffix(raw: string): string {
  let s = String(raw ?? "").trim();
  // Klammerausdruck am Ende: (%), [PPM], {mg/kg}
  const bracket = s.match(/^(.*\S)\s*[([{][^)\]}]*[)\]}]\s*$/);
  if (bracket) s = bracket[1].trim();
  // Angehängte Einheit ohne Klammern
  s = s.replace(/\s*(%|wt\.?%|ppm|ppb|ppt|mg\/kg|g\/kg|µg\/g|ug\/g|mg\/g)\s*$/i, "").trim();
  // Vorangestellte Einheit: „% V2O5“, „Gew.-% SiO2“, „ppm As“
  s = s
    .replace(/^\s*(?:gew\.?\s*-?\s*%|masse\s*-?\s*%|mass\s*-?\s*%|wt\.?\s*-?\s*%|%|ppm|ppb|ppt|mg\/kg|g\/kg|µg\/g|ug\/g|mg\/g)\s*[:.\-–]?\s*/i, "")
    .trim();
  return s.replace(/[:=]\s*$/, "").trim();
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

  // 3) Bezeichnung mit Einheit („V2O5 (%)“, „As (PPM)“) – Einheit entfernen
  const bare = stripUnitSuffix(raw);
  if (bare && bare !== raw) return elementKey(bare);

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

/* ------------------------------------------------------------------ */
/* Globale Elementbibliothek                                           */
/* ------------------------------------------------------------------ */

/**
 * Ein Eintrag der globalen Elementbibliothek. Die Bibliothek ist bewusst
 * unabhängig von Messfällen, Formularen und Unterkategorien: sie beschreibt
 * nur, WAS ein Messgerät liefern kann. Welche davon offizielle Ergebnisse
 * sind, entscheidet ausschließlich der jeweilige Messfall.
 */
export interface LibraryElement {
  /** Stabiler interner Schlüssel, z. B. "V2O5". */
  key: string;
  /** Anzeige mit tiefgestellten Zahlen, z. B. "V₂O₅". */
  label: string;
  group: "Oxide / Verbindungen" | "Elemente" | "Sonstige";
}

const COMPOUND_ORDER = [
  "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
  "SO3", "P2O5", "V2O5", "WO3", "MoO3", "ZrO2", "Cr2O3", "MnO", "ZnO",
];

/** Vollständige globale Elementbibliothek (Verbindungen + Reinelemente). */
export const elementLibrary: LibraryElement[] = (() => {
  const out: LibraryElement[] = [];
  const seen = new Set<string>();
  const push = (key: string, group: LibraryElement["group"]) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ key, label: formatElementKey(key), group });
  };
  for (const k of COMPOUND_ORDER) push(k, "Oxide / Verbindungen");
  for (const v of Object.values(COMPOUND_NAMES)) {
    if (v !== "LOI") push(v, "Oxide / Verbindungen");
  }
  for (const sym of Object.keys(ELEMENTS)) push(sym, "Elemente");
  push("LOI", "Sonstige");
  return out;
})();

/** Bibliothekseintrag zu einem Schlüssel (auch für freie Eingaben). */
export function libraryElement(key: string): LibraryElement {
  const k = elementKey(key) ?? String(key ?? "").trim();
  return (
    elementLibrary.find((e) => e.key === k) ?? {
      key: k,
      label: formatElementKey(k),
      group: "Sonstige",
    }
  );
}

/* ------------------------------------------------------------------ */
/* Elementbereiche (z. B. „B–U“ für die standardlose RFA)               */
/* ------------------------------------------------------------------ */

const SYMBOLS_BY_Z = (
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn " +
  "Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce " +
  "Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn " +
  "Fr Ra Ac Th Pa U"
).split(" ");

/** Ordnungszahl eines Elementsymbols (1 … 92), sonst null. */
export function atomicNumber(symbol: string): number | null {
  const i = SYMBOLS_BY_Z.indexOf(String(symbol ?? "").trim());
  return i >= 0 ? i + 1 : null;
}

/**
 * Leitelement eines Schlüssels: bei Verbindungen das erste Elementsymbol,
 * das nicht Sauerstoff ist („Na2O“ → „Na“, „V2O5“ → „V“, „As“ → „As“).
 * Nicht-chemische Schlüssel (z. B. „LOI“) liefern null.
 */
export function leadingElement(key: string): string | null {
  const k = elementKey(key) ?? String(key ?? "").trim();
  // Nur echte Formeln: jedes Buchstaben-Token muss ein Elementsymbol sein
  // („LOI“ ist keine Formel und liefert null).
  const syms: string[] = [];
  const re = /([A-Z][a-z]?)|([0-9().·*]+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(k))) {
    if (m[1]) {
      if (atomicNumber(m[1]) == null) return null;
      syms.push(m[1]);
    } else if (m[3]) return null;
  }
  if (!syms.length) return null;
  return syms.find((s) => s !== "O" && s !== "H") ?? syms[0];
}

export interface ElementRange {
  from: number;
  to: number;
  fromSymbol: string;
  toSymbol: string;
}

/** Liest einen Elementbereich („B-U“, „B–U“, „Na … U“); ungültig = null. */
export function parseElementRange(raw: string | null | undefined): ElementRange | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z]{1,2})\s*(?:-|–|—|…|\.\.\.?|bis|to)\s*([A-Za-z]{1,2})$/i);
  if (!m) return null;
  const a = SYMBOLS_BY_Z.find((x) => x.toLowerCase() === m[1].toLowerCase());
  const b = SYMBOLS_BY_Z.find((x) => x.toLowerCase() === m[2].toLowerCase());
  if (!a || !b) return null;
  const za = atomicNumber(a) as number;
  const zb = atomicNumber(b) as number;
  return za <= zb
    ? { from: za, to: zb, fromSymbol: a, toSymbol: b }
    : { from: zb, to: za, fromSymbol: b, toSymbol: a };
}

/** Liegt ein Element-/Verbindungsschlüssel im Bereich (über das Leitelement)? */
export function elementInRange(key: string, range: ElementRange | null | undefined): boolean {
  if (!range) return false;
  const lead = leadingElement(key);
  const z = lead ? atomicNumber(lead) : null;
  return z != null && z >= range.from && z <= range.to;
}

/** Sortierwert für Bereichsergebnisse: Ordnungszahl des Leitelements, dann Schlüssel. */
export function elementSortValue(key: string): number {
  const lead = leadingElement(key);
  return (lead ? atomicNumber(lead) : null) ?? 999;
}
