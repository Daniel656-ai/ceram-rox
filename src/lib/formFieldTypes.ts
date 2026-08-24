import type { FormFieldType } from "@/lib/api/formFields";

/**
 * Zentrale Feldtyp-Definition des Formulardesigners.
 * Wird sowohl für Top-Level-Felder als auch für Unterfelder (Repeater,
 * Messblock) verwendet – es gibt kein zweites Konfigurationssystem.
 */
export const FIELD_TYPE_GROUPS: { label: string; types: { value: FormFieldType; label: string }[] }[] = [
  { label: "Standard", types: [
    { value: "text", label: "Text" }, { value: "longtext", label: "Mehrzeiliger Text" },
    { value: "number", label: "Zahl" }, { value: "decimal", label: "Dezimalzahl" },
    { value: "percent", label: "Prozent" }, { value: "boolean", label: "Ja / Nein" },
  ]},
  { label: "Datum & Zeit", types: [
    { value: "date", label: "Datum" }, { value: "time", label: "Uhrzeit" }, { value: "datetime", label: "Datum & Uhrzeit" },
  ]},
  { label: "Auswahl", types: [{ value: "select", label: "Dropdown" }, { value: "multiselect", label: "Mehrfachauswahl" }]},
  { label: "Dateien & Codes", types: [
    { value: "file", label: "Datei" }, { value: "image", label: "Bild" },
    { value: "barcode", label: "Barcode" }, { value: "qrcode", label: "QR-Code" },
    { value: "handwriting", label: "Handschrift (Stift/Tablet)" },
  ]},
  { label: "Berechnung", types: [{ value: "computed", label: "Berechnetes Feld (Formel)" }]},
  { label: "Messdaten", types: [
    { value: "measurement_import", label: "Messdaten-Import (Copy & Paste)" },
    { value: "measurement_block", label: "Messblock (wiederholbare Messung)" },
  ]},
  { label: "Rohstoffe", types: [{ value: "raw_material_recipe", label: "Rezeptur / Rohstoffliste (Auftraggeber)" }]},
  { label: "Wiederholbare Gruppen", types: [
    { value: "repeater", label: "Repeater (wiederholbare Einträge)" },
  ]},
  { label: "Beziehungen", types: [
    { value: "ref_customer", label: "Kunde" }, { value: "ref_material", label: "Rohstoff (aus Rohstoffverwaltung)" },
    { value: "ref_product", label: "Produkt" }, { value: "ref_machine", label: "Maschine" },
    { value: "ref_employee", label: "Mitarbeiter" }, { value: "ref_location", label: "Standort" },
    { value: "ref_batch", label: "Chargennummer" }, { value: "ref_serial", label: "Seriennummer" },
  ]},
];

export const ALL_FIELD_TYPES = FIELD_TYPE_GROUPS.flatMap(g => g.types);

/** Feldtypen, die als Unterfeld eines Containers (Repeater/Messblock) zulässig sind. */
export const SUBFIELD_TYPE_GROUPS = FIELD_TYPE_GROUPS
  .map(g => ({ ...g, types: g.types.filter(t => !["repeater", "measurement_block"].includes(t.value)) }))
  .filter(g => g.types.length > 0);

export const fieldTypeLabel = (t: string) =>
  ALL_FIELD_TYPES.find(x => x.value === t)?.label ?? t;

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}
