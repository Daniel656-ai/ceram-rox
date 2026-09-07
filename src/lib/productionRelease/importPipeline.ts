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
import type {
  ProductionReleaseChange, ProductionReleaseRow, ProductionReleaseTestParameter,
} from "@/lib/api/productionReleases";

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
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function sameValue(a: unknown, b: unknown): boolean {
  const na = asText(a).replace(/\s+/g, " ").toLowerCase();
  const nb = asText(b).replace(/\s+/g, " ").toLowerCase();
  return na === nb;
}

/** Ordnet einen Dokument-Kontext ("Stückzahl:") einem Feldschlüssel zu. */
function guessFieldKey(hint: string): string | null {
  const h = hint.toLowerCase();
  const best = RELEASE_FIELDS.find((f) => h.includes(f.labelDe.toLowerCase()))
    ?? RELEASE_FIELDS.find((f) => h.includes(f.labelEn.toLowerCase()));
  return best?.key ?? null;
}

/** Grenzen der an den Importdienst gesendeten Nutzlast. */
const MAX_PAIRS = 600;
const MAX_IMAGES = 4;
const MAX_TEXT_CHARS = 200_000;

/** Seitentexte auf eine verarbeitbare Gesamtlänge kürzen (Reihenfolge bleibt erhalten). */
function capPageTexts(texts: string[]): string[] {
  let budget = MAX_TEXT_CHARS;
  return texts.map((t) => {
    if (budget <= 0) return "";
    const slice = t.slice(0, budget);
    budget -= slice.length;
    return slice;
  });
}

/**
 * Schritt 1 – Dokument analysieren. Verändert nichts in der Datenbank.
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
    visual = await extractVisualDocument(args.file, args.fileName);
  } catch (e) {
    console.error("[Fertigungsfreigabe-Import] PDF-Auslesen fehlgeschlagen", e);
    throw new Error(
      `Fehler beim PDF-Auslesen. ${e instanceof Error ? e.message : "Die Datei konnte nicht geöffnet werden."}`
    );
  }

  const rawText = visual.pageTexts.join("\n\n");
  const allPairs: VisualPair[] = visual.pages.flatMap((p) => p.pairs);
  const allImages = visual.pages.map((p) => p.imageDataUrl).filter(Boolean) as string[];

  if (!rawText.trim() && !allImages.length) {
    throw new Error(
      "Fehler beim PDF-Auslesen. Aus dem PDF konnte weder Text noch ein Seitenbild gelesen werden."
    );
  }

  // Phase 2: Auswertung. Die Nutzlast wird begrenzt, damit große Dokumente
  // nicht an Größen-/Zeitgrenzen des Importdienstes scheitern.
  const pairs = allPairs.slice(0, MAX_PAIRS);
  const images = allImages.slice(0, MAX_IMAGES);
  const pageTexts = capPageTexts(visual.pageTexts);
  console.info("[Fertigungsfreigabe-Import] Analyse", {
    datei: args.fileName,
    seiten: visual.pageTexts.length,
    zeichen: pageTexts.join("").length,
    paare: `${pairs.length}/${allPairs.length}`,
    bilder: `${images.length}/${allImages.length}`,
  });

  // Erste, schnelle Vorab-Identifikation über Klartext (ohne KI),
  // damit der bisherige Stand als Vergleich mitgeschickt werden kann.
  const preKeys = sniffIdentifiers(rawText);
  let existing = await api.productionReleases
    .findExisting(preKeys)
    .catch(() => null);

  const res = await api.productionReleases.analyzePdfText({
    fileName: args.fileName,
    pages: pageTexts,
    pairs,
    images,
    existing: existing ? snapshot(existing) : null,
  });

  const doc = res.document ?? {};
  const releaseNumber = asText(doc.release_number) || preKeys.release_number || "";
  const revisionNumber = Number.parseInt(asText(doc.revision_number), 10);

  // Zweiter Versuch der Identifikation mit den KI-Kennungen
  if (!existing) {
    existing = await api.productionReleases
      .findExisting({
        release_number: releaseNumber,
        article_number: asText(res.fields.article_number),
        drawing_approval: asText(res.fields.drawing_approval),
        cost_center_code: asText(res.fields.cost_center_code),
      })
      .catch(() => null);
  }

  const rawValues: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(res.fields)) {
    if (!RELEASE_FIELD_BY_KEY[k]) continue;
    const s = asText(v);
    if (!s) continue;
    rawValues[k] = s;
    const coerced = coerceFieldValue(k, s);
    if (coerced !== null && coerced !== undefined && coerced !== "") values[k] = coerced;
  }

  const isRevision = !!existing;
  const changes = buildChanges({
    aiChanges: res.changes ?? [],
    pairs,
    existing,
    values,
    rawValues,
    isRevision,
  });

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
    testParameters: res.testParameters ?? [],
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
  userId: string | null;
  defaultFormDefinitionId?: string | null;
}): Promise<CommitResult> {
  try {
    return await saveReleaseImport(args);
  } catch (e) {
    console.error("[Fertigungsfreigabe-Import] Speichern fehlgeschlagen", e);
    throw new Error(
      `Fehler beim Speichern der erkannten Daten. ${
        e instanceof Error ? e.message : "Unbekannte Ursache."
      }`
    );
  }
}

async function saveReleaseImport(args: {
  analysis: ReleaseAnalysis;
  /** vom Anwender ggf. korrigierte Rohwerte */
  values: Record<string, unknown>;
  testParameters: ProductionReleaseTestParameter[];
  changes: DetectedChange[];
  userId: string | null;
  defaultFormDefinitionId?: string | null;
}): Promise<CommitResult> {
  const { analysis, values, testParameters, changes, userId } = args;
  const now = new Date().toISOString();

  // Original-PDF unverändert ablegen (Fehler dürfen den Import nicht stoppen)
  let storagePath: string | null = null;
  try {
    storagePath = await api.productionReleases.uploadDocument(analysis.file, analysis.fileName);
  } catch {
    storagePath = null;
  }

  const autoChanges = changes.filter((c) => c.auto && c.field_key);
  const pending = changes.filter((c) => !c.auto);

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

  const row = await api.productionReleases.create({
    ...base,
    release_number: releaseNumber,
    revision_number: revisionNumber,
    revision_date: analysis.document.revision_date ?? null,
    root_release_id: prev ? (prev.root_release_id ?? prev.id) : null,
    previous_release_id: prev?.id ?? null,
    is_current: true,
    source_type: "pdf",
    import_source: analysis.source,
    import_status: pending.length ? "review_required" : "imported",
    source_document_path: storagePath,
    source_document_name: analysis.fileName,
    field_sources: sources,
    detection_meta: {
      document: analysis.document,
      visual_evidence: analysis.visual.hasVisualEvidence,
      ocr_pages: analysis.visual.pages.filter((p) => p.ocrNeeded).map((p) => p.page),
      auto_applied: autoChanges.length,
      pending: pending.length,
    },
    imported_at: now,
    imported_by: userId,
    created_by: userId,
    updated_by: userId,
  });

  if (!prev) {
    await api.productionReleases.update(row.id, { root_release_id: row.id });
  } else {
    await api.productionReleases.update(prev.id, { is_current: false, superseded_at: now });
  }

  // Prüfvorgaben: erkannte übernehmen, sonst den bisherigen Stand fortschreiben
  let tests = testParameters.filter((t) => asText(t.value_text) !== "");
  if (!tests.length && prev) {
    tests = (await api.productionReleases.testParameters(prev.id)).map((t) => ({
      ...t, id: undefined, release_id: undefined,
    }));
  }
  if (tests.length) {
    await api.productionReleases.replaceTestParameters(row.id, tests);
  }

  const changeRows: ProductionReleaseChange[] = changes.map((c) => ({
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
  await api.productionReleases.addChanges(row.id, changeRows);

  await api.productionReleases.logImport({
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
    },
    importedBy: userId,
  });

  return {
    releaseId: row.id,
    rootId: (prev ? (prev.root_release_id ?? prev.id) : row.id) as string,
    revisionNumber,
    isRevision: !!prev,
    pendingCount: pending.length,
  };
}
