/**
 * Formelauswertung für berechnete Felder im Service Designer.
 *
 * Unterstützt:
 *   Operatoren: + - * / %, Vergleich: = <> < <= > >=, Klammern
 *   Zahlen (auch "1.234,56" oder "1,23")
 *   Variablen (Feldschlüssel, dot.notation erlaubt)
 *   Funktionen: SUM, AVG/AVERAGE, MIN, MAX, COUNT, ROUND, ABS,
 *               STDEV/STDDEV, MEDIAN, IF(bed, a, b), AND(...), OR(...),
 *               NOT(x), DENSITY(masse, volumen), PERCENT(teil, ganzes),
 *               DIFF(a, b), QUOTIENT(a, b)
 *
 * Generisch aufgebaut — weitere Funktionen im FUNCTIONS-Objekt ergänzen.
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
  MEAN: (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN),
  MIN: (a) => (a.length ? Math.min(...a) : NaN),
  MAX: (a) => (a.length ? Math.max(...a) : NaN),
  COUNT: (a) => a.filter((v) => isFinite(v)).length,
  ROUND: (a) => {
    const [x, n = 0] = a;
    const f = Math.pow(10, n);
    return Math.round(x * f) / f;
  },
  ABS: (a) => Math.abs(a[0]),
  NOT: (a) => (a[0] ? 0 : 1),
  AND: (a) => (a.every((v) => !!v) ? 1 : 0),
  OR: (a) => (a.some((v) => !!v) ? 1 : 0),
  IF: (a) => {
    const [cond, ifTrue, ifFalse = 0] = a;
    return cond ? ifTrue : ifFalse;
  },
  STDEV: (a) => stdev(a),
  STDDEV: (a) => stdev(a),
  MEDIAN: (a) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  DENSITY: (a) => {
    const [m, v] = a;
    return v === 0 ? NaN : m / v;
  },
  PERCENT: (a) => {
    const [part, whole] = a;
    return whole === 0 ? NaN : (part / whole) * 100;
  },
  DIFF: (a) => (a[0] ?? 0) - (a[1] ?? 0),
  QUOTIENT: (a) => (a[1] === 0 ? NaN : (a[0] ?? 0) / (a[1] ?? 1)),
};

function stdev(a: number[]): number {
  if (a.length < 2) return NaN;
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const variance = a.reduce((s, v) => s + (v - mean) ** 2, 0) / (a.length - 1);
  return Math.sqrt(variance);
}

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS);

export const FORMULA_FUNCTION_HELP: Record<string, string> = {
  SUM: "Summe: SUM(a; b; …)",
  AVG: "Mittelwert: AVG(a; b; …)",
  AVERAGE: "Mittelwert: AVERAGE(a; b; …)",
  MIN: "Kleinster Wert: MIN(a; b; …)",
  MAX: "Größter Wert: MAX(a; b; …)",
  COUNT: "Anzahl gültiger Werte: COUNT(a; b; …)",
  ROUND: "Runden: ROUND(wert; nachkomma)",
  ABS: "Absolutwert: ABS(wert)",
  IF: "Bedingung: IF(bedingung; wenn_wahr; wenn_falsch)",
  AND: "Alle wahr: AND(bed1; bed2; …)",
  OR: "Mind. eine wahr: OR(bed1; bed2; …)",
  NOT: "Negation: NOT(bedingung)",
  STDEV: "Standardabweichung: STDEV(a; b; …)",
  MEDIAN: "Median: MEDIAN(a; b; …)",
  DENSITY: "Dichte: DENSITY(masse; volumen)",
  PERCENT: "Prozent: PERCENT(teil; ganzes)",
  DIFF: "Differenz: DIFF(a; b)",
  QUOTIENT: "Quotient: QUOTIENT(a; b)",
};

function toNumber(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim().replace(/\s/g, "");
  const normalized =
    s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s;
  const n = Number(normalized);
  return isFinite(n) ? n : NaN;
}

function resolveVar(ctx: FormulaContext, path: string): unknown {
  if (path in ctx) return ctx[path];
  const parts = path.split(".");
  let cur: any = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
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
    if (c === "," || c === ";") { out.push({ t: "comma" }); i++; continue; }
    // Multi-char operators
    if (c === "<" && src[i + 1] === "=") { out.push({ t: "op", v: "<=" }); i += 2; continue; }
    if (c === ">" && src[i + 1] === "=") { out.push({ t: "op", v: ">=" }); i += 2; continue; }
    if (c === "<" && src[i + 1] === ">") { out.push({ t: "op", v: "<>" }); i += 2; continue; }
    if (c === "!" && src[i + 1] === "=") { out.push({ t: "op", v: "<>" }); i += 2; continue; }
    if (c === "=" && src[i + 1] === "=") { out.push({ t: "op", v: "=" }); i += 2; continue; }
    if ("+-*/%×÷".includes(c)) {
      const m = c === "×" ? "*" : c === "÷" ? "/" : c;
      out.push({ t: "op", v: m }); i++; continue;
    }
    if (c === "<" || c === ">" || c === "=") { out.push({ t: "op", v: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, "");
      out.push({ t: "num", v: Number(raw) });
      i = j; continue;
    }
    if (/[A-Za-z_ÄÖÜäöüß]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_ÄÖÜäöüß.]/.test(src[j])) j++;
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
  isOp(op: string): boolean {
    const p = this.peek();
    return !!p && p.t === "op" && (p as any).v === op;
  }

  parse(): number {
    const v = this.compare();
    if (this.pos < this.toks.length) throw new Error("Unerwartete Token nach dem Ausdruck");
    return v;
  }
  compare(): number {
    let v = this.expr();
    while (true) {
      const p = this.peek();
      if (!p || p.t !== "op") break;
      const op = (p as any).v as string;
      if (!["=", "<>", "<", "<=", ">", ">="].includes(op)) break;
      this.eat();
      const rhs = this.expr();
      switch (op) {
        case "=": v = v === rhs ? 1 : 0; break;
        case "<>": v = v !== rhs ? 1 : 0; break;
        case "<": v = v < rhs ? 1 : 0; break;
        case "<=": v = v <= rhs ? 1 : 0; break;
        case ">": v = v > rhs ? 1 : 0; break;
        case ">=": v = v >= rhs ? 1 : 0; break;
      }
    }
    return v;
  }
  expr(): number {
    let v = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.eat() as any).v as string;
      const rhs = this.term();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  term(): number {
    let v = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = (this.eat() as any).v as string;
      const rhs = this.unary();
      if (op === "*") v = v * rhs;
      else if (op === "/") v = rhs === 0 ? NaN : v / rhs;
      else v = (v * rhs) / 100;
    }
    return v;
  }
  unary(): number {
    if (this.isOp("-")) { this.eat(); return -this.unary(); }
    if (this.isOp("+")) { this.eat(); return this.unary(); }
    return this.primary();
  }
  primary(): number {
    const t = this.eat();
    if (!t) throw new Error("Unerwartetes Ende der Formel");
    if (t.t === "num") return t.v;
    if (t.t === "lp") {
      const v = this.compare();
      this.expect((x) => x.t === "rp", "')' erwartet");
      return v;
    }
    if (t.t === "id") {
      const name = t.v;
      const upper = name.toUpperCase();
      // Booleans / Konstanten
      if (upper === "TRUE" || upper === "WAHR") return 1;
      if (upper === "FALSE" || upper === "FALSCH") return 0;
      if (upper === "PI") return Math.PI;
      const nxt = this.peek();
      if (nxt?.t === "lp") {
        this.eat();
        const args: number[] = [];
        if (this.peek()?.t !== "rp") {
          args.push(this.compare());
          while (this.peek()?.t === "comma") { this.eat(); args.push(this.compare()); }
        }
        this.expect((x) => x.t === "rp", "')' erwartet");
        const fn = FUNCTIONS[upper];
        if (!fn) throw new Error(`Unbekannte Funktion: ${name}`);
        return fn(args);
      }
      const raw = resolveVar(this.ctx, name);
      if (raw === undefined) throw new Error(`Unbekanntes Feld: ${name}`);
      return toNumber(raw);
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
    const reserved = new Set(["TRUE", "FALSE", "WAHR", "FALSCH", "PI"]);
    toks.forEach((t, i) => {
      if (t.t === "id") {
        const next = toks[i + 1];
        const isFn = next?.t === "lp";
        if (!isFn && !reserved.has(t.v.toUpperCase())) refs.add(t.v);
      }
    });
    return Array.from(refs);
  } catch {
    return [];
  }
}
