/**
 * Sprachen der Kundendokumentation.
 *
 * Die Texte werden über das bestehende i18next als eigener, klar abgegrenzter
 * Bereich (`customer_documentation`) registriert. Die Oberflächensprache der
 * Anwendung bleibt davon unberührt – die Dokumentsprache wird ausschließlich
 * in der Kundendokumentation gewählt.
 */
import i18n from "@/i18n";
import de from "@/i18n/locales/de/customer_documentation.json";
import en from "@/i18n/locales/en/customer_documentation.json";
import fr from "@/i18n/locales/fr/customer_documentation.json";
import it from "@/i18n/locales/it/customer_documentation.json";
import es from "@/i18n/locales/es/customer_documentation.json";

export const DOC_NAMESPACE = "customer_documentation";

export const DOC_LANGUAGES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
] as const;

export type DocLanguage = (typeof DOC_LANGUAGES)[number]["code"];

const BUNDLES: Record<DocLanguage, unknown> = { de, en, fr, it, es };

let registered = false;

/** Registriert die Dokumenttexte einmalig – bestehende Bündel bleiben unberührt. */
export function registerDocumentationTranslations() {
  if (registered) return;
  for (const [lang, bundle] of Object.entries(BUNDLES)) {
    i18n.addResourceBundle(lang, DOC_NAMESPACE, bundle, true, false);
  }
  registered = true;
}

registerDocumentationTranslations();

/** Übersetzer für eine feste Dokumentsprache (unabhängig von der Oberfläche). */
export function docT(lang: DocLanguage) {
  registerDocumentationTranslations();
  return i18n.getFixedT(lang, DOC_NAMESPACE);
}

/** Locale für Zahlen-/Datumsformatierung der gewählten Dokumentsprache. */
export function docLocale(lang: DocLanguage): string {
  return lang === "de" ? "de-AT" : lang;
}
