/**
 * Übernahme der NOx-Vorgaben aus der Fertigungsfreigabe (inkl. Revision) in die
 * aus der m³-Liste erzeugte NOX-Dienstleistung.
 *
 * Grundsatz: Es werden ausschließlich bereits vorhandene Felder der jeweiligen
 * Dienstleistung befüllt (`service_data_fields`). Es wird kein Feld angelegt,
 * keine Struktur verändert und nichts geraten – gibt es kein passendes Feld,
 * wird der Wert schlicht nicht übernommen.
 */

export interface NoxHandoverValue {
  /** Feldschlüssel der m³-Liste (zugleich bevorzugter Feldschlüssel). */
  key: string;
  /** Anzeigename, wie er in der m³-Liste verwendet wird. */
  label: string;
  /** Weitere zulässige Schreibweisen des Zielfeldes. */
  aliases: string[];
  value: string;
  unit: string | null;
}

interface FieldLike {
  field_key: string;
  display_name: string;
  unit?: string | null;
}

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v.trim() : String(v);
  return s === "" ? null : s;
};

/**
 * NOx-relevante Vorgaben aus den abgeleiteten Werten der m³-Liste. Diese Werte
 * stammen ausschließlich aus der hinterlegten Fertigungsfreigabe-Revision bzw.
 * deren Berechnung – der Benutzer muss sie nicht erneut erfassen.
 */
export function buildNoxHandover(values: Record<string, unknown>): NoxHandoverValue[] {
  const spec: Array<Omit<NoxHandoverValue, "value"> & { source: string }> = [
    { key: "micro_nox", label: "Mikrostück NOx", aliases: ["Mikrostueck NOx", "NOx-Mikrostück", "Mikrostück"], unit: null, source: "micro_nox" },
    { key: "av_nox", label: "AV-NOx", aliases: ["AV NOx", "AV-Wert NOx"], unit: null, source: "av_nox" },
    { key: "cell_count", label: "Zellenzahl", aliases: ["Zellen"], unit: null, source: "cell_count" },
    { key: "cell_configuration", label: "Zellkonfiguration", aliases: [], unit: null, source: "cell_configuration" },
    { key: "length_mm", label: "Länge", aliases: ["Laenge"], unit: "mm", source: "length_mm" },
    { key: "cross_section_mm", label: "Durchmesser D", aliases: ["Durchmesser"], unit: "mm", source: "cross_section_mm" },
    { key: "v2o5_percent", label: "V2O5", aliases: [], unit: "%", source: "v2o5_percent" },
    { key: "article_number", label: "Artikelnummer", aliases: ["Artikel"], unit: null, source: "article_number" },
    { key: "release_label", label: "Fertigungsfreigabe / Revision", aliases: ["Fertigungsfreigabe"], unit: null, source: "release_label" },
  ];

  const out: NoxHandoverValue[] = [];
  for (const s of spec) {
    const v = text(values[s.source]);
    if (v === null) continue;
    out.push({ key: s.key, label: s.label, aliases: s.aliases, value: v, unit: s.unit });
  }
  return out;
}

/**
 * Bildet die Vorgaben auf bereits vorhandene Felder der Dienstleistung ab.
 * Verglichen wird Feldschlüssel bzw. Anzeigename – ohne Groß-/Kleinschreibung,
 * Leer- und Trennzeichen. Ohne passendes Feld entsteht kein Eintrag.
 */
export function mapNoxHandoverToParameters(
  fields: FieldLike[],
  handover: NoxHandoverValue[],
  measurementId: string
): Array<{ order_measurement_id: string; parameter_name: string; parameter_value: string; unit: string | null }> {
  const rows: Array<{ order_measurement_id: string; parameter_name: string; parameter_value: string; unit: string | null }> = [];
  const used = new Set<string>();
  for (const h of handover) {
    const candidates = [h.key, h.label, ...h.aliases].map(norm);
    const field = fields.find(
      (f) =>
        !used.has(f.field_key) &&
        (candidates.includes(norm(f.field_key)) || candidates.includes(norm(f.display_name)))
    );
    if (!field) continue;
    used.add(field.field_key);
    rows.push({
      order_measurement_id: measurementId,
      parameter_name: field.display_name || field.field_key,
      parameter_value: h.value,
      unit: field.unit ?? h.unit ?? null,
    });
  }
  return rows;
}
