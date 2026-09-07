/**
 * Blockweise Verarbeitung großer Fertigungsfreigaben.
 *
 * Grundsatz: es wird NICHTS abgeschnitten. Passt ein Dokument nicht in einen
 * Durchlauf, wird es in Blöcke geteilt, die Blöcke werden nacheinander
 * ausgewertet und die Ergebnisse anschließend zusammengeführt.
 */
import type { VisualDocument, VisualPair } from "./pdfVisual";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";
import { RELEASE_FIELD_BY_KEY } from "./fields";
import type { DetectedChange } from "./importPipeline";

export function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function sameValue(a: unknown, b: unknown): boolean {
  const na = asText(a).replace(/\s+/g, " ").toLowerCase();
  const nb = asText(b).replace(/\s+/g, " ").toLowerCase();
  return na === nb;
}

export interface BlockResult {
  fields: Record<string, unknown>;
  testParameters: ProductionReleaseTestParameter[];
  document: Record<string, unknown>;
  changes: Record<string, unknown>[];
}

/**
 * Blockgrenzen. Es wird NICHT abgeschnitten – große Dokumente werden in
 * mehrere Blöcke aufgeteilt und nacheinander ausgewertet, die Ergebnisse
 * anschließend zusammengeführt.
 */
const BLOCK_MAX_CHARS = 45_000;
const BLOCK_MAX_PAGES = 8;
const BLOCK_MAX_IMAGES = 3;
/** Notbremse gegen endlose Verarbeitung: harte technische Grenze. */
const MAX_BLOCKS = 40;

export const MAX_BLOCKS_LIMIT = MAX_BLOCKS;

export interface Block {
  pageNumbers: number[];
  pages: string[];
  pairs: VisualPair[];
  images: string[];
}

/** Seiten in verarbeitbare Blöcke schneiden – jede Seite kommt genau einmal vor. */
export function buildBlocks(visual: VisualDocument): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => { if (cur && cur.pages.length) blocks.push(cur); cur = null; };

  for (const p of visual.pages) {
    const text = p.text ?? "";
    const img = p.imageDataUrl ? [p.imageDataUrl] : [];
    if (
      cur &&
      (cur.pages.length >= BLOCK_MAX_PAGES ||
        cur.pages.join("").length + text.length > BLOCK_MAX_CHARS ||
        cur.images.length + img.length > BLOCK_MAX_IMAGES)
    ) {
      flush();
    }
    if (!cur) cur = { pageNumbers: [], pages: [], pairs: [], images: [] };
    cur.pageNumbers.push(p.page);
    // Eine einzelne, extrem lange Seite wird nicht gekürzt, sondern als
    // eigener Block gesendet (der Dienst verarbeitet sie am Stück).
    cur.pages.push(text);
    cur.pairs.push(...p.pairs);
    cur.images.push(...img);
  }
  flush();
  return blocks;
}


export function mergeBlockResults(results: { block: Block; res: BlockResult }[]): {
  fields: Record<string, unknown>;
  testParameters: ProductionReleaseTestParameter[];
  document: Record<string, unknown>;
  changes: Record<string, unknown>[];
  conflicts: DetectedChange[];
} {
  const fields: Record<string, unknown> = {};
  const fieldPage: Record<string, number> = {};
  const conflicts: DetectedChange[] = [];
  const document: Record<string, unknown> = {};
  const changes: Record<string, unknown>[] = [];
  const tests = new Map<string, ProductionReleaseTestParameter>();
  let bestRevision = Number.NEGATIVE_INFINITY;

  for (const { block, res } of results) {
    const firstPage = block.pageNumbers[0] ?? 1;

    for (const [k, v] of Object.entries(res.fields ?? {})) {
      const s = asText(v);
      if (!s) continue;
      if (!(k in fields)) {
        fields[k] = s;
        fieldPage[k] = firstPage;
        continue;
      }
      if (sameValue(fields[k], s)) continue;
      const def = RELEASE_FIELD_BY_KEY[k];
      conflicts.push({
        field_key: k,
        field_label: def?.labelDe ?? k,
        old_value: asText(fields[k]),
        new_value: s,
        detection: "text",
        confidence: "low",
        page: firstPage,
        note: `Abweichender Wert auf Seite ${firstPage} (zuvor Seite ${fieldPage[k]}) – bitte prüfen`,
        auto: false,
      });
    }

    for (const t of res.testParameters ?? []) {
      const key = `${t.section}|${t.parameter_key}`;
      if (!tests.has(key)) tests.set(key, t);
    }

    for (const c of res.changes ?? []) {
      const page = typeof c.page === "number" && c.page > 0
        ? (block.pageNumbers.includes(c.page) ? c.page : c.page)
        : firstPage;
      changes.push({ ...c, page });
    }

    const d = (res.document ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(d)) {
      if (k === "revision_number" || k === "revision_date" || k === "is_revision") continue;
      if (asText(v) && !asText(document[k])) document[k] = v;
    }
    const rev = Number.parseInt(asText(d.revision_number), 10);
    if (Number.isFinite(rev) && rev > bestRevision) {
      bestRevision = rev;
      document.revision_number = String(rev);
      if (asText(d.revision_date)) document.revision_date = d.revision_date;
      document.is_revision = d.is_revision ?? true;
    } else if (!asText(document.revision_date) && asText(d.revision_date)) {
      document.revision_date = d.revision_date;
    }
    if (d.is_revision === true) document.is_revision = true;
  }

  return {
    fields,
    testParameters: [...tests.values()],
    document,
    changes,
    conflicts,
  };
}
