/**
 * Aufbau der Kundendokumentation aus bereits vorhandenen ROX-Daten.
 *
 * Grundregeln:
 * - Es wird ausschließlich gelesen und zusammengeführt. Es entsteht keine
 *   zweite Wahrheit, keine Kopie von Ergebnissen und keine Kopie von Dateien.
 * - Ergebnisse stammen ausschließlich aus der bestehenden Struktur
 *   `buildOrderResultStructure()` (nur `is_official = true`).
 * - Ein Kapitel gilt nur dann als vorhanden, wenn es tatsächlich Inhalt hat.
 *   Leere Kapitel erscheinen weder in der Vorschau noch im Export.
 */
import { buildOrderResultStructure, type SampleResultGroup } from "@/lib/orderResultsStructure";
import type { RawMeasurementRow } from "@/lib/orderResultsAggregation";
import {
  CHAPTER_ORDER,
  TEST_CONDITION_ANALYSES,
  chapterForService,
  detectAnalysisKey,
  type ChapterKey,
} from "./serviceChapters";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DocField {
  /** Übersetzbarer Feldschlüssel (statischer Dokumenttext). */
  labelKey?: string;
  /** Datengetriebene Bezeichnung – wird nie übersetzt. */
  label?: string;
  value: string;
  unit?: string | null;
}

export interface DocTable {
  /** Datengetriebener Titel (Dienstleistung/Probe) – wird nie übersetzt. */
  title?: string;
  rows: DocField[];
}

export interface DocDocumentRef {
  name: string;
  /** Übersetzbare Art des Dokuments. */
  kindKey: string;
  reference?: string | null;
}

export interface DocChapter {
  key: ChapterKey;
  tables: DocTable[];
  documents: DocDocumentRef[];
}

export interface CustomerDocumentation {
  header: DocField[];
  chapters: DocChapter[];
}

export interface GeometryEntry {
  sampleNumber: string;
  geometryKind: string;
  data: Record<string, unknown>;
}

export interface ReleaseRef {
  id: string;
  release_number?: string | null;
  revision_number?: number | null;
  is_current?: boolean | null;
  source_document_name?: string | null;
}

export interface DocumentRef {
  file_name: string;
  kindKey: string;
  reference?: string | null;
}

export interface CustomerDocInput {
  order: any;
  /** Zeilen aus `api.orderSamples.resultsOverview(orderId)`. */
  resultRows: RawMeasurementRow[];
  geometry: GeometryEntry[];
  releases: ReleaseRef[];
  /** Formularwerte der m³-Liste des Auftrags (Ersatzelemente). */
  m3Values: Record<string, unknown> | null;
  documents: DocumentRef[];
  /** Sprache des Dokuments – beeinflusst nur die Zahlenformatierung. */
  locale: string;
}

function fmtNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
}

function fmtDate(value: unknown, locale: string): string {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(locale) : "";
}

/**
 * Aktuell gültige Revision einer Fertigungsfreigabe.
 * Es wird ausschließlich die bestehende Revisionslogik verwendet:
 * `is_current = true`, bei Gleichstand die höchste Revisionsnummer.
 */
export function currentRelease(releases: ReleaseRef[]): ReleaseRef | null {
  if (!releases?.length) return null;
  const byRev = [...releases].sort(
    (a, b) => (Number(b?.revision_number) || 0) - (Number(a?.revision_number) || 0)
  );
  return byRev.find((r) => r.is_current) ?? byRev[0] ?? null;
}

function headerFields(order: any, locale: string): DocField[] {
  const fields: DocField[] = [];
  const push = (labelKey: string, value: unknown) => {
    const v = value === null || value === undefined ? "" : String(value).trim();
    if (v) fields.push({ labelKey, value: v });
  };
  push("customer", order?.customer_name);
  push("order_number", order?.order_number);
  push("customer_reference", order?.reference_number);
  const projectParts = [order?.projects?.project_number, order?.projects?.project_name].filter(Boolean);
  push("project", projectParts.join(" · "));
  push("date", fmtDate(order?.created_at, locale));
  push("due_date", fmtDate(order?.due_date, locale));
  return fields;
}

/** Ergebnistabellen je Kapitel – strikt aus den offiziellen Ergebnissen. */
function resultTables(
  groups: SampleResultGroup[],
  locale: string
): Map<ChapterKey, DocTable[]> {
  const byChapter = new Map<ChapterKey, DocTable[]>();
  for (const sample of groups) {
    for (const service of sample.services) {
      const chapter = chapterForService(service.serviceName);
      if (!chapter) continue;
      for (const analysis of service.analyses) {
        const rows: DocField[] = analysis.values
          .map((v) => ({
            label: v.label,
            unit: v.unit,
            value:
              v.value !== null ? fmtNumber(v.value, locale) : (v.text ?? ""),
          }))
          .filter((r) => r.value !== "");
        if (!rows.length) continue;
        const title = `${analysis.label} · ${sample.sampleNumber}`;
        const list = byChapter.get(chapter) ?? [];
        list.push({ title, rows });
        byChapter.set(chapter, list);
      }
    }
  }
  return byChapter;
}

/** Testbedingungen aus den vorhandenen Messparametern der Aktivitätsmessungen. */
function testConditionTables(order: any): DocTable[] {
  const measurements: any[] = Array.isArray(order?.order_measurements) ? order.order_measurements : [];
  const tables: DocTable[] = [];
  for (const m of measurements) {
    const serviceName = m?.measurement_services?.service_name ?? "";
    if (!TEST_CONDITION_ANALYSES.includes(detectAnalysisKey(serviceName))) continue;
    const params: any[] = Array.isArray(m?.measurement_parameters) ? m.measurement_parameters : [];
    const rows: DocField[] = params
      .filter((p) => String(p?.parameter_value ?? "").trim() !== "")
      .map((p) => ({
        label: String(p.parameter_name),
        value: String(p.parameter_value),
        unit: p.unit ?? null,
      }));
    if (rows.length) tables.push({ title: serviceName, rows });
  }
  return tables;
}

function geometryTables(entries: GeometryEntry[], locale: string): DocTable[] {
  const tables: DocTable[] = [];
  for (const e of entries) {
    const rows: DocField[] = Object.entries(e.data ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
      .map(([k, v]) => ({
        label: k,
        value: typeof v === "number" ? fmtNumber(v, locale) : String(v),
      }));
    if (rows.length) tables.push({ title: `${e.sampleNumber} · ${e.geometryKind}`, rows });
  }
  return tables;
}

/** Ersatzelemente stammen ausschließlich aus der bestehenden m³-Liste. */
function spareElementTables(m3Values: Record<string, unknown> | null, locale: string): DocTable[] {
  if (!m3Values) return [];
  const rows: DocField[] = [];
  const num = (key: string, labelKey: string, unit: string) => {
    const raw = m3Values[key];
    const n = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (n !== null && Number.isFinite(n) && n > 0) {
      rows.push({ labelKey, value: fmtNumber(n, locale), unit });
    }
  };
  num("spare_elements", "spare_elements", "Stk");
  num("mounting_frames", "mounting_frames", "Stk");
  return rows.length ? [{ rows }] : [];
}

export function buildCustomerDocumentation(input: CustomerDocInput): CustomerDocumentation {
  const { order, resultRows, geometry, releases, m3Values, documents, locale } = input;

  const groups = buildOrderResultStructure(resultRows ?? []);
  const resultsByChapter = resultTables(groups, locale);

  const release = currentRelease(releases ?? []);
  const attachments: DocDocumentRef[] = [];
  if (release) {
    attachments.push({
      name:
        release.source_document_name ||
        `${release.release_number ?? ""} Rev. ${Number(release.revision_number) || 0}`.trim(),
      kindKey: "production_release",
      reference: `${release.release_number ?? "–"} · Rev. ${Number(release.revision_number) || 0}`,
    });
  }
  for (const d of documents ?? []) {
    attachments.push({ name: d.file_name, kindKey: d.kindKey, reference: d.reference ?? null });
  }

  const chapters: DocChapter[] = [];
  for (const key of CHAPTER_ORDER) {
    if (key === "header" || key === "toc") continue;

    let tables: DocTable[] = [];
    let docs: DocDocumentRef[] = [];

    if (key === "test_conditions") tables = testConditionTables(order);
    else if (key === "geometry") {
      tables = [...geometryTables(geometry ?? [], locale), ...(resultsByChapter.get("geometry") ?? [])];
    } else if (key === "spare_elements") tables = spareElementTables(m3Values, locale);
    else if (key === "attachments") docs = attachments;
    else tables = resultsByChapter.get(key) ?? [];

    // Kapitel ohne Inhalt entfallen vollständig – auch im Inhaltsverzeichnis.
    if (!tables.length && !docs.length) continue;
    chapters.push({ key, tables, documents: docs });
  }

  return { header: headerFields(order, locale), chapters };
}

/** Inhaltsverzeichnis – entsteht ausschließlich aus den vorhandenen Kapiteln. */
export function tableOfContents(doc: CustomerDocumentation): ChapterKey[] {
  return doc.chapters.map((c) => c.key);
}
