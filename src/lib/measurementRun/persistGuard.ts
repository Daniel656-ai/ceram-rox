/**
 * Zweite Verteidigungslinie gegen unbeabsichtigtes Löschen beim
 * Zwischenspeichern (persistResults, Entwurfsmodus).
 *
 * Gespiegelte Felder (Wertquelle-Verknüpfung oder Stammdatenreferenz) sind
 * schreibgeschützt – der Benutzer kann sie nie bewusst leeren. Ist ihr Wert
 * zum Speicherzeitpunkt leer, stammt die Leerung aus einem technischen
 * Zustand (Quelle lädt noch / nicht auflösbar), nicht aus einer Eingabe.
 * Bereits gespeicherte Ergebniszeilen solcher Felder dürfen beim
 * Entwurfsspeichern daher nicht gelöscht werden – analog zur bestehenden
 * Schutzausnahme für offizielle Berechnungen.
 *
 * Bewusstes Leeren bleibt für alle normalen (editierbaren) Felder unverändert
 * möglich; beim endgültigen Abschluss (kein Entwurf) gilt die bisherige Logik.
 */
import { readValueSource } from "@/lib/fieldLinks";
import { readMasterDataRef } from "@/lib/masterDataRef";

interface FieldLike {
  field_key?: string | null;
  data_source?: unknown;
  metadata?: unknown;
}

/** Ist das Feld ein gespiegeltes (schreibgeschützt befülltes) Feld? */
export function isMirroredField(field: FieldLike): boolean {
  if (readValueSource(field as any)) return true;
  if (readMasterDataRef((field.metadata as any) ?? null)) return true;
  return false;
}

/**
 * Ergebnis-Schlüssel aller gespiegelten Felder einer Dienstleistung:
 * direkte Dienstleistungsfelder (Schlüssel = field_key) und Felder
 * verknüpfter Globaler Formulare (Schlüssel = form:<form_id>:<field_key>).
 */
export function collectMirroredFieldKeys(
  serviceFields: FieldLike[],
  linkedDefinitions: Array<{ formId: string; fields: FieldLike[] }>,
  linkedKey: (formId: string, fieldKey: string) => string,
): Set<string> {
  const out = new Set<string>();
  for (const f of serviceFields ?? []) {
    if (f?.field_key && isMirroredField(f)) out.add(f.field_key);
  }
  for (const def of linkedDefinitions ?? []) {
    for (const f of def?.fields ?? []) {
      if (f?.field_key && isMirroredField(f)) out.add(linkedKey(def.formId, f.field_key));
    }
  }
  return out;
}

/**
 * Darf eine bereits gespeicherte Zeile beim Speichern gelöscht werden?
 * Geschützt sind ausschließlich gespiegelte Felder im Entwurfsmodus.
 */
export function mayDeleteStoredRow(opts: {
  draftOnly: boolean;
  mirrored: boolean;
}): boolean {
  if (opts.draftOnly && opts.mirrored) return false;
  return true;
}
