/**
 * ROX Rich-Text (Hoch-/Tiefstellung)
 * ==================================
 *
 * ROX speichert Bezeichnungen, Einheiten, Beschreibungen usw. als reine
 * Textspalten. Damit Hoch- und Tiefstellung persistiert werden kann — und zwar
 * auch für Zeichen, für die es KEIN Unicode-Sub/Superscript gibt (z. B. „x" in
 * NOₓ) — wird eine schlanke, rückwärtskompatible Inline-Auszeichnung im selben
 * Textfeld gespeichert:
 *
 *    _{...}   tiefgestellt   →  Al_{2}O_{3}   ⇒  Al₂O₃
 *    ^{...}   hochgestellt   →  m^{2}/g       ⇒  m²/g
 *
 * Eigenschaften:
 *  - Abwärtskompatibel: Text ohne Auszeichnung bleibt unverändert (auch bereits
 *    vorhandene Unicode-Zeichen wie „²" funktionieren weiter).
 *  - Eine einzige Formatierungslogik für Editor, Anzeige, Ergebnisdatenbank,
 *    Bericht, PDF und Export — keine parallelen Systeme.
 *  - Für Suche, Sortierung, Feldschlüssel und Exporte gibt es klar getrennte
 *    Textformen: `toPlain()` (ohne Auszeichnung) bzw. `toUnicode()`.
 */

export type RichVariant = "normal" | "sub" | "sup";

export interface RichSegment {
  text: string;
  variant: RichVariant;
}

interface RichChar {
  ch: string;
  variant: RichVariant;
}

const OPEN: Record<"sub" | "sup", string> = { sub: "_{", sup: "^{" };

/** Enthält der Text eine Hoch-/Tiefstellungs-Auszeichnung? */
export function hasRichMarkup(input: string | null | undefined): boolean {
  if (!input) return false;
  return /[_^]\{[^}]*\}/.test(input);
}

/** Zerlegt ausgezeichneten Text in Segmente (für die Anzeige). */
export function parseRichText(input: string | null | undefined): RichSegment[] {
  const s = input ?? "";
  if (!s) return [];
  const out: RichSegment[] = [];
  const re = /([_^])\{([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), variant: "normal" });
    if (m[2].length > 0) out.push({ text: m[2], variant: m[1] === "_" ? "sub" : "sup" });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last), variant: "normal" });
  return out;
}

/**
 * Reiner Text ohne Auszeichnung — für Suche, Sortierung, Feldschlüssel,
 * Vergleiche und alle Stellen, die den technischen Wert brauchen.
 */
export function toPlain(input: string | null | undefined): string {
  if (!input) return "";
  return parseRichText(input).map((s) => s.text).join("");
}

const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ",
  p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ", β: "ᵦ", γ: "ᵧ", ρ: "ᵨ", φ: "ᵩ", χ: "ᵪ",
};

const SUP_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ",
  l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ",
  x: "ˣ", y: "ʸ", z: "ᶻ", A: "ᴬ", B: "ᴮ", D: "ᴰ", E: "ᴱ", G: "ᴳ", H: "ᴴ", I: "ᴵ", J: "ᴶ",
  K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ", O: "ᴼ", P: "ᴾ", R: "ᴿ", T: "ᵀ", U: "ᵁ", V: "ⱽ", W: "ᵂ",
  β: "ᵝ", γ: "ᵞ", δ: "ᵟ", θ: "ᶿ", φ: "ᵠ", χ: "ᵡ",
};

/**
 * Textform mit Unicode-Sub/Superscript — für Umgebungen ohne HTML
 * (PDF-Ausgabe, CSV/Excel-Export, Klartext-Kopien). Zeichen ohne passendes
 * Unicode-Äquivalent bleiben unverändert, gehen also nie verloren.
 */
export function toUnicode(input: string | null | undefined): string {
  if (!input) return "";
  return parseRichText(input)
    .map((seg) => {
      if (seg.variant === "normal") return seg.text;
      const map = seg.variant === "sub" ? SUB_MAP : SUP_MAP;
      return [...seg.text].map((c) => map[c] ?? c).join("");
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Editor-Operationen
// ---------------------------------------------------------------------------

/** Zerlegt den Rohtext zeichenweise inkl. Variante und Rohtext-Position. */
function toChars(raw: string): { chars: RichChar[]; rawIndexOfChar: number[] } {
  const chars: RichChar[] = [];
  const rawIndexOfChar: number[] = [];
  const re = /([_^])\{([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushPlain = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      chars.push({ ch: raw[i], variant: "normal" });
      rawIndexOfChar.push(i);
    }
  };
  while ((m = re.exec(raw)) !== null) {
    pushPlain(last, m.index);
    const variant: RichVariant = m[1] === "_" ? "sub" : "sup";
    const inner = m[2];
    const innerStart = m.index + 2;
    for (let i = 0; i < inner.length; i++) {
      chars.push({ ch: inner[i], variant });
      rawIndexOfChar.push(innerStart + i);
    }
    last = re.lastIndex;
  }
  pushPlain(last, raw.length);
  return { chars, rawIndexOfChar };
}

function serialize(chars: RichChar[]): string {
  let out = "";
  let i = 0;
  while (i < chars.length) {
    const v = chars[i].variant;
    let j = i;
    let run = "";
    while (j < chars.length && chars[j].variant === v) {
      run += chars[j].ch;
      j++;
    }
    out += v === "normal" ? run : `${OPEN[v]}${run}}`;
    i = j;
  }
  return out;
}

export interface FormatResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wendet Normal/Tief/Hoch auf die aktuelle Auswahl an.
 *
 * `variant === "toggle-sub"/"toggle-sup"` schaltet zurück auf Normal, wenn die
 * Auswahl bereits vollständig in diesem Zustand ist (NOₓ → NOx).
 * Positionen beziehen sich auf den Rohtext des Eingabefelds.
 */
export function applyFormat(
  raw: string,
  selStart: number,
  selEnd: number,
  variant: RichVariant | "toggle-sub" | "toggle-sup"
): FormatResult {
  const { chars, rawIndexOfChar } = toChars(raw);
  const from = chars.findIndex((_, i) => rawIndexOfChar[i] >= selStart);
  let to = -1;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (rawIndexOfChar[i] < selEnd) { to = i; break; }
  }
  if (from === -1 || to < from) {
    return { value: raw, selectionStart: selStart, selectionEnd: selEnd };
  }

  let target: RichVariant;
  if (variant === "toggle-sub" || variant === "toggle-sup") {
    const wanted: RichVariant = variant === "toggle-sub" ? "sub" : "sup";
    const allSame = chars.slice(from, to + 1).every((c) => c.variant === wanted);
    target = allSame ? "normal" : wanted;
  } else {
    target = variant;
  }

  const next = chars.map((c, i) => (i >= from && i <= to ? { ...c, variant: target } : c));
  const value = serialize(next);

  // Neue Auswahl über dieselben Zeichen berechnen.
  const before = serialize(next.slice(0, from));
  const inside = serialize(next.slice(from, to + 1));
  return {
    value,
    selectionStart: before.length,
    selectionEnd: before.length + inside.length,
  };
}

/**
 * Wandelt bereits vorhandene Unicode-Sub/Superscript-Zeichen in Auszeichnung
 * um — hilfreich beim Einfügen von kopiertem Text (Copy & Paste bleibt so
 * formatiert und weiterhin bearbeitbar). Reine Textzeichen bleiben unberührt.
 */
const REVERSE_SUB = new Map(Object.entries(SUB_MAP).map(([k, v]) => [v, k]));
const REVERSE_SUP = new Map(Object.entries(SUP_MAP).map(([k, v]) => [v, k]));

export function normalizeUnicodeToMarkup(input: string | null | undefined): string {
  if (!input) return "";
  const { chars } = toChars(input);
  const mapped: RichChar[] = chars.map((c) => {
    if (c.variant !== "normal") return c;
    const sub = REVERSE_SUB.get(c.ch);
    if (sub) return { ch: sub, variant: "sub" };
    const sup = REVERSE_SUP.get(c.ch);
    if (sup) return { ch: sup, variant: "sup" };
    return c;
  });
  return serialize(mapped);
}
