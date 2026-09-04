/**
 * Geometrie-, Zelligkeits- und Auslegungsberechnung (Mikroreaktor / Aktivitätsmessung).
 *
 * Grundsatz: KEINE eigene Rechenlogik in UI-Komponenten und keine parallele
 * Engine. Alle Formeln sind hier zentral als Berechnungsdefinitionen abgelegt
 * und werden über die bestehende Formel-Engine (`src/lib/formulaEngine.ts`)
 * ausgewertet. Der Formulardesigner kann dieselben Definitionen als Vorlage in
 * lokale Berechnungen (`form_calculations`) übernehmen – dadurch existiert die
 * Formel nur an einer Stelle.
 *
 * Trennung der Wertarten (verbindlich):
 *   *_soll        → Vorgabe aus dem Auftraggeberformular
 *   *_ist         → tatsächlich gemessener Wert (Geometrievermessung)
 *   *_berechnet   → Ergebnis dieser Berechnungen
 * Es wird niemals ein Sollwert durch eine Berechnung überschrieben.
 *
 * Fehlende Eingangsgrößen ergeben `null` („nicht berechenbar“) – niemals 0.
 */

import { evaluateFormula } from "@/lib/formulaEngine";

export interface GeometryCalcDefinition {
  /** Technischer Schlüssel – zugleich Variablenname für Folgeberechnungen. */
  calc_key: string;
  display_name: string;
  description: string;
  /** Formel in der Syntax der bestehenden Formel-Engine. */
  formula: string;
  /** Einheit als echte Ergebniseigenschaft (nicht Teil der Bezeichnung). */
  unit: string;
  decimals: number;
  /** Benötigte Eingangsgrößen (Variablennamen). */
  inputs: string[];
}

/** Sprechende Bezeichnungen der Eingangsgrößen für Hinweistexte. */
export const GEOMETRY_INPUT_LABELS: Record<string, string> = {
  d: "Kanalweite d [mm]",
  t: "Wandstärke t [mm]",
  zellenzahl: "Zellenzahl",
  av_soll: "AV Soll [m/h]",
  sv_soll: "SV Soll [1/h]",
  fr_soll: "FR Soll [Nm³/h]",
  laenge: "Bauteillänge [mm]",
  av: "AV [m/h]",
  ap: "AP [m²/m³]",
  innere_flaeche: "Innere Fläche [m²]",
};

/**
 * Zentrale Berechnungsdefinitionen. Reihenfolge = fachliche Auswertungsfolge.
 * Die Formeln sind fachlich vorgegeben und dürfen nicht verändert werden.
 */
export const GEOMETRY_CALCULATIONS: GeometryCalcDefinition[] = [
  {
    calc_key: "ap",
    display_name: "AP (angeströmte Fläche)",
    description: "Angeströmte Fläche aus Kanalweite, Wandstärke und Zellenzahl.",
    formula:
      "(4 * d * zellenzahl * zellenzahl * 1000) / POW(zellenzahl * d + (zellenzahl + 1) * t, 2)",
    unit: "m²/m³",
    decimals: 1,
    inputs: ["d", "zellenzahl", "t"],
  },
  {
    calc_key: "epsilon",
    display_name: "ε (Porosität)",
    description: "ε = AP × d / 4 / 10",
    formula: "ap * d / 4 / 10",
    unit: "%",
    decimals: 2,
    inputs: ["ap", "d"],
  },
  {
    calc_key: "laenge_berechnet",
    display_name: "Bauteillänge berechnet",
    description: "Erforderliche Bauteillänge bei vorgegebenem AV.",
    formula: "(1.8 / (av_soll * zellenzahl * (d / 1000) * 4)) * 1000",
    unit: "mm",
    decimals: 1,
    inputs: ["av_soll", "zellenzahl", "d"],
  },
  {
    calc_key: "innere_flaeche",
    display_name: "Innere Fläche",
    description: "4 × Zellenzahl × d/1000 × l/1000",
    formula: "4 * zellenzahl * (d / 1000) * (laenge / 1000)",
    unit: "m²",
    decimals: 4,
    inputs: ["zellenzahl", "d", "laenge"],
  },
  {
    calc_key: "av_berechnet",
    display_name: "AV berechnet",
    description: "AV aus FR und innerer Fläche.",
    formula: "fr_soll / innere_flaeche",
    unit: "m/h",
    decimals: 2,
    inputs: ["fr_soll", "innere_flaeche"],
  },
  {
    calc_key: "av_aus_sv",
    display_name: "AV berechnet (aus SV)",
    description: "AV aus vorgegebenem SV und AP.",
    formula: "sv_soll / ap",
    unit: "m/h",
    decimals: 2,
    inputs: ["sv_soll", "ap"],
  },
  {
    calc_key: "sv_berechnet",
    display_name: "SV berechnet",
    description: "SV = AV × AP",
    formula: "av * ap",
    unit: "1/h",
    decimals: 1,
    inputs: ["av", "ap"],
  },
  {
    calc_key: "fr_berechnet",
    display_name: "FR berechnet",
    description: "FR = AV × innere Fläche",
    formula: "av * innere_flaeche",
    unit: "Nm³/h",
    decimals: 3,
    inputs: ["av", "innere_flaeche"],
  },
];

export const geometryCalculation = (key: string) =>
  GEOMETRY_CALCULATIONS.find((c) => c.calc_key === key) ?? null;

export interface GeometryCalcResult {
  value: number | null;
  /** Fehlende Eingangsgrößen (Variablennamen). */
  missing: string[];
  error: string | null;
  unit: string;
  decimals: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Wertet eine einzelne Definition gegen einen Wertekontext aus. */
export function evaluateGeometryCalculation(
  key: string,
  ctx: Record<string, unknown>,
): GeometryCalcResult {
  const def = geometryCalculation(key);
  if (!def) return { value: null, missing: [], error: `Unbekannte Berechnung: ${key}`, unit: "", decimals: 2 };
  const missing = def.inputs.filter((k) => !isNum(ctx[k]));
  if (missing.length) {
    return { value: null, missing, error: null, unit: def.unit, decimals: def.decimals };
  }
  const res = evaluateFormula(def.formula, ctx, { knownReferences: new Set(def.inputs) });
  const value = res.error || res.value == null || !Number.isFinite(res.value) ? null : res.value;
  return { value, missing: [], error: res.error, unit: def.unit, decimals: def.decimals };
}

/** Verständlicher Hinweis, welche Eingaben fehlen. */
export function missingInputMessage(label: string, missing: string[]): string {
  const list = missing.map((m) => GEOMETRY_INPUT_LABELS[m] ?? m).join(", ");
  return `${label} kann nicht berechnet werden: ${list} fehlt.`;
}

/* ------------------------------------------------------------------ *
 * Reaktorgeometrie (Konfiguration – niemals als feste Zahl in Formeln)
 * ------------------------------------------------------------------ */

export interface ReactorGeometry {
  key: string;
  label: string;
  /** Kantenlängen in mm. */
  widthMm: number;
  heightMm: number;
}

/** Fallback, falls (noch) keine Stammdaten gepflegt sind. */
export const DEFAULT_REACTOR_GEOMETRY: ReactorGeometry = {
  key: "standard",
  label: "Standard Aktivität",
  widthMm: 30,
  heightMm: 30,
};

export const reactorCrossSectionMm2 = (g: ReactorGeometry) => g.widthMm * g.heightMm;

/** Passt die Probe (Kantenlänge in mm) in den Reaktorquerschnitt? */
export const fitsReactor = (g: ReactorGeometry, widthMm: number, heightMm: number) =>
  widthMm <= g.widthMm && heightMm <= g.heightMm;

/* ------------------------------------------------------------------ *
 * Auslegung: Zelligkeitsauswahl aus den Stammdaten
 * ------------------------------------------------------------------ */

export interface CellDensityOption {
  /** Stammdatenschlüssel (item_value). */
  key: string;
  label: string;
  zellenzahl: number;
  /**
   * Fachlicher Mess-/Prüftyp (z. B. „NOx“, „SOx“). Bewusst NICHT der Name einer
   * Dienstleistung: eine Umbenennung der Dienstleistung darf die Zuordnung nie
   * beeinflussen.
   */
  messtyp?: string | null;
}


export interface DesignInput {
  /** Geometrie der Probe (gemessen). */
  d: number | null;
  t: number | null;
  /** Auftraggebervorgaben. */
  av_soll?: number | null;
  sv_soll?: number | null;
  fr_soll?: number | null;
  laenge_soll?: number | null;
  /** Zulässige Abweichung in % (optional). */
  tolerancePercent?: number | null;
}

export interface CellDensityCandidate {
  option: CellDensityOption;
  ap: number | null;
  epsilon: number | null;
  /** Bauteillänge, die sich mit dieser Zelligkeit ergibt. */
  laenge: number | null;
  av: number | null;
  sv: number | null;
  innere_flaeche: number | null;
  /** Abweichung zum Zielwert (absolut, in der Einheit der Zielgröße). */
  deviation: number | null;
  deviationPercent: number | null;
  /** Zielgröße, gegen die verglichen wurde. */
  comparedTo: "av" | "laenge" | null;
  withinTolerance: boolean | null;
}

export interface CellDensityRecommendation {
  candidates: CellDensityCandidate[];
  best: CellDensityCandidate | null;
  /** true, wenn die beste Variante die Toleranz einhält. */
  withinTolerance: boolean | null;
  message: string;
}

/**
 * AV, das sich bei gegebener Zelligkeit, Kanalweite und Bauteillänge ergibt
 * (Umkehrung der Längenformel – keine zweite Fachlogik).
 */
const avFromLength = (zellenzahl: number, d: number, laenge: number) =>
  1.8 / (zellenzahl * (d / 1000) * 4 * (laenge / 1000));

/**
 * Rechnet jede in den Stammdaten hinterlegte (aktive) Zelligkeit durch und
 * schlägt die Variante mit der geringsten Abweichung vor. Es wird niemals eine
 * frei berechnete Zellenzahl ausgegeben und die gemessene Zelligkeit der Probe
 * bleibt unverändert.
 */
export function recommendCellDensity(
  input: DesignInput,
  densities: CellDensityOption[],
): CellDensityRecommendation {
  const { d, t } = input;
  if (!isNum(d) || !densities.length) {
    return {
      candidates: [], best: null, withinTolerance: null,
      message: !densities.length
        ? "Keine aktiven Zelligkeiten in den Stammdaten hinterlegt."
        : missingInputMessage("Zelligkeitsempfehlung", ["d"]),
    };
  }

  const targetAv = isNum(input.av_soll) ? input.av_soll : null;
  const targetLength = isNum(input.laenge_soll) ? input.laenge_soll : null;
  const tol = isNum(input.tolerancePercent) ? Math.abs(input.tolerancePercent) : null;

  const candidates: CellDensityCandidate[] = densities.map((option) => {
    const z = option.zellenzahl;
    const base: Record<string, unknown> = { d, t, zellenzahl: z };
    const ap = evaluateGeometryCalculation("ap", base).value;
    const epsilon = ap == null ? null : evaluateGeometryCalculation("epsilon", { ...base, ap }).value;

    // Zielgröße bestimmen: vorgegebene Länge dominiert (Probe wird zugeschnitten),
    // sonst wird die zum Ziel-AV passende Länge ermittelt.
    let laenge: number | null = null;
    let av: number | null = null;
    let comparedTo: "av" | "laenge" | null = null;

    if (targetLength != null) {
      laenge = targetLength;
      av = avFromLength(z, d, targetLength);
      comparedTo = targetAv != null ? "av" : null;
    } else if (targetAv != null) {
      laenge = evaluateGeometryCalculation("laenge_berechnet", { ...base, av_soll: targetAv }).value;
      av = targetAv;
      comparedTo = "laenge";
    }

    const innere_flaeche =
      laenge == null ? null : evaluateGeometryCalculation("innere_flaeche", { ...base, laenge }).value;
    const sv = av != null && ap != null
      ? evaluateGeometryCalculation("sv_berechnet", { av, ap }).value
      : null;

    let deviation: number | null = null;
    let deviationPercent: number | null = null;
    if (comparedTo === "av" && targetAv != null && av != null) {
      deviation = av - targetAv;
      deviationPercent = (deviation / targetAv) * 100;
    } else if (comparedTo === "laenge" && targetLength != null && laenge != null) {
      deviation = laenge - targetLength;
      deviationPercent = (deviation / targetLength) * 100;
    }

    return {
      option, ap, epsilon, laenge, av, sv, innere_flaeche,
      deviation, deviationPercent, comparedTo,
      withinTolerance: tol == null || deviationPercent == null
        ? null
        : Math.abs(deviationPercent) <= tol,
    };
  });

  const rated = candidates.filter((c) => c.deviationPercent != null);
  const best = (rated.length ? rated : candidates)
    .slice()
    .sort((a, b) => Math.abs(a.deviationPercent ?? Infinity) - Math.abs(b.deviationPercent ?? Infinity))[0] ?? null;

  const withinTolerance = best?.withinTolerance ?? null;
  const message = !best
    ? "Keine Zelligkeit berechenbar."
    : withinTolerance === false
      ? `Keine Zelligkeit innerhalb der Toleranz verfügbar – nächstbeste Variante: ${best.option.label} (außerhalb Toleranz).`
      : `Empfohlene Zelligkeit: ${best.option.label}`;

  return { candidates, best, withinTolerance, message };
}

/* ------------------------------------------------------------------ *
 * Auslegungsrechnung inkl. automatischer Modusbestimmung
 * ------------------------------------------------------------------ */

export type DesignMode = "av_vorgegeben" | "fr_vorgegeben" | "sv_vorgegeben" | "unbestimmt";

export interface GeometryDesign {
  mode: DesignMode;
  /** Gemessene Werte (Ist) – unverändert übernommen. */
  ist: { d: number | null; t: number | null; zellenzahl: number | null };
  /** Auftraggebervorgaben (Soll) – werden nie überschrieben. */
  soll: {
    av: number | null; sv: number | null; fr: number | null; laenge: number | null;
  };
  berechnet: {
    ap: number | null;
    epsilon: number | null;
    laenge: number | null;
    innere_flaeche: number | null;
    av: number | null;
    sv: number | null;
    fr: number | null;
  };
  /** Hinweise zu fehlenden Eingaben. */
  hints: string[];
  /** Widersprüchliche Vorgaben (keine wird automatisch verändert). */
  conflicts: string[];
}

export interface GeometryDesignInput extends DesignInput {
  /** Gemessene Zelligkeit der Probe (Ist-Wert). */
  zellenzahl_ist: number | null;
  /** Tatsächlich gemessene Bauteillänge (falls vorhanden). */
  laenge_ist?: number | null;
}

const num = (v: unknown) => (isNum(v) ? v : null);

/**
 * Führt die vollständige Geometrie-/Auslegungsberechnung durch und bestimmt
 * dabei automatisch, welcher Rechenweg (Fall A/B/C) möglich ist.
 */
export function computeGeometryDesign(input: GeometryDesignInput): GeometryDesign {
  const d = num(input.d);
  const t = num(input.t);
  const zellenzahl = num(input.zellenzahl_ist);
  const av_soll = num(input.av_soll);
  const sv_soll = num(input.sv_soll);
  const fr_soll = num(input.fr_soll);
  const laenge_soll = num(input.laenge_soll);
  const laenge_ist = num(input.laenge_ist);

  const hints: string[] = [];
  const conflicts: string[] = [];
  const base: Record<string, unknown> = { d, t, zellenzahl };

  const apRes = evaluateGeometryCalculation("ap", base);
  const ap = apRes.value;
  if (ap == null && apRes.missing.length) hints.push(missingInputMessage("AP", apRes.missing));

  const epsRes = evaluateGeometryCalculation("epsilon", { ...base, ap });
  if (epsRes.value == null && epsRes.missing.length) hints.push(missingInputMessage("ε", epsRes.missing));

  const mode: DesignMode = av_soll != null
    ? "av_vorgegeben"
    : fr_soll != null
      ? "fr_vorgegeben"
      : sv_soll != null
        ? "sv_vorgegeben"
        : "unbestimmt";

  let av: number | null = null;
  let laenge_berechnet: number | null = null;

  if (mode === "av_vorgegeben") {
    av = av_soll;
    const r = evaluateGeometryCalculation("laenge_berechnet", { ...base, av_soll });
    laenge_berechnet = r.value;
    if (r.value == null && r.missing.length) hints.push(missingInputMessage("Bauteillänge", r.missing));
  } else if (mode === "sv_vorgegeben") {
    const r = evaluateGeometryCalculation("av_aus_sv", { sv_soll, ap });
    av = r.value;
    if (r.value == null && r.missing.length) hints.push(missingInputMessage("AV", r.missing));
    if (av != null) {
      laenge_berechnet = evaluateGeometryCalculation("laenge_berechnet", { ...base, av_soll: av }).value;
    }
  }

  // Länge für die Flächenberechnung: gemessen > berechnet > Vorgabe
  const laengeFuerFlaeche = laenge_ist ?? laenge_berechnet ?? laenge_soll;
  const ifRes = evaluateGeometryCalculation("innere_flaeche", { ...base, laenge: laengeFuerFlaeche });
  const innere_flaeche = ifRes.value;
  if (innere_flaeche == null && ifRes.missing.length) {
    hints.push(missingInputMessage("Innere Fläche", ifRes.missing));
  }

  if (mode === "fr_vorgegeben") {
    const r = evaluateGeometryCalculation("av_berechnet", { fr_soll, innere_flaeche });
    av = r.value;
    if (r.value == null && r.missing.length) hints.push(missingInputMessage("AV", r.missing));
  }

  const sv = av != null && ap != null
    ? evaluateGeometryCalculation("sv_berechnet", { av, ap }).value
    : null;
  const fr = av != null && innere_flaeche != null
    ? evaluateGeometryCalculation("fr_berechnet", { av, innere_flaeche }).value
    : null;

  // --- Konfliktprüfung: Vorgaben werden nie verändert, nur gemeldet. ---
  const tol = isNum(input.tolerancePercent) ? Math.abs(input.tolerancePercent) : 2;
  const dev = (calc: number | null, soll: number | null) =>
    calc == null || soll == null || soll === 0 ? null : ((calc - soll) / soll) * 100;

  const checks: { label: string; calc: number | null; soll: number | null; unit: string }[] = [
    { label: "Bauteillänge", calc: laenge_berechnet, soll: laenge_soll, unit: "mm" },
    { label: "SV", calc: sv, soll: sv_soll, unit: "1/h" },
    { label: "FR", calc: fr, soll: fr_soll, unit: "Nm³/h" },
    { label: "AV", calc: mode === "av_vorgegeben" ? null : av, soll: av_soll, unit: "m/h" },
  ];
  for (const c of checks) {
    const p = dev(c.calc, c.soll);
    if (p != null && Math.abs(p) > tol) {
      conflicts.push(
        `${c.label}: Vorgabe ${c.soll} ${c.unit} vs. berechnet ${Number(c.calc).toFixed(2)} ${c.unit} (${p.toFixed(1)} %).`
      );
    }
  }
  if (conflicts.length) {
    conflicts.unshift("Die vorgegebenen Werte sind geometrisch nicht gleichzeitig erfüllbar.");
  }

  return {
    mode,
    ist: { d, t, zellenzahl },
    soll: { av: av_soll, sv: sv_soll, fr: fr_soll, laenge: laenge_soll },
    berechnet: {
      ap, epsilon: epsRes.value, laenge: laenge_berechnet, innere_flaeche,
      av: mode === "av_vorgegeben" ? null : av,
      sv, fr,
    },
    hints,
    conflicts,
  };
}
