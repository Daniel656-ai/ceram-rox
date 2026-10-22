/**
 * Druckt ein vollständiges HTML-Dokument über ein temporäres, unsichtbares Iframe
 * im aktuellen Dokument. Ersetzt window.open, das in der Desktop-WebView (Tauri)
 * null liefert. Inline-SVG (DMC) ist nach dem load-Ereignis bereit; Bilder werden
 * zusätzlich abgewartet. Das Iframe wird nach dem Druck bzw. Abbruch entfernt.
 */
export interface PrintHtmlOptions {
  /** Sicherheitsfrist bis zur Bereinigung, falls afterprint ausbleibt (ms). */
  cleanupTimeoutMs?: number;
  /** Wartezeit vor print(), damit Layout/Fonts stehen (ms). */
  settleMs?: number;
  /** Maximale Wartezeit auf das load-Ereignis (ms). */
  loadTimeoutMs?: number;
}

export function printHtml(html: string, opts: PrintHtmlOptions = {}): Promise<void> {
  const { cleanupTimeoutMs = 60_000, settleMs = 200, loadTimeoutMs = 10_000 } = opts;
  return new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("data-print-frame", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

    let done = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
    const fail = (err: unknown) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) { fail(new Error("print frame unavailable")); return; }

    const loadTimer = setTimeout(() => fail(new Error("print frame load timeout")), loadTimeoutMs);

    const doPrint = async () => {
      clearTimeout(loadTimer);
      if (done) return;
      try {
        const imgs = Array.from(doc.images ?? []);
        await Promise.all(imgs.map((img) => img.complete ? null
          : new Promise((r) => { img.onload = img.onerror = () => r(null); })));
        await new Promise((r) => setTimeout(r, settleMs));
        win.addEventListener("afterprint", () => setTimeout(cleanup, 0), { once: true });
        cleanupTimer = setTimeout(cleanup, cleanupTimeoutMs);
        win.focus();
        win.print();
        done = true;
        resolve();
      } catch (err) {
        fail(err);
      }
    };

    try {
      doc.open();
      doc.write(html);
      doc.close();
    } catch (err) { clearTimeout(loadTimer); fail(err); return; }

    if (doc.readyState === "complete") void doPrint();
    else win.addEventListener("load", () => void doPrint(), { once: true });
  });
}
