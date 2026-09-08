/**
 * Quellenunabhängige Import-Pipeline für Fertigungsfreigaben.
 *
 * Heute: PDF-Upload (Drag & Drop / Dateiauswahl).
 * Später: Outlook-Anhang – dieselbe Pipeline, nur ein anderer `source`.
 *
 * Ablauf:
 *   1. analyzeReleaseDocument()  – Text + Visuelles + KI-Strukturerkennung
 *   2. Anzeige/Korrektur in der UI (Prüfschritt bleibt erhalten)
 *   3. commitReleaseImport()     – Neuanlage oder neue Revision + Änderungsprotokoll
 *
 * Grundregel: eindeutig erkannt -> automatisch übernehmen,
 * unsicher erkannt -> als Prüfpunkt speichern, niemals stillschweigend setzen.
 */
import { api } from "@/lib/api";
import { extractVisualDocument, type VisualDocument, type VisualPair } from "./pdfVisual";
import {
  RELEASE_FIELDS, RELEASE_FIELD_BY_KEY, coerceFieldValue,
} from "./fields";
import {
  buildBlocks, mergeBlockResults, asText, sameValue, MAX_BLOCKS_LIMIT,
  type Block, type BlockResult,
} from "./blocks";
import type {
  ProductionReleaseChange, ProductionReleaseRow, ProductionReleaseTestParameter,
  ProductionReleaseSpecSet, ProductionReleaseSpecValue,
} from "@/lib/api/productionReleases";
import { DEFAULT_RELEASE_TYPE, normalizeReleaseType, parseSpecNumber } from "./releaseTypes";
import { normalizeSpecSets, describeSaveError } from "./specSets";

export type ImportSource = "pdf_upload" | "outlook" | "api";

export interface DetectedChange {
  field_key: string;
  field_label: string;
  old_value: string;
  new_value: string;
  detection: ProductionReleaseChange["detection"];
  confidence: ProductionReleaseChange["confidence"];
  page?: number | null;
  note?: string | null;
  /** eindeutig erkannt -> wird automatisch übernommen */
  auto: boolean;
}

export interface ReleaseCoverage {
  fileName: string;
  fileBytes: number;
  totalPages: number;
  /** tatsächlich ausgewertete Seiten (1-basiert) */
  processedPages: number[];
  /** Seiten, die nicht ausgewertet werden konnten */
  failedPages: number[];
  /** höchste vollständig verarbeitete Seite */
  processedUntilPage: number;
  complete: boolean;
  blocks: number;
  errors: { pages: number[]; code: string; message: string }[];
}

export interface ReleaseAnalysis {
  fileName: string;
  source: ImportSource;
  /** erkannte Feldwerte (bereits typgerecht) */
  values: Record<string, unknown>;
  /** Rohwerte als Text – Grundlage der Korrekturmaske */
  rawValues: Record<string, string>;
  testParameters: ProductionReleaseTestParameter[];
  document: {
    release_number?: string;
    revision_number?: number | null;
    revision_date?: string | null;
    is_revision?: boolean;
    confidence?: string;
    [k: string]: unknown;
  };
  existing: ProductionReleaseRow | null;
  isRevision: boolean;
  changes: DetectedChange[];
  rawText: string;
  visual: VisualDocument;
  file: Blob;
  /** Nachweis, welche Seiten tatsächlich verarbeitet wurden */
  coverage: ReleaseCoverage;
  /** erkannter Fertigungsfreigabe-Typ (Schlüssel der Typ-Registry) */
  releaseType: string;
  /** typabhängige Vorgabensätze (z. B. NOx-Messpunkte); unsichere Werte tragen needs_review */
  specSets: ProductionReleaseSpecSet[];
}



/** Ordnet einen Dokument-Kontext ("Stückzahl:") einem Feldschlüssel zu. */
function guessFieldKey(hint: string): string | null {
  const h = hint.toLowerCase();
  const best = RELEASE_FIELDS.find((f) => h.includes(f.labelDe.toLowerCase()))
    ?? RELEASE_FIELDS.find((f) => h.includes(f.labelEn.toLowerCase()));
  return best?.key ?? null;
}

function errorCodeOf(e: unknown): string {
  const anyE = e as { code?: string } | null;
  if (anyE && typeof anyE.code === "string") return anyE.code;
  return "BLOCK_ANALYSIS_FAILED";
}

/**
 * Schritt 1 – Dokument analysieren. Verändert nichts in der Datenbank.
 * Das gesamte PDF wird ausgewertet; bei Bedarf blockweise.
 */
export async function analyzeReleaseDocument(args: {
  file: Blob;
  fileName: string;
  source?: ImportSource;
}): Promise<ReleaseAnalysis> {
  const source = args.source ?? "pdf_upload";

  // Phase 1: PDF auslesen. Fehler hier klar als Lesefehler kennzeichnen.
  let visual: Awaited<ReturnType<typeof extractVisualDocument>>;
  try {
    // OCR für JEDE textlose Seite, nicht nur für die ersten Seiten.
    visual = await extractVisualDocument(args.file, args.fileName, { maxOcrPages: 200 });
  } catch (e) {
    console.error("[Fertigungsfreigabe-Import] PDF-Auslesen fehlgeschlagen", e);
    throw new Error(
      `Fehler beim PDF-Auslesen. ${e instanceof Error ? e.message : "Die Datei konnte nicht geöffnet werden."}`
    );
  }

  const rawText = visual.pageTexts.join("\n\n");
  const allPairs: VisualPair[] = visual.pages.flatMap((p) => p.pairs);
  const allImages = visual.pages.map((p) => p.imageDataUrl).filter(Boolean) as string[];
  const totalPages = visual.pages.length;
  const fileBytes = args.file.size ?? 0;

  if (!rawText.trim() && !allImages.length) {
    throw new Error(
      "Fehler beim PDF-Auslesen. Aus dem PDF konnte weder Text noch ein Seitenbild gelesen werden."
    );
  }

  const blocks = buildBlocks(visual);
  const processedPages: number[] = [];
  const failedPages: number[] = [];
  const errors: ReleaseCoverage["errors"] = [];

  if (blocks.length > MAX_BLOCKS_LIMIT) {
    // Nichts stillschweigend abschneiden: das Dokument ist zu groß.
    const cutoff = blocks.slice(MAX_BLOCKS_LIMIT).flatMap((b) => b.pageNumbers);
    throw new Error(
      `Fertigungsfreigabe konnte nicht vollständig verarbeitet werden. Das Dokument überschreitet die technische Verarbeitungsgrenze. ` +
        `Datei: ${args.fileName}; Größe: ${(fileBytes / 1024 / 1024).toFixed(2)} MB; Seiten: ${totalPages}; ` +
        `verarbeitbar bis Seite ${blocks[MAX_BLOCKS_LIMIT - 1].pageNumbers.at(-1)}; nicht verarbeitbar: Seiten ${cutoff[0]}–${cutoff.at(-1)}; Fehlercode: DOC_TOO_LARGE.`
    );
  }

  console.info("[Fertigungsfreigabe-Import] Analyse", {
    datei: args.fileName,
    groesseMB: (fileBytes / 1024 / 1024).toFixed(2),
    seiten: totalPages,
    zeichen: rawText.length,
    paare: allPairs.length,
    bilder: allImages.length,
    bloecke: blocks.length,
  });

  // Erste, schnelle Vorab-Identifikation über Klartext (ohne KI),
  // damit der bisherige Stand als Vergleich mitgeschickt werden kann.
  const preKeys = sniffIdentifiers(rawText);
  let existing = await api.productionReleases
    .findExisting(preKeys)
    .catch(() => null);

  const results: { block: Block; res: BlockResult }[] = [];
  for (const block of blocks) {
    try {
      const res = await api.productionReleases.analyzePdfText({
        fileName: args.fileName,
        pages: block.pages,
        pageNumbers: block.pageNumbers,
        totalPages,
        partial: blocks.length > 1,
        pairs: block.pairs,
        images: block.images,
        existing: existing ? snapshot(existing) : null,
      });
      results.push({ block, res: res as BlockResult });
      processedPages.push(...block.pageNumbers);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unbekannte Ursache.";
      const code = errorCodeOf(e);
      // Ein leerer Block (z. B. Trennblatt ohne Inhalt) ist kein Datenverlust.
      const empty =
        block.pages.join("").replace(/\s/g, "").length === 0 && block.images.length === 0;
      if (empty && /NO_DATA_RECOGNIZED|PDF_EMPTY/.test(code)) {
        processedPages.push(...block.pageNumbers);
        continue;
      }
      failedPages.push(...block.pageNumbers);
      errors.push({ pages: block.pageNumbers, code, message });
      console.error(
        `[Fertigungsfreigabe-Import] Block Seiten ${block.pageNumbers.join(",")} fehlgeschlagen (${code}): ${message}`
      );
    }
  }

  if (!results.length) {
    const first = errors[0];
    throw new Error(
      `Fertigungsfreigabe konnte nicht verarbeitet werden. ${first?.message ?? "Die Auswertung lieferte kein Ergebnis."} ` +
        `Datei: ${args.fileName}; Größe: ${(fileBytes / 1024 / 1024).toFixed(2)} MB; Seiten: ${totalPages}; ` +
        `verarbeitet bis Seite 0; nicht verarbeitet: Seiten 1–${totalPages}; Fehlercode: ${first?.code ?? "NO_RESULT"}.`
    );
  }

  const coverage: ReleaseCoverage = {
    fileName: args.fileName,
    fileBytes,
    totalPages,
    processedPages: [...processedPages].sort((a, b) => a - b),
    failedPages: [...failedPages].sort((a, b) => a - b),
    processedUntilPage: processedPages.length ? Math.max(...processedPages) : 0,
    complete: failedPages.length === 0,
    blocks: blocks.length,
    errors,
  };

  const merged = mergeBlockResults(results);
  const releaseType = normalizeReleaseType(merged.releaseType ?? DEFAULT_RELEASE_TYPE);
  const specSets = normalizeSpecSets(merged.specSets, releaseType);

  const doc = merged.document;
  const releaseNumber = asText(doc.release_number) || preKeys.release_number || "";
  const revisionNumber = Number.parseInt(asText(doc.revision_number), 10);

  // Zweiter Versuch der Identifikation mit den KI-Kennungen
  if (!existing) {
    existing = await api.productionReleases
      .findExisting({
        release_number: releaseNumber,
        article_number: asText(merged.fields.article_number),
        drawing_approval: asText(merged.fields.drawing_approval),
        cost_center_code: asText(merged.fields.cost_center_code),
      })
      .catch(() => null);
  }

  const rawValues: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged.fields)) {
    if (!RELEASE_FIELD_BY_KEY[k]) continue;
    const s = asText(v);
    if (!s) continue;
    rawValues[k] = s;
    const coerced = coerceFieldValue(k, s);
    if (coerced !== null && coerced !== undefined && coerced !== "") values[k] = coerced;
  }

  const isRevision = !!existing;
  const changes = buildChanges({
    aiChanges: merged.changes,
    pairs: allPairs,
    existing,
    values,
    rawValues,
    isRevision,
  });

  // Widersprüchliche Werte aus verschiedenen Blöcken: nie stillschweigend
  // entscheiden, sondern zur Prüfung vorlegen.
  for (const c of merged.conflicts) changes.push(c);

  // Unsichere Werte dürfen nicht automatisch gesetzt werden
  for (const c of changes) {
    if (!c.auto && c.field_key && Object.prototype.hasOwnProperty.call(values, c.field_key)) {
      delete values[c.field_key];
      delete rawValues[c.field_key];
    }
  }

  return {
    fileName: args.fileName,
    source,
    values,
    rawValues,
    testParameters: merged.testParameters,
    document: {
      ...doc,
      release_number: releaseNumber || undefined,
      revision_number: Number.isFinite(revisionNumber) ? revisionNumber : null,
      revision_date: asText(doc.revision_date) || null,
    },
    existing,
    isRevision,
    changes,
    rawText,
    visual,
    file: args.file,
    coverage,
    releaseType,
    specSets,
  };
}

/** Kennungen ohne KI aus dem Rohtext lesen (Fallback + Vorabsuche). */
export function sniffIdentifiers(text: string): {
  release_number?: string;
  article_number?: string;
  drawing_approval?: string;
  revision_number?: number | null;
} {
  const relase = text.match(/(?:Fertigungsfreigabe|Freigabe|Dokument)[^\n]{0,40}?(\d{3,5}-\d{3,5})/i)
    ?? text.match(/\b(\d{4}-\d{4})\b/);
  const rev = text.match(/\bRev(?:ision)?\.?\s*[:\s]\s*(\d{1,2})\b/i);
  const art = text.match(/\bArtikel(?:nummer|-Nr\.?)\s*[:\s]\s*([A-Za-z0-9._\-/]{3,})/i);
  return {
    release_number: relase?.[1],
    article_number: art?.[1],
    revision_number: rev ? Number.parseInt(rev[1], 10) : null,
  };
}

function snapshot(row: ProductionReleaseRow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    release_number: row.release_number ?? null,
    revision_number: row.revision_number ?? 0,
  };
  for (const f of RELEASE_FIELDS) {
    const v = row[f.key];
    if (v !== null && v !== undefined && v !== "") out[f.key] = v;
  }
  return out;
}

function buildChanges(args: {
  aiChanges: Record<string, unknown>[];
  pairs: VisualPair[];
  existing: ProductionReleaseRow | null;
  values: Record<string, unknown>;
  rawValues: Record<string, string>;
  isRevision: boolean;
}): DetectedChange[] {
  const { aiChanges, pairs, existing, values, rawValues, isRevision } = args;
  const out: DetectedChange[] = [];
  const seen = new Set<string>();

  const push = (c: DetectedChange) => {
    const sig = `${c.field_key}|${c.new_value}|${c.old_value}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(c);
  };

  for (const raw of aiChanges) {
    const hint = asText(raw.field_hint);
    const key = asText(raw.field_key) || (hint ? guessFieldKey(hint) ?? "" : "");
    const def = RELEASE_FIELD_BY_KEY[key];
    const confidence = (asText(raw.confidence) || "low") as DetectedChange["confidence"];
    const detection = (asText(raw.detection) || "text") as DetectedChange["detection"];
    const newValue = asText(raw.new_value);
    const oldValue = asText(raw.old_value) || (def && existing ? asText(existing[key]) : "");
    const eindeutig = !!def && !!newValue && confidence === "high" &&
      (detection === "strikethrough" || detection === "red" || detection === "combined" || detection === "text");
    if (def && existing && sameValue(oldValue, newValue)) continue;
    push({
      field_key: key,
      field_label: def?.labelDe ?? hint ?? "Unbekanntes Feld",
      old_value: oldValue,
      new_value: newValue,
      detection,
      confidence,
      page: typeof raw.page === "number" ? (raw.page as number) : null,
      note: asText(raw.note) || (def ? null : "Feldzuordnung nicht eindeutig"),
      auto: eindeutig,
    });
  }

  // Visuelle Paare, die die KI nicht gemeldet hat -> immer als Prüfpunkt
  for (const p of pairs) {
    const key = p.context ? guessFieldKey(p.context) ?? "" : "";
    const already = out.some(
      (c) => sameValue(c.new_value, p.newText) || (p.oldText && sameValue(c.old_value, p.oldText))
    );
    if (already) continue;
    push({
      field_key: key,
      field_label: key ? RELEASE_FIELD_BY_KEY[key].labelDe : p.context || "Unklare Änderung",
      old_value: p.oldText,
      new_value: p.newText,
      detection: p.detection,
      confidence: key ? "medium" : "low",
      page: p.page,
      note: key ? "Visuell erkannt, Feldzuordnung bitte prüfen" : "Feld konnte nicht zugeordnet werden",
      auto: false,
    });
  }

  // Abweichungen gegenüber dem gespeicherten Stand, die nicht als Änderung
  // gemeldet wurden: als Prüfpunkt vormerken (nie stillschweigend übernehmen).
  if (isRevision && existing) {
    for (const [key, val] of Object.entries(values)) {
      const before = existing[key];
      if (sameValue(before, val)) continue;
      const known = out.find((c) => c.field_key === key);
      if (known) continue;
      const def = RELEASE_FIELD_BY_KEY[key];
      push({
        field_key: key,
        field_label: def?.labelDe ?? key,
        old_value: asText(before),
        new_value: rawValues[key] ?? asText(val),
        detection: "text",
        confidence: "medium",
        page: null,
        note: "Abweichung zum bisherigen Stand, ohne eindeutige Revisionsmarkierung",
        auto: false,
      });
    }
  }
  return out;
}

export interface CommitResult {
  releaseId: string;
  rootId: string;
  revisionNumber: number;
  isRevision: boolean;
  pendingCount: number;
}

/**
 * Schritt 3 – Ergebnis speichern: Neuanlage oder neue Revision.
 * Bestehende Revisionen werden niemals überschrieben.
 */
export async function commitReleaseImport(args: {
  analysis: ReleaseAnalysis;
  values: Record<string, unknown>;
  testParameters: ProductionReleaseTestParameter[];
  changes: DetectedChange[];
  /** vom Anwender geprüfte/korrigierte Vorgabensätze */
  specSets?: ProductionReleaseSpecSet[];
  userId: string | null;
  defaultFormDefinitionId?: string | null;
}): Promise<CommitResult> {
  try {
    return await saveReleaseImport(args);
  } catch (e) {
    // Backend-Fehler kommen als einfache Objekte ({message, code, details, hint}),
    // nicht als Error – deshalb hier vollständig protokollieren und beschreiben.
    console.error("[Fertigungsfreigabe-Import] Speichern fehlgeschlagen", e);
    throw new Error(`Fehler beim Speichern der erkannten Daten. ${describeSaveError(e)}`);
  }
}


/** Führt einen Speicherschritt aus und hängt bei Fehlern den Schrittnamen an. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && !(e instanceof Error)) {
      (e as { step?: string }).step = name;
    } else if (e instanceof Error) {
      e.message = `Schritt: ${name} – ${e.message}`;
    }
    throw e;
  }
}

async function saveReleaseImport(args: {
  analysis: ReleaseAnalysis;
  /** vom Anwender ggf. korrigierte Rohwerte */
  values: Record<string, unknown>;
  testParameters: ProductionReleaseTestParameter[];
  changes: DetectedChange[];
  specSets?: ProductionReleaseSpecSet[];
  userId: string | null;
  defaultFormDefinitionId?: string | null;
}): Promise<CommitResult> {
  const { analysis, values, testParameters, changes, userId } = args;
  const now = new Date().toISOString();
  const releaseType = analysis.releaseType || (analysis.existing?.release_type as string) || DEFAULT_RELEASE_TYPE;
  // Unsichere Vorgaben ohne Bestätigung dürfen nie als gesichert gespeichert werden.
  const specSets: ProductionReleaseSpecSet[] = (args.specSets ?? analysis.specSets).map((s) => ({
    ...s,
    release_type: releaseType,
    values: s.values.map((v) => ({
      ...v,
      value_num: v.value_num ?? parseSpecNumber(v.value_text),
      needs_review: !!v.needs_review && !v.confirmed_at,
    })),
  }));
  const openSpecValues = specSets.flatMap((s) => s.values).filter((v) => v.needs_review).length;

  // Original-PDF unverändert ablegen (Fehler dürfen den Import nicht stoppen)
  let storagePath: string | null = null;
  try {
    storagePath = await api.productionReleases.uploadDocument(analysis.file, analysis.fileName);
  } catch {
    storagePath = null;
  }

  const cov = analysis.coverage;
  const incomplete = !!cov && !cov.complete;
  // Teilverarbeitung darf niemals als vollständige Freigabe gelten.
  const allChanges = incomplete
    ? [
        ...changes,
        {
          field_key: "",
          field_label: "Unvollständige Dokumentverarbeitung",
          old_value: "",
          new_value: "",
          detection: "unknown" as const,
          confidence: "low" as const,
          page: cov.failedPages[0] ?? null,
          note:
            `Nicht verarbeitete Seiten: ${cov.failedPages.join(", ")} von ${cov.totalPages}. ` +
            `Fehlercode(s): ${cov.errors.map((e) => e.code).join(", ") || "UNBEKANNT"}. ` +
            `Bitte die betroffenen Seiten manuell prüfen.`,
          auto: false,
        } satisfies DetectedChange,
      ]
    : changes;

  const autoChanges = allChanges.filter((c) => c.auto && c.field_key);
  const pending = allChanges.filter((c) => !c.auto);

  const base: Record<string, unknown> = {};
  const prev = analysis.existing;
  if (prev) {
    // Revision baut auf dem bisherigen Stand auf
    for (const f of RELEASE_FIELDS) {
      const v = prev[f.key];
      base[f.key] = v === undefined ? null : v;
    }
    base.customer_id = prev.customer_id ?? null;
    base.project_id = prev.project_id ?? null;
    base.form_definition_id = prev.form_definition_id ?? null;
    base.cellularity_item_id = prev.cellularity_item_id ?? null;
    base.recipe_mixture_id = prev.recipe_mixture_id ?? null;
    base.status = prev.status;
  } else {
    base.status = "entwurf";
    base.form_definition_id = args.defaultFormDefinitionId ?? null;
  }

  // eindeutig erkannte Werte + geprüfte Importwerte übernehmen
  const sources: Record<string, unknown> = { ...((prev?.field_sources as object) ?? {}) };
  for (const [k, v] of Object.entries(values)) {
    if (!RELEASE_FIELD_BY_KEY[k]) continue;
    base[k] = v;
    sources[k] = { source: "pdf", at: now, by: userId, document: analysis.fileName };
  }
  for (const c of autoChanges) {
    const coerced = coerceFieldValue(c.field_key, c.new_value);
    if (coerced === null || coerced === undefined || coerced === "") continue;
    base[c.field_key] = coerced;
    sources[c.field_key] = { source: "pdf", at: now, by: userId, document: analysis.fileName };
  }

  const revisionNumber = prev
    ? (Number(prev.revision_number) || 0) + 1
    : Number.isFinite(analysis.document.revision_number as number)
      ? Number(analysis.document.revision_number)
      : 0;

  const releaseNumber =
    analysis.document.release_number || (prev?.release_number as string | null) || null;

  // Änderungsdatum kommt aus dem Dokument als "TT.MM.JJJJ" – die Datenbank
  // erwartet ISO. Unlesbare Datumsangaben bleiben leer statt den Import zu stoppen.
  const revisionDate = coerceFieldValue("delivery_date", analysis.document.revision_date ?? null) as string | null;

  const row = await step("Fertigungsfreigabe anlegen", () => api.productionReleases.create({
    ...base,
    release_type: releaseType,
    release_number: releaseNumber,
    revision_number: revisionNumber,
    revision_date: revisionDate,
    root_release_id: prev ? (prev.root_release_id ?? prev.id) : null,
    previous_release_id: prev?.id ?? null,
    is_current: true,
    source_type: "pdf",
    import_source: analysis.source,
    import_status: pending.length || incomplete || openSpecValues ? "review_required" : "imported",
    source_document_path: storagePath,
    source_document_name: analysis.fileName,
    field_sources: sources,
    detection_meta: {
      document: analysis.document,
      visual_evidence: analysis.visual.hasVisualEvidence,
      ocr_pages: analysis.visual.pages.filter((p) => p.ocrNeeded).map((p) => p.page),
      auto_applied: autoChanges.length,
      pending: pending.length,
      coverage: cov ?? null,
      fully_processed: !incomplete,
      release_type: releaseType,
      spec_sets: specSets.length,
      spec_values_open: openSpecValues,
    },
    imported_at: now,
    imported_by: userId,
    created_by: userId,
    updated_by: userId,
  }));

  if (!prev) {
    await step("Stammsatz verknüpfen", () => api.productionReleases.update(row.id, { root_release_id: row.id }));
  } else {
    await step("Vorherige Revision ablösen", () =>
      api.productionReleases.update(prev.id, { is_current: false, superseded_at: now }));
  }

  // Vorgabensätze: gehören eindeutig zu DIESER Revision. Liefert die neue
  // Revision keine, wird der Stand der Vorrevision kopiert (nie vermischt).
  let setsToSave: ProductionReleaseSpecSet[] = specSets;
  if (!setsToSave.length && prev) {
    setsToSave = (await api.productionReleases.specSets(prev.id)).map((s) => ({
      ...s, id: undefined, release_id: undefined,
      values: s.values.map((v) => ({ ...v, id: undefined, spec_set_id: undefined })),
    }));
  }
  if (setsToSave.length) {
    await step("Vorgabensätze speichern", () =>
      api.productionReleases.replaceSpecSets(row.id, setsToSave, userId));
  }

  // Prüfvorgaben: erkannte übernehmen, sonst den bisherigen Stand fortschreiben
  let tests = testParameters.filter((t) => asText(t.value_text) !== "");
  if (!tests.length && prev) {
    tests = (await api.productionReleases.testParameters(prev.id)).map((t) => ({
      ...t, id: undefined, release_id: undefined,
    }));
  }
  if (tests.length) {
    await step("Prüfvorgaben speichern", () => api.productionReleases.replaceTestParameters(row.id, tests));
  }

  const changeRows: ProductionReleaseChange[] = allChanges.map((c) => ({
    field_key: c.field_key || "unbekannt",
    field_label: c.field_label,
    old_value: c.old_value || null,
    new_value: c.new_value || null,
    detection: c.detection,
    confidence: c.confidence,
    status: c.auto ? "auto_applied" : "pending",
    page: c.page ?? null,
    note: c.note ?? null,
    evidence: {},
  }));
  await step("Änderungsprotokoll speichern", () => api.productionReleases.addChanges(row.id, changeRows));

  await step("Importprotokoll speichern", () => api.productionReleases.logImport({
    releaseId: row.id,
    fileName: analysis.fileName,
    storagePath,
    rawText: analysis.rawText,
    extracted: {
      values,
      testParameters: tests,
      document: analysis.document,
      changes: changeRows,
      source: analysis.source,
      releaseType,
      specSets: setsToSave,
    },
    importedBy: userId,
  }));

  return {
    releaseId: row.id,
    rootId: (prev ? (prev.root_release_id ?? prev.id) : row.id) as string,
    revisionNumber,
    isRevision: !!prev,
    pendingCount: pending.length + openSpecValues,
  };
}
