/**
 * Formelauswertung für berechnete Felder, globale Berechnungen und Regeln.
 *
 * Unterstützt: +, -, *, /, %, Klammern, Zahlen (auch "1.234,56" oder "1,23"),
 * Variablen (Feldschlüssel, auch mit Punkt-Notation: probe.lotnummer) sowie
 * Funktionen (siehe FUNCTIONS).
 *
 * Mehrfachauswahl / Listen: Variablen dürfen Arrays enthalten
 * (z.B. Brenntemperaturen = [550, 600, 650]). Aggregatfunktionen wie
 * COUNT(), SUM(), AVERAGE(), MIN(), MAX() arbeiten direkt darauf.
 */

export type FormulaContext = Record<string, unknown>;

export interface FormulaResult {
  value: number | null;
  error: string | null;
}

/** Ein Wert im Ausdruck: Skalar oder Liste (Mehrfachauswahl). */
type Val = number | number[];

type FnImpl = (args: Val[]) => number;

function flat(args: Val[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) out.push(...a.filter((n) => Number.isFinite(n)));
    else if (Number.isFinite(a)) out.push(a);
  }
  return out;
}

function first(args: Val[]): number {
  const f = flat(args);
  return f.length ? f[0] : NaN;
}

const FUNCTIONS: Record<string, FnImpl> = {
  SUM: (a) => flat(a).reduce((s, v) => s + v, 0),
  AVERAGE: (a) => { const f = flat(a); return f.length ? f.reduce((s, v) => s + v, 0) / f.length : NaN; },
  AVG: (a) => FUNCTIONS.AVERAGE(a),
  MIN: (a) => { const f = flat(a); return f.length ? Math.min(...f) : NaN; },
  MAX: (a) => { const f = flat(a); return f.length ? Math.max(...f) : NaN; },
  COUNT: (a) => {
    // Zählt Elemente – auch nicht-numerische Einträge einer Mehrfachauswahl.
    let n = 0;
    for (const v of a) n += Array.isArray(v) ? v.length : Number.isFinite(v) ? 1 : 0;
    return n;
  },
  MEDIAN: (a) => {
    const f = flat(a).sort((x, y) => x - y);
    if (!f.length) return NaN;
    const m = Math.floor(f.length / 2);
    return f.length % 2 ? f[m] : (f[m - 1] + f[m]) / 2;
  },
  ROUND: (a) => {
    const f = flat(a);
    const [x, n = 0] = f;
    const p = Math.pow(10, n);
    return Math.round(x * p) / p;
  },
  CEIL: (a) => Math.ceil(first(a)),
  FLOOR: (a) => Math.floor(first(a)),
  ABS: (a) => Math.abs(first(a)),
  SQRT: (a) => Math.sqrt(first(a)),
  POW: (a) => { const f = flat(a); return Math.pow(f[0], f[1]); },
  IF: (a) => {
    const f = flat(a);
    return f[0] ? f[1] : f[2] ?? 0;
  },
};

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS);

function toNumber(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim().replace(/\s/g, "");
  // "1.234,56" -> "1234.56"
  const normalized =
    s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;
  const m = normalized.match(/-?\d+(\.\d+)?/);
  const n = Number(normalized);
  if (isFinite(n)) return n;
  // "550 °C" -> 550
  return m ? Number(m[0]) : NaN;
}

/** Wandelt einen Kontextwert in einen Skalar oder eine Liste um. */
function toVal(v: unknown): Val {
  if (Array.isArray(v)) return v.map(toNumber);
  return toNumber(v);
}

function scalar(v: Val): number {
  if (Array.isArray(v)) return v.length === 1 ? v[0] : NaN;
  return v;
}

// -------- Tokenizer --------
type TokBase = { p: number };
type Tok = TokBase & (
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" } | { t: "rp" } | { t: "comma" }
);

/** Menschenlesbare Position (1-basiert) für Fehlermeldungen. */
const at = (p: number | undefined) => (p == null ? "" : ` (Position ${p + 1})`);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { out.push({ t: "lp", p: i }); i++; continue; }
    if (c === ")") { out.push({ t: "rp", p: i }); i++; continue; }
    if (c === "," || c === ";") { out.push({ t: "comma", p: i }); i++; continue; }
    if ("+-*/%".includes(c)) { out.push({ t: "op", v: c, p: i }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, "");
      out.push({ t: "num", v: Number(raw), p: i });
      i = j; continue;
    }
    if (/[A-Za-z_ÄÖÜäöüß]/.test(c)) {
      let j = i;
      // Bezeichner dürfen Punkte enthalten (Systemvariablen: probe.lotnummer)
      while (
        j < src.length &&
        (/[A-Za-z0-9_ÄÖÜäöüß]/.test(src[j]) ||
          (src[j] === "." && /[A-Za-z_ÄÖÜäöüß]/.test(src[j + 1] ?? "")))
      ) j++;
      out.push({ t: "id", v: src.slice(i, j), p: i });
      i = j; continue;
    }
    throw new Error(`Unerwartetes Zeichen: '${c}'${at(i)}`);
  }
  return out;
}


// -------- Parser (recursive descent) --------
/** Signal: Referenz ist bekannt, aber (noch) ohne Wert – kein Fehler. */
class IncompleteSignal extends Error {}

class Parser {
  pos = 0;
  constructor(
    private toks: Tok[],
    private ctx: FormulaContext,
    private known: Set<string> = new Set(),
  ) {}
  peek(): Tok | undefined { return this.toks[this.pos]; }
  eat(): Tok { return this.toks[this.pos++]; }
  expect(pred: (t: Tok) => boolean, msg: string): Tok {
    const t = this.eat();
    if (!t || !pred(t)) throw new Error(msg);
    return t;
  }

  parse(): number {
    const v = this.expr();
    if (this.pos < this.toks.length) throw new Error("Unerwartete Token nach dem Ausdruck");
    return scalar(v);
  }
  expr(): Val { // +, -
    let v = scalar(this.term());
    while (this.peek()?.t === "op" && ["+", "-"].includes((this.peek() as any).v)) {
      const op = (this.eat() as any).v as string;
      const rhs = scalar(this.term());
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  term(): Val { // *, /, %
    let v = this.unary();
    while (this.peek()?.t === "op" && "*/%".includes((this.peek() as any).v)) {
      const op = (this.eat() as any).v as string;
      const lhs = scalar(v);
      const rhs = scalar(this.unary());
      if (op === "*") v = lhs * rhs;
      else if (op === "/") v = rhs === 0 ? NaN : lhs / rhs;
      else v = (lhs * rhs) / 100; // Prozentrechnung: a % b = a * b / 100
    }
    return v;
  }
  unary(): Val {
    const p = this.peek();
    if (p?.t === "op" && (p as any).v === "-") { this.eat(); return -scalar(this.unary()); }
    if (p?.t === "op" && (p as any).v === "+") { this.eat(); return scalar(this.unary()); }
    return this.primary();
  }
  primary(): Val {
    const t = this.eat();
    if (!t) throw new Error("Unerwartetes Ende der Formel");
    if (t.t === "num") return t.v;
    if (t.t === "lp") {
      const v = this.expr();
      this.expect((x) => x.t === "rp", "')' erwartet");
      return v;
    }
    if (t.t === "id") {
      const name = t.v;
      const nxt = this.peek();
      if (nxt?.t === "lp") {
        this.eat(); // consume (
        const args: Val[] = [];
        if (this.peek()?.t !== "rp") {
          args.push(this.arg());
          while (this.peek()?.t === "comma") { this.eat(); args.push(this.arg()); }
        }
        this.expect((x) => x.t === "rp", "')' erwartet");
        const fn = FUNCTIONS[name.toUpperCase()];
        if (!fn) throw new Error(`Unbekannte Funktion: ${name}`);
        return fn(args);
      }
      // Variable / Feldschlüssel
      if (!(name in this.ctx)) {
        // Bekanntes Feld des Formulars, das (noch) keinen Wert hat -> kein Fehler.
        if (this.known.has(name)) throw new IncompleteSignal(name);
        throw new Error(`Unbekanntes Feld: ${name}`);
      }
      return toVal(this.ctx[name]);
    }
    throw new Error("Ungültiger Ausdruck");
  }
  /** Funktionsargument – Listen bleiben hier erhalten. */
  arg(): Val {
    const start = this.pos;
    const t = this.peek();
    // Einzelne Variable als Argument -> Liste durchreichen
    if (t?.t === "id") {
      const after = this.toks[this.pos + 1];
      const isTerminator = !after || after.t === "comma" || after.t === "rp";
      if (isTerminator && t.v in this.ctx) {
        this.eat();
        return toVal(this.ctx[t.v]);
      }
    }
    this.pos = start;
    return this.expr();
  }
}

export interface EvaluateOptions {
  /**
   * Alle Referenzen, die im aktuellen Kontext gültig sind (Feldschlüssel des
   * Formulars, Berechnungsschlüssel …). Fehlt ein Wert für eine bekannte
   * Referenz, gilt die Berechnung als „noch unvollständig“ – nicht als Fehler.
   */
  knownReferences?: Iterable<string>;
}

export function evaluateFormula(
  formula: string,
  ctx: FormulaContext,
  opts: EvaluateOptions = {},
): FormulaResult {
  const src = (formula || "").trim();
  if (!src) return { value: null, error: null };
  try {
    const toks = tokenize(src);
    const known = new Set(opts.knownReferences ?? []);
    const v = new Parser(toks, ctx, known).parse();
    if (!isFinite(v) || isNaN(v)) return { value: null, error: null };
    return { value: v, error: null };
  } catch (e: any) {
    if (e instanceof IncompleteSignal) return { value: null, error: null };
    return { value: null, error: e?.message ?? "Formelfehler" };
  }
}


/** Extrahiert alle referenzierten Feldschlüssel aus einer Formel. */
export function extractReferences(formula: string): string[] {
  try {
    const toks = tokenize(formula || "");
    const refs = new Set<string>();
    toks.forEach((t, i) => {
      if (t.t === "id") {
        const next = toks[i + 1];
        const isFn = next?.t === "lp";
        if (!isFn) refs.add(t.v);
      }
    });
    return Array.from(refs);
  } catch {
    return [];
  }
}
