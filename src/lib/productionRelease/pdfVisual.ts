/**
 * Visuelle PDF-Analyse für den Fertigungsfreigabe-Import.
 *
 * Ergänzt die reine Textextraktion (`pdfText.ts`, bleibt unverändert bestehen)
 * um genau die Eigenschaften, die für Revisionen entscheidend sind:
 *  - Position jedes Textelements
 *  - Schriftfarbe (insbesondere rote Hervorhebungen)
 *  - durchgestrichene Texte (dünne Linien/Rechtecke über Textzeilen)
 *  - räumlicher Zusammenhang alter/neuer Werte (Nachbarschaftspaare)
 *  - Seitenbilder als OCR-Grundlage, wenn eine Seite keinen Text liefert
 *
 * Bewusst layout- und dokumentunabhängig: es werden nur generische visuelle
 * Merkmale erhoben, keine festen Koordinaten eines bestimmten Formulars.
 */
import { pdfjs } from "react-pdf";

export interface VisualTextItem {
  /** laufender Index innerhalb der Seite */
  i: number;
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** true, wenn die Schriftfarbe deutlich rot ist */
  red: boolean;
  /** true, wenn eine dünne Linie den Text mittig durchkreuzt */
  struck: boolean;
  color?: string;
}

export interface VisualPair {
  /** durchgestrichener bzw. bisheriger Wert */
  oldText: string;
  /** räumlich zugeordneter neuer Wert (rechts daneben, darüber oder darunter) */
  newText: string;
  /** Kontext derselben Zeile (Feldbezeichnung) */
  context: string;
  detection: "strikethrough" | "red" | "combined";
  page: number;
}

export interface VisualPage {
  page: number;
  text: string;
  items: VisualTextItem[];
  /** Zeilen mit Roh-Text – für die Feldzuordnung */
  lines: string[];
  pairs: VisualPair[];
  /** Base64-JPEG der Seite, nur wenn kein Text extrahierbar war (OCR-Fall) */
  imageDataUrl?: string;
  ocrNeeded: boolean;
}

export interface VisualDocument {
  fileName: string;
  pages: VisualPage[];
  /** Reiner Text je Seite – identisch zum bestehenden Import */
  pageTexts: string[];
  hasVisualEvidence: boolean;
}

interface Segment {
  x0: number;
  x1: number;
  y: number;
  thickness: number;
  red: boolean;
}

const RED = (c: number[] | null) =>
  !!c && c[0] > 0.45 && c[0] > c[1] * 1.6 + 0.05 && c[0] > c[2] * 1.6 + 0.05;

function rgbString(c: number[]) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}

/** Farbwerte aus der Operatorliste den Text-Elementen der Reihe nach zuordnen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeOperators(opList: any, OPS: any) {
  const colors: (number[] | null)[] = [];
  const segments: Segment[] = [];
  let fill: number[] | null = null;
  let stroke: number[] | null = null;
  let pendingPath: { x0: number; y0: number; x1: number; y1: number } | null = null;

  const norm = (v: unknown): number[] | null => {
    if (Array.isArray(v) && v.length >= 3) return [Number(v[0]), Number(v[1]), Number(v[2])].map((n) => (n > 1 ? n / 255 : n));
    if (typeof v === "number") {
      const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
      return [r, g, b];
    }
    if (typeof v === "string") {
      const m = v.match(/^#?([0-9a-f]{6})$/i);
      if (m) {
        const n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
    }
    return null;
  };

  for (let k = 0; k < opList.fnArray.length; k++) {
    const fn = opList.fnArray[k];
    const args = opList.argsArray[k];
    if (fn === OPS.setFillRGBColor || fn === OPS.setFillColor || fn === OPS.setFillColorN) {
      fill = norm(args?.length === 3 ? args : args?.[0]) ?? fill;
    } else if (fn === OPS.setStrokeRGBColor || fn === OPS.setStrokeColor || fn === OPS.setStrokeColorN) {
      stroke = norm(args?.length === 3 ? args : args?.[0]) ?? stroke;
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      colors.push(fill);
    } else if (fn === OPS.constructPath) {
      // args: [opsArray, coordsArray]
      const coords: number[] = Array.isArray(args?.[1]) ? args[1] : [];
      if (coords.length >= 2) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let c = 0; c + 1 < coords.length; c += 2) {
          const x = Number(coords[c]);
          const y = Number(coords[c + 1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        if (Number.isFinite(minX)) pendingPath = { x0: minX, y0: minY, x1: maxX, y1: maxY };
      }
    } else if (
      pendingPath &&
      (fn === OPS.stroke || fn === OPS.fill || fn === OPS.eoFill || fn === OPS.closeStroke ||
        fn === OPS.fillStroke || fn === OPS.closeFillStroke)
    ) {
      const p = pendingPath;
      pendingPath = null;
      const w = p.x1 - p.x0;
      const h = p.y1 - p.y0;
      const isStroke = fn !== OPS.fill && fn !== OPS.eoFill;
      // horizontale, dünne Linie -> Durchstreichungs-Kandidat
      if (w > 5 && h <= 3.2) {
        segments.push({
          x0: p.x0, x1: p.x1, y: (p.y0 + p.y1) / 2,
          thickness: Math.max(h, 0.4),
          red: RED(isStroke ? stroke : fill),
        });
      }
    }
  }
  return { colors, segments };
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

const VALUEISH = /[0-9]/;

function buildPairs(items: VisualTextItem[], page: number): VisualPair[] {
  const pairs: VisualPair[] = [];
  const candidates = items.filter((it) => it.struck && it.str.trim().length > 0);
  for (const oldItem of candidates) {
    // Kontext = Text links auf derselben Zeile (Feldbezeichnung)
    const sameLine = items.filter(
      (it) => Math.abs(it.y - oldItem.y) < Math.max(oldItem.h, 6) * 0.8
    );
    const context = sameLine
      .filter((it) => it.x < oldItem.x && !it.struck)
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(" ")
      .trim();

    // neuer Wert: bevorzugt rot, sonst nächstes nicht durchgestrichenes Element
    const near = items
      .filter((it) => it !== oldItem && !it.struck && it.str.trim().length > 0)
      .map((it) => ({
        it,
        dx: it.x - (oldItem.x + oldItem.w),
        dy: Math.abs(it.y - oldItem.y),
      }))
      .filter((c) => c.dy < Math.max(oldItem.h, 6) * 2.6 && c.dx > -oldItem.w * 0.4 && c.dx < 260)
      .sort((a, b) => {
        const score = (c: typeof a) =>
          (c.it.red ? -400 : 0) + (VALUEISH.test(c.it.str) ? -60 : 0) + Math.abs(c.dx) + c.dy * 2;
        return score(a) - score(b);
      });

    const best = near[0];
    if (!best) continue;
    pairs.push({
      oldText: oldItem.str.trim(),
      newText: best.it.str.trim(),
      context: context.slice(-120),
      detection: best.it.red ? "combined" : "strikethrough",
      page,
    });
  }

  // rein rote Werte ohne Durchstreichung (Fall B)
  for (const red of items.filter((it) => it.red && !it.struck && it.str.trim().length > 0)) {
    if (pairs.some((p) => p.newText === red.str.trim())) continue;
    const context = items
      .filter((it) => Math.abs(it.y - red.y) < Math.max(red.h, 6) * 0.8 && it.x < red.x && !it.red)
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(" ")
      .trim();
    pairs.push({ oldText: "", newText: red.str.trim(), context: context.slice(-120), detection: "red", page });
  }
  return pairs;
}

/**
 * Analysiert ein PDF vollständig: Text, Position, Farbe, Durchstreichungen und
 * – falls nötig – Seitenbilder für OCR.
 */
export async function extractVisualDocument(
  file: Blob,
  fileName: string,
  opts: { maxOcrPages?: number } = {}
): Promise<VisualDocument> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OPS = (pdfjs as any).OPS;
  const pages: VisualPage[] = [];
  let ocrUsed = 0;
  let visualEvidence = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    let colors: (number[] | null)[] = [];
    let segments: Segment[] = [];
    try {
      const opList = await page.getOperatorList();
      const res = analyzeOperators(opList, OPS);
      colors = res.colors;
      segments = res.segments;
    } catch {
      // Operatorliste optional – der Import darf daran nicht scheitern
    }

    const items: VisualTextItem[] = [];
    let ti = 0;
    for (const raw of content.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const it = raw as any;
      const str = String(it.str ?? "");
      const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
      const h = Math.abs(Number(it.height) || Math.abs(Number(tr[3])) || 8);
      const w = Number(it.width) || str.length * h * 0.5;
      const x = Number(tr[4]) || 0;
      const yPdf = Number(tr[5]) || 0;
      if (str.trim() === "") { ti++; continue; }
      const col = colors[ti] ?? null;
      const y = viewport.height - yPdf; // von oben gemessen, für Nachbarschaftslogik
      const midPdf = yPdf + h * 0.45;
      const struck = segments.some(
        (s) =>
          Math.abs(s.y - midPdf) < Math.max(h * 0.42, 2) &&
          overlap(s.x0, s.x1, x, x + w) > w * 0.45
      );
      const red = RED(col);
      if (struck || red) visualEvidence = true;
      items.push({ i: items.length, str, x, y, w, h, red, struck, color: col ? rgbString(col) : undefined });
      ti++;
    }

    // Zeilen zusammensetzen (wie bisher, positionsbasiert)
    const lineMap = new Map<number, VisualTextItem[]>();
    for (const it of items) {
      const key = Math.round(it.y / 4) * 4;
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key)!.push(it);
    }
    const lines = [...lineMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((it) => (it.struck ? `[DURCHGESTRICHEN:${it.str}]` : it.red ? `[ROT:${it.str}]` : it.str))
          .join("  ")
          .replace(/\s{3,}/g, "   ")
          .trim()
      )
      .filter(Boolean);

    const text = lines.join("\n");
    const ocrNeeded = text.replace(/\s/g, "").length < 20;
    let imageDataUrl: string | undefined;
    if (ocrNeeded && ocrUsed < (opts.maxOcrPages ?? 4)) {
      try {
        imageDataUrl = await renderPageImage(page);
        ocrUsed++;
      } catch {
        // Rendering optional
      }
    }

    pages.push({ page: p, text, items, lines, pairs: buildPairs(items, p), imageDataUrl, ocrNeeded });
  }

  return {
    fileName,
    pages,
    pageTexts: pages.map((p) => p.text),
    hasVisualEvidence: visualEvidence,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPageImage(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 1.7 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}
