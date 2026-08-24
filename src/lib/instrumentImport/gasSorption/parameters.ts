/**
 * Parameterkatalog „Gasadsorption“ – bewusst herstellerunabhängig.
 *
 * Der Katalog beschreibt fachliche Ergebnisparameter einer Gasadsorptions-
 * messung (BET, Langmuir, BJH, t-Plot, DFT …). Er enthält KEINE Geräte- oder
 * Herstellerlogik: `patterns` sind lediglich Schreibweisen, unter denen der
 * Parameter in Mess- oder Reportdateien auftreten kann.
 */
import type { AnalysisType } from "../types";

export interface GasSorptionParameterDef {
  /** Stabile, geräteunabhängige Kennung. */
  normalizedName: string;
  analysis: AnalysisType;
  /** Erkennungsmuster in der Importdatei (klein geschrieben, Teilstring). */
  patterns: string[];
  /** Mögliche Bezeichnungen des ROX-Ergebnisfeldes. */
  aliases: string[];
  /** Fachlich erwartete Einheit (nur Fallback – Einheit kommt bevorzugt aus der Datei). */
  unit?: string | null;
}

export const GAS_SORPTION_PARAMETERS: GasSorptionParameterDef[] = [
  /* ---- BET ---- */
  {
    normalizedName: "bet_surface_area",
    analysis: "BET",
    patterns: ["bet surface area", "surface area bet", "bet-oberfläche", "bet oberfläche", "spezifische oberfläche-bet", "single point surface area"],
    aliases: [
      "Spezifische Oberfläche-BET", "Spezifische Oberfläche - BET", "Spezifische Oberflaeche BET",
      "BET Surface Area", "BET Oberfläche", "spezifische_oberflaeche_bet", "bet_surface_area", "BET",
    ],
    unit: "m²/g",
  },
  {
    normalizedName: "bet_c_constant",
    analysis: "BET",
    patterns: ["c constant", "c-constant", "bet c", "c-konstante"],
    aliases: ["BET C-Konstante", "BET C Constant", "C-Konstante", "bet_c", "bet_c_konstante"],
    unit: null,
  },
  {
    normalizedName: "bet_monolayer_capacity",
    analysis: "BET",
    patterns: ["qm", "monolayer capacity", "monolayer volume", "monoschichtkapazität"],
    aliases: ["BET Qm", "Monoschichtkapazität", "Monolayer Capacity", "bet_qm", "bet_monolayer"],
    unit: "cm³/g",
  },
  {
    normalizedName: "bet_slope",
    analysis: "BET",
    patterns: ["slope", "steigung"],
    aliases: ["BET Steigung", "Slope", "bet_slope", "Steigung"],
    unit: "g/cm³ STP",
  },
  {
    normalizedName: "bet_intercept",
    analysis: "BET",
    patterns: ["intercept", "achsenabschnitt"],
    aliases: ["BET Achsenabschnitt", "Intercept", "bet_intercept", "Achsenabschnitt"],
    unit: "g/cm³ STP",
  },
  {
    normalizedName: "bet_correlation_coefficient",
    analysis: "BET",
    patterns: ["correlation coefficient", "korrelationskoeffizient"],
    aliases: ["BET Korrelationskoeffizient", "Correlation Coefficient", "bet_r", "Korrelationskoeffizient"],
    unit: null,
  },
  {
    normalizedName: "molecular_cross_section",
    analysis: "BET",
    patterns: ["molecular cross-section", "molecular cross section", "molekülquerschnitt"],
    aliases: ["Molekülquerschnitt", "Molecular Cross-Sectional Area", "molecular_cross_section"],
    unit: "nm²",
  },

  /* ---- Langmuir ---- */
  {
    normalizedName: "langmuir_surface_area",
    analysis: "LANGMUIR",
    patterns: ["langmuir surface area", "langmuir-oberfläche", "langmuir oberfläche"],
    aliases: ["Langmuir Oberfläche", "Spezifische Oberfläche-Langmuir", "langmuir_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "langmuir_b_constant",
    analysis: "LANGMUIR",
    patterns: ["langmuir b", "b constant", "langmuir-konstante"],
    aliases: ["Langmuir B-Konstante", "Langmuir Konstante", "langmuir_b"],
    unit: null,
  },

  /* ---- BJH Adsorption ---- */
  {
    normalizedName: "bjh_ads_cumulative_surface_area",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption cumulative surface area", "bjh adsorption oberfläche", "bjh ads. surface area"],
    aliases: ["BJH Adsorption Porenoberfläche", "BJH Adsorption kumulierte Oberfläche", "bjh_ads_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "bjh_ads_cumulative_pore_volume",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption cumulative volume of pores", "bjh adsorption cumulative pore volume", "bjh adsorption porenvolumen"],
    aliases: ["BJH Adsorption kumulatives Porenvolumen", "BJH Adsorption Porenvolumen", "bjh_ads_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "bjh_ads_average_pore_diameter",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption average pore diameter", "bjh adsorption average pore width", "bjh adsorption mittlerer porendurchmesser"],
    aliases: ["BJH Adsorption mittlerer Porendurchmesser", "bjh_ads_pore_diameter"],
    unit: "nm",
  },

  /* ---- BJH Desorption ---- */
  {
    normalizedName: "bjh_des_cumulative_surface_area",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption cumulative surface area", "bjh desorption oberfläche", "bjh des. surface area"],
    aliases: ["BJH Desorption Porenoberfläche", "BJH Desorption kumulierte Oberfläche", "bjh_des_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "bjh_des_cumulative_pore_volume",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption cumulative volume of pores", "bjh desorption cumulative pore volume", "bjh desorption porenvolumen"],
    aliases: ["BJH Desorption kumulatives Porenvolumen", "BJH Desorption Porenvolumen", "bjh_des_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "bjh_des_average_pore_diameter",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption average pore diameter", "bjh desorption average pore width", "bjh desorption mittlerer porendurchmesser"],
    aliases: ["BJH Desorption mittlerer Porendurchmesser", "bjh_des_pore_diameter"],
    unit: "nm",
  },

  /* ---- t-Plot ---- */
  {
    normalizedName: "tplot_micropore_volume",
    analysis: "T_PLOT",
    patterns: ["t-plot micropore volume", "t plot micropore volume", "mikroporenvolumen"],
    aliases: ["t-Plot Mikroporenvolumen", "Mikroporenvolumen", "tplot_micropore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "tplot_micropore_area",
    analysis: "T_PLOT",
    patterns: ["t-plot micropore area", "t plot micropore area", "mikroporenoberfläche"],
    aliases: ["t-Plot Mikroporenoberfläche", "Mikroporenoberfläche", "tplot_micropore_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "tplot_external_surface_area",
    analysis: "T_PLOT",
    patterns: ["t-plot external surface area", "external surface area", "externe oberfläche"],
    aliases: ["t-Plot externe Oberfläche", "Externe Oberfläche", "tplot_external_surface_area"],
    unit: "m²/g",
  },

  /* ---- DFT / NLDFT ---- */
  {
    normalizedName: "dft_cumulative_pore_volume",
    analysis: "NLDFT",
    patterns: ["dft cumulative pore volume", "nldft cumulative pore volume", "dft porenvolumen"],
    aliases: ["DFT Porenvolumen", "NLDFT Porenvolumen", "dft_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "dft_cumulative_surface_area",
    analysis: "NLDFT",
    patterns: ["dft cumulative surface area", "nldft cumulative surface area", "dft oberfläche"],
    aliases: ["DFT Oberfläche", "NLDFT Oberfläche", "dft_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "dft_mode_pore_width",
    analysis: "NLDFT",
    patterns: ["dft mode pore width", "nldft mode pore width", "dft porenweite"],
    aliases: ["DFT Porenweite", "DFT häufigste Porenweite", "dft_mode_pore_width"],
    unit: "nm",
  },

  /* ---- Isotherme / allgemein ---- */
  {
    normalizedName: "total_pore_volume",
    analysis: "ISOTHERM",
    patterns: ["single point adsorption total pore volume", "total pore volume", "gesamtporenvolumen"],
    aliases: ["Gesamtporenvolumen", "Total Pore Volume", "total_pore_volume", "Porenvolumen"],
    unit: "cm³/g",
  },
  {
    normalizedName: "average_pore_diameter",
    analysis: "ISOTHERM",
    patterns: ["adsorption average pore diameter", "adsorption average pore width", "mittlerer porendurchmesser", "average pore diameter"],
    aliases: ["Mittlerer Porendurchmesser", "Average Pore Diameter", "average_pore_diameter"],
    unit: "nm",
  },
  {
    normalizedName: "analysis_bath_temperature",
    analysis: "ISOTHERM",
    patterns: ["analysis bath temperature", "bath temperature", "badtemperatur"],
    aliases: ["Badtemperatur", "Analysentemperatur", "analysis_bath_temperature"],
    unit: "K",
  },
];

/** Längere Muster zuerst prüfen – „bjh adsorption …“ vor „adsorption …“. */
export const GAS_SORPTION_PATTERNS: Array<{ pattern: string; def: GasSorptionParameterDef }> =
  GAS_SORPTION_PARAMETERS.flatMap((def) => def.patterns.map((pattern) => ({ pattern, def }))).sort(
    (a, b) => b.pattern.length - a.pattern.length
  );
