/**
 * Formelauswertung für berechnete Felder im Service Designer.
 *
 * Unterstützt: +, -, *, /, %, Klammern, Zahlen (auch "1.234,56" oder "1,23"),
 * Variablen (Feldschlüssel) und Funktionen:
 *   AVERAGE(a, b, ...), SUM(a, b, ...), MIN(...), MAX(...), ROUND(x, n?)
 *
 * Bewusst generisch aufgebaut, damit weitere Funktionen später einfach im
 * FUNCTIONS-Objekt ergänzt werden können.
 */

export type FormulaContext = Record<string, unknown>;

export interface FormulaResult {
  value: number | null;
  error: string | null;
}

type FnImpl = (args: number[]) => number;

const FUNCTIONS: Record<string, FnImpl> = {
  SUM: (a) => a.reduce((s, v) => s + v, 0),
  AVERAGE: (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN),
  AVG: (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN),
  MIN: (a) => (a.length ? Math.min(...a) : NaN),
  MAX: (a) => (a.length ? Math.max(...a) : NaN),
  ROUND: (a) => {
    const [x, n = 0] = a;
    const f = Math.pow(10, n);
    return Math.round(x * f) / f;
  },
  ABS: (a) => Math.abs(a[0]),
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
  const n = Number(normalized);
  return isFinite(n) ? n : NaN;
}

// -------- Tokenizer --------
type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" } | { t: "rp" } | { t: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    if ("+-*/%".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      // allow decimal comma when clearly numeric literal
      const raw = src.slice(i, j).replace(/_/g, "");
      out.push({ t: "num", v: Number(raw) });
      i = j; continue;
    }
    if (/[A-Za-z_ÄÖÜäöüß]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_ÄÖÜäöüß]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j; continue;
    }
    throw new Error(`Unerwartetes Zeichen: '${c}'`);
  }
  return out;
}

// -------- Parser (recursive descent) --------
class Parser {
  pos = 0;
  constructor(private toks: Tok[], private ctx: FormulaContext) {}
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
    return v;
  }
  expr(): number { // +, -
    let v = this.term();
    while (this.peek()?.t === "op" && (this.peek() as any).v === "+" || this.peek()?.t === "op" && (this.peek() as any).v === "-") {
      const op = (this.eat() as any).v as string;
      const rhs = this.term();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  term(): number { // *, /, %
    let v = this.unary();
    while (this.peek()?.t === "op" && "*/%".includes((this.peek() as any).v)) {
      const op = (this.eat() as any).v as string;
      const rhs = this.unary();
      if (op === "*") v = v * rhs;
      else if (op === "/") v = rhs === 0 ? NaN : v / rhs;
      else v = (v * rhs) / 100; // Prozentrechnung: a % b = a * b / 100
    }
    return v;
  }
  unary(): number {
    const p = this.peek();
    if (p?.t === "op" && (p as any).v === "-") { this.eat(); return -this.unary(); }
    if (p?.t === "op" && (p as any).v === "+") { this.eat(); return this.unary(); }
    return this.primary();
  }
  primary(): number {
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
        const args: number[] = [];
        if (this.peek()?.t !== "rp") {
          args.push(this.expr());
          while (this.peek()?.t === "comma") { this.eat(); args.push(this.expr()); }
        }
        this.expect((x) => x.t === "rp", "')' erwartet");
        const fn = FUNCTIONS[name.toUpperCase()];
        if (!fn) throw new Error(`Unbekannte Funktion: ${name}`);
        return fn(args);
      }
      // Variable / Feldschlüssel
      if (!(name in this.ctx)) throw new Error(`Unbekanntes Feld: ${name}`);
      const n = toNumber(this.ctx[name]);
      return n;
    }
    throw new Error("Ungültiger Ausdruck");
  }
}

export function evaluateFormula(formula: string, ctx: FormulaContext): FormulaResult {
  const src = (formula || "").trim();
  if (!src) return { value: null, error: null };
  try {
    const toks = tokenize(src);
    const v = new Parser(toks, ctx).parse();
    if (!isFinite(v) || isNaN(v)) return { value: null, error: null };
    return { value: v, error: null };
  } catch (e: any) {
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
