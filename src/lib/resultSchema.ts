/**
 * Generische, stabile Ergebnisstruktur je Dienstleistung.
 *
 * Grundprinzip (nicht auf RFA zugeschnitten):
 * - Jede Dienstleistung kann über `service_parameter_definitions`
 *   (Kategorie `output`) eine fest definierte Menge und Reihenfolge von
 *   Ergebnisparametern besitzen.
 * - Zusätzlich tatsächlich vorhandene Ergebnisse, die nicht definiert sind,
 *   werden stabil (Ersteintritt) hinten angehängt – so geht nie ein Ergebnis
 *   verloren, auch wenn die Definition noch fehlt (z. B. RFA-Import).
 * - Fehlender Wert = leere Zelle. Die Spalte bleibt immer erhalten.
 * - Ein gemessener Wert 0 bleibt 0.
 */

import { resultLabel, type ResultRecord } from "@/hooks/useResultsDatabase";

export interface ResultParamColumn {
  /** Stabiler Anzeige-/Zuordnungsschlüssel (fachliche Bezeichnung ohne Einheit). */
  key: string;
  label: string;
  unit: string | null;
  /** Optionale fachliche Gruppierung (z. B. „Hauptoxide"). */
  group: string | null;
}

export interface ServiceResultSchema {
  serviceId: string | null;
  serviceName: string;
  columns: ResultParamColumn[];
}

export interface ParamDefLike {
  service_id: string;
  parameter_name: string;
  unit?: string | null;
  sort_order?: number | null;
  parameter_category?: string | null;
  description?: string | null;
}

/** Gruppenname aus der Parameterbeschreibung („Gruppe: Hauptoxide"), sonst null. */
export function parseGroup(description?: string | null): string | null {
  if (!description) return null;
  const m = description.match(/^\s*(?:Gruppe|Group)\s*:\s*(.+?)\s*$/im);
  return m ? m[1] : null;
}

function pushColumn(list: ResultParamColumn[], col: ResultParamColumn) {
  const existing = list.find((c) => c.key === col.key);
  if (!existing) {
    list.push(col);
    return;
  }
  if (!existing.unit && col.unit) existing.unit = col.unit;
  if (!existing.group && col.group) existing.group = col.group;
}

/**
 * Stabile Ergebnisstruktur je Dienstleistung aus Definitionen + tatsächlichen Daten.
 * Die Reihenfolge ist deterministisch und unabhängig von aktiven Filtern,
 * sofern `records` die vollständige Datenbasis enthält.
 */
export function buildServiceSchemas(
  records: ResultRecord[],
  defs: ParamDefLike[] = []
): ServiceResultSchema[] {
  const defsByService = new Map<string, ParamDefLike[]>();
  for (const d of defs) {
    if ((d.parameter_category ?? "output") !== "output") continue;
    const list = defsByService.get(d.service_id) ?? [];
    list.push(d);
    defsByService.set(d.service_id, list);
  }

  const schemas = new Map<string, ServiceResultSchema>();

  for (const rec of records) {
    const id = (rec as any).serviceId || null;
    const key = id || rec.serviceName || "unbekannt";
    let schema = schemas.get(key);
    if (!schema) {
      schema = {
        serviceId: id,
        serviceName: rec.serviceName || "Dienstleistung",
        columns: [],
      };
      // Definierte Ergebnisparameter zuerst – in definierter Reihenfolge.
      const defined = (id ? defsByService.get(id) ?? [] : []).slice().sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      for (const d of defined) {
        pushColumn(schema.columns, {
          key: d.parameter_name,
          label: d.parameter_name,
          unit: d.unit || null,
          group: parseGroup(d.description),
        });
      }
      schemas.set(key, schema);
    }
    for (const o of rec.outputResults) {
      pushColumn(schema.columns, {
        key: resultLabel(o),
        label: resultLabel(o),
        unit: (o.unit || "").trim() || null,
        group: null,
      });
    }
  }

  // Auch Dienstleistungen ohne Datensätze behalten ihre definierte Struktur,
  // sobald mindestens ein Datensatz existiert – hier nicht nötig, aber die
  // Reihenfolge der Dienstleistungen bleibt stabil (alphabetisch).
  return [...schemas.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName, "de"));
}

/** Globale, stabile Spaltenliste über alle Dienstleistungen hinweg. */
export function flattenSchemas(schemas: ServiceResultSchema[]): ResultParamColumn[] {
  const out: ResultParamColumn[] = [];
  for (const s of schemas) for (const c of s.columns) pushColumn(out, c);
  return out;
}

export interface ResultCellValue {
  present: boolean;
  value: number | null;
  text: string | null;
}

/** Wert eines Ergebnisparameters – leer bleibt leer, 0 bleibt 0. */
export function resultCell(record: ResultRecord, key: string): ResultCellValue {
  const hit = record.outputResults.find((o) => resultLabel(o) === key);
  if (!hit) return { present: false, value: null, text: null };
  if (hit.value === null || hit.value === undefined) {
    const text = (hit.remarks || "").trim();
    return { present: text !== "", value: null, text: text || null };
  }
  return { present: true, value: hit.value, text: null };
}

/** Exportwert: leer, wenn kein Ergebnis vorliegt; 0, wenn 0 gemessen wurde. */
export function exportCell(record: ResultRecord, key: string): number | string {
  const c = resultCell(record, key);
  if (!c.present) return "";
  return c.value !== null ? c.value : c.text ?? "";
}

/** Spaltenbeschriftung inkl. Einheit. */
export function columnHeader(col: ResultParamColumn): string {
  return col.unit ? `${col.label} (${col.unit})` : col.label;
}
