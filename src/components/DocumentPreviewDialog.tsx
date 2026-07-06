import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
// Vite serves the worker from node_modules with a hashed URL. Using the .mjs
// worker keeps us on the ESM build that ships with pdfjs-dist 6.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
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
  /** Lazily fetch the document blob. Called when the dialog opens. */
  loadBlob: () => Promise<Blob>;
}

type PreviewKind = "pdf" | "image" | "text" | "office" | "other";

function detectKind(fileName: string, fileType?: string | null): PreviewKind {
  const mime = (fileType || "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "tif", "tiff"].includes(ext))
    return "image";
  if (mime.startsWith("text/") || ["txt", "md", "csv", "log", "json", "xml", "yaml", "yml"].includes(ext))
    return "text";
  if (
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(ext) ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint")
  )
    return "office";
  return "other";
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
  const [textContent, setTextContent] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const kind = useMemo(() => detectKind(fileName, fileType), [fileName, fileType]);

  // Reset + load on open
  useEffect(() => {
    if (!open) return;
    setBlob(null);
    setBlobUrl(null);
    setError(null);
    setNumPages(null);
    setPageNumber(1);
    setScale(1.0);
    setTextContent(null);
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
        if (detectKind(fileName, fileType) === "text") {
          const txt = await b.text();
          if (!cancelled) setTextContent(txt);
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
    // Try File System Access API for a real "Speichern unter" dialog; fall back
    // to the standard download if the browser doesn't support it.
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
        // fall through to download
      }
    }
    triggerBrowserDownload();
  }, [blob, fileName, triggerBrowserDownload]);

  const handlePrint = useCallback(() => {
    if (!blobUrl) return;
    if (kind === "pdf" || kind === "image" || kind === "text") {
      // Hidden iframe → print
      let frame = printFrameRef.current;
      if (!frame) {
        frame = document.createElement("iframe");
        frame.style.position = "fixed";
        frame.style.right = "0";
        frame.style.bottom = "0";
        frame.style.width = "0";
        frame.style.height = "0";
        frame.style.border = "0";
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
    } else {
      window.open(blobUrl, "_blank");
    }
  }, [blobUrl, kind]);

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

        {/* Toolbar */}
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

          {(kind === "pdf" || kind === "image") && (
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

          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handlePrint} disabled={!blobUrl} aria-label="Drucken" title="Drucken">
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

        {/* Body */}
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
                loading={
                  <div className="flex items-center gap-2 text-muted-foreground p-6">
                    <Loader2 className="h-4 w-4 animate-spin" /> PDF wird geladen…
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderAnnotationLayer
                  renderTextLayer
                  className="shadow-md bg-background"
                />
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

          {!loading && !error && kind === "text" && textContent !== null && (
            <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono">{textContent}</pre>
          )}

          {!loading && !error && (kind === "office" || kind === "other") && blobUrl && (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Für diesen Dateityp ist keine direkte Vorschau verfügbar.</p>
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

        {/* Mobile pagination */}
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
