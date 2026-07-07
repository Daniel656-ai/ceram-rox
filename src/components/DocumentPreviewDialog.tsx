import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { marked } from "marked";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Printer, Download, Save, Maximize2, Minimize2, X, FileText } from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface DocumentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileType?: string | null;
  loadBlob: () => Promise<Blob>;
}

type PreviewKind =
  | "pdf"
  | "image"
  | "text"
  | "markdown"
  | "csv"
  | "docx"
  | "xlsx"
  | "rtf"
  | "html"
  | "unsupported";

function getExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function detectKind(fileName: string, fileType?: string | null): PreviewKind {
  const mime = (fileType || "").toLowerCase();
  const ext = getExt(fileName);
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tif", "tiff", "ico"].includes(ext))
    return "image";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (ext === "docx") return "docx";
  if (["xlsx", "xls", "ods"].includes(ext)) return "xlsx";
  if (ext === "rtf" || mime === "application/rtf" || mime === "text/rtf") return "rtf";
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (mime.startsWith("text/") || ["txt", "log", "json", "xml", "yaml", "yml", "ini", "conf"].includes(ext))
    return "text";
  // .doc, .ppt, .pptx, .odt, .odp — no reliable client-side renderer
  return "unsupported";
}

/** Minimal RTF → plain text converter for previewing simple documents. */
function rtfToText(rtf: string): string {
  let out = rtf;
  // Remove headers/font/color tables
  out = out.replace(/\{\\\*?[^{}]*\}/g, "");
  // Remove control words
  out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
  // Unicode escapes \uNNNN
  out = out.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  // Hex escapes \'xx
  out = out.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  out = out.replace(/[{}]/g, "");
  out = out.replace(/\\\\/g, "\\").replace(/\\~/g, " ");
  return out.trim();
}

export function DocumentPreviewDialog({ open, onOpenChange, fileName, fileType, loadBlob }: DocumentPreviewProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // PDF state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const [fullscreen, setFullscreen] = useState(false);

  // Converted content
  const [textContent, setTextContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  // Excel sheets
  const [sheets, setSheets] = useState<{ name: string; html: string }[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const kind = useMemo(() => detectKind(fileName, fileType), [fileName, fileType]);

  useEffect(() => {
    if (!open) return;
    setBlob(null);
    setBlobUrl(null);
    setError(null);
    setNumPages(null);
    setPageNumber(1);
    setScale(1.0);
    setTextContent(null);
    setHtmlContent(null);
    setSheets(null);
    setActiveSheet(0);
    setLoading(true);
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const b = await loadBlob();
        if (cancelled) return;
        setBlob(b);
        createdUrl = URL.createObjectURL(b);
        setBlobUrl(createdUrl);

        const k = detectKind(fileName, fileType);
        if (k === "text") {
          setTextContent(await b.text());
        } else if (k === "markdown") {
          const md = await b.text();
          const html = await marked.parse(md, { async: true });
          if (!cancelled) setHtmlContent(html as string);
        } else if (k === "csv") {
          const txt = await b.text();
          const wb = XLSX.read(txt, { type: "string" });
          const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
          if (!cancelled) setSheets([{ name: wb.SheetNames[0] || "CSV", html }]);
        } else if (k === "docx") {
          const buf = await b.arrayBuffer();
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (!cancelled) setHtmlContent(value);
        } else if (k === "xlsx") {
          const buf = await b.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const s = wb.SheetNames.map((name) => ({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name]),
          }));
          if (!cancelled) setSheets(s);
        } else if (k === "rtf") {
          const txt = await b.text();
          if (!cancelled) setTextContent(rtfToText(txt));
        } else if (k === "html") {
          setHtmlContent(await b.text());
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Vorschau konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, fileName, fileType, loadBlob]);

  const triggerBrowserDownload = useCallback(
    (asName?: string) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = asName || fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [blob, fileName],
  );

  const handleDownload = useCallback(() => triggerBrowserDownload(), [triggerBrowserDownload]);

  const handleSaveAs = useCallback(async () => {
    if (!blob) return;
    const anyWindow = window as any;
    if (anyWindow.showSaveFilePicker) {
      try {
        const handle = await anyWindow.showSaveFilePicker({ suggestedName: fileName });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success("Datei gespeichert");
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    triggerBrowserDownload();
  }, [blob, fileName, triggerBrowserDownload]);

  const handlePrint = useCallback(() => {
    if (kind === "pdf" || kind === "image") {
      if (!blobUrl) return;
      let frame = printFrameRef.current;
      if (!frame) {
        frame = document.createElement("iframe");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        document.body.appendChild(frame);
        printFrameRef.current = frame;
      }
      frame.src = blobUrl;
      frame.onload = () => {
        try {
          frame!.contentWindow?.focus();
          frame!.contentWindow?.print();
        } catch {
          window.open(blobUrl, "_blank");
        }
      };
      return;
    }
    // For converted HTML/text/sheets, print via a fresh window
    const w = window.open("", "_blank");
    if (!w) return;
    let body = "";
    if (htmlContent) body = htmlContent;
    else if (sheets) body = sheets.map((s) => `<h2>${s.name}</h2>${s.html}`).join("");
    else if (textContent) body = `<pre>${textContent.replace(/[<&>]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`;
    w.document.write(`<!doctype html><title>${fileName}</title><style>body{font-family:sans-serif;padding:1rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>${body}`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [blobUrl, kind, htmlContent, sheets, textContent, fileName]);

  useEffect(() => {
    return () => {
      if (printFrameRef.current) {
        printFrameRef.current.remove();
        printFrameRef.current = null;
      }
    };
  }, []);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p));

  const canPaginate = kind === "pdf" && numPages && numPages > 1;
  const zoomable = kind === "pdf" || kind === "image" || kind === "docx" || kind === "xlsx" || kind === "csv" || kind === "markdown" || kind === "html" || kind === "text" || kind === "rtf";

  const ext = getExt(fileName);
  const unsupportedHint = kind === "unsupported"
    ? (["doc"].includes(ext)
        ? "Legacy Word-Dateien (.doc) können nicht direkt angezeigt werden. Bitte als .docx speichern oder herunterladen."
        : ["ppt", "pptx", "odp"].includes(ext)
        ? "Für Präsentationen ist keine direkte Vorschau verfügbar. Bitte herunterladen."
        : ["odt"].includes(ext)
        ? "OpenDocument-Textdateien (.odt) können nicht direkt angezeigt werden. Bitte als .docx oder .pdf exportieren."
        : "Für diesen Dateityp ist keine direkte Vorschau verfügbar.")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          fullscreen
            ? "max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 flex flex-col"
            : "max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col"
        }
      >
        <VisuallyHidden>
          <DialogTitle>{fileName}</DialogTitle>
          <DialogDescription>Dokumentenvorschau</DialogDescription>
        </VisuallyHidden>

        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/40 shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate text-sm font-medium flex-1 min-w-0" title={fileName}>
            {fileName}
          </span>

          {kind === "pdf" && (
            <>
              <div className="hidden sm:flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={prevPage} disabled={!canPaginate || pageNumber <= 1} aria-label="Vorherige Seite">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums whitespace-nowrap px-1">
                  {pageNumber} / {numPages ?? "–"}
                </span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={nextPage} disabled={!canPaginate || (numPages !== null && pageNumber >= numPages)} aria-label="Nächste Seite">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />
            </>
          )}

          {zoomable && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.25} aria-label="Verkleinern">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 4} aria-label="Vergrößern">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-5 mx-1" />
            </div>
          )}

          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handlePrint} disabled={kind === "unsupported" || loading} aria-label="Drucken" title="Drucken">
            <Printer className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDownload} disabled={!blob} aria-label="Herunterladen" title="Herunterladen">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveAs} disabled={!blob} aria-label="Speichern unter" title="Speichern unter">
            <Save className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFullscreen((f) => !f)} aria-label={fullscreen ? "Vollbild verlassen" : "Vollbild"} title={fullscreen ? "Vollbild verlassen" : "Vollbild"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Schließen" title="Schließen">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {sheets && sheets.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20 shrink-0 overflow-x-auto">
            {sheets.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSheet(i)}
                className={`text-xs px-2 py-1 rounded whitespace-nowrap ${i === activeSheet ? "bg-background border font-medium" : "hover:bg-muted"}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-muted/20">
          {loading && (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Vorschau wird geladen…</span>
            </div>
          )}

          {!loading && error && (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={handleDownload} disabled={!blob}>
                <Download className="h-4 w-4 mr-2" />Trotzdem herunterladen
              </Button>
            </div>
          )}

          {!loading && !error && blobUrl && kind === "pdf" && (
            <div className="flex justify-center py-4">
              <Document
                file={blobUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={(e) => setError(e?.message ?? "PDF konnte nicht geladen werden.")}
                loading={<div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> PDF wird geladen…</div>}
              >
                <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer renderTextLayer className="shadow-md bg-background" />
              </Document>
            </div>
          )}

          {!loading && !error && blobUrl && kind === "image" && (
            <div className="flex items-center justify-center p-4 min-h-full">
              <img
                src={blobUrl}
                alt={fileName}
                style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
                className="max-w-full max-h-full object-contain transition-transform"
              />
            </div>
          )}

          {!loading && !error && (kind === "text" || kind === "rtf") && textContent !== null && (
            <pre
              className="p-4 whitespace-pre-wrap break-words font-mono"
              style={{ fontSize: `${Math.round(12 * scale)}px` }}
            >
              {textContent}
            </pre>
          )}

          {!loading && !error && (kind === "docx" || kind === "markdown" || kind === "html") && htmlContent !== null && (
            <div className="flex justify-center py-4 px-2">
              <div
                className="bg-background shadow-md p-8 max-w-[900px] w-full prose prose-sm dark:prose-invert prose-headings:font-semibold prose-table:border prose-th:border prose-td:border prose-th:px-2 prose-td:px-2"
                style={{ fontSize: `${scale}rem`, transformOrigin: "top center" }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          )}

          {!loading && !error && sheets && sheets[activeSheet] && (
            <div className="p-4">
              <div
                className="overflow-auto bg-background shadow-sm border rounded [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_th]:border [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1 [&_th]:bg-muted [&_th]:text-left"
                style={{ fontSize: `${Math.round(13 * scale)}px` }}
                dangerouslySetInnerHTML={{ __html: sheets[activeSheet].html }}
              />
            </div>
          )}

          {!loading && !error && kind === "unsupported" && (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{unsupportedHint}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bitte laden Sie das Dokument herunter, um es lokal zu öffnen.
                </p>
              </div>
              <Button onClick={handleDownload} disabled={!blob}>
                <Download className="h-4 w-4 mr-2" />Herunterladen
              </Button>
            </div>
          )}
        </div>

        {kind === "pdf" && canPaginate && (
          <div className="sm:hidden flex items-center justify-center gap-2 border-t py-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={prevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums">
              {pageNumber} / {numPages}
            </span>
            <Button size="sm" variant="ghost" onClick={nextPage} disabled={numPages !== null && pageNumber >= numPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DocumentPreviewDialog;
