/**
 * Druck-Hilfsfunktionen für Etiketten.
 * Erzeugt aus einem gerenderten Etiketten-DOM eine eigenständige HTML-Seite
 * und druckt diese über ein verstecktes IFrame (kein Popup-Blocker, keine
 * Bedienelemente der Anwendung im Ausdruck).
 */

/** Klont den Knoten und macht ihn druckfähig (absolute Bild-URLs, Canvas -> Bild). */
export function serializeLabelNode(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;

  // 1) Bilder zuerst: Indizes stimmen hier noch 1:1 mit dem Original überein.
  const srcImgs = Array.from(node.querySelectorAll("img"));
  Array.from(clone.querySelectorAll("img")).forEach((img, i) => {
    const orig = srcImgs[i];
    if (orig?.currentSrc || orig?.src) img.setAttribute("src", orig.currentSrc || orig.src);
  });

  // 2) Danach Canvas (QR-Codes) in statische Bilder umwandeln.
  const srcCanvases = Array.from(node.querySelectorAll("canvas"));
  const cloneCanvases = Array.from(clone.querySelectorAll("canvas"));
  cloneCanvases.forEach((c, i) => {
    const src = srcCanvases[i];
    if (!src) return;
    const img = document.createElement("img");
    try {
      img.src = src.toDataURL("image/png");
    } catch {
      return;
    }
    img.style.cssText = c.getAttribute("style") || "";
    c.replaceWith(img);
  });

  return clone.outerHTML;
}


interface PrintOptions {
  widthMm: number;
  heightMm: number;
  copies: number;
  background?: string;
  title?: string;
}

export function buildLabelPrintHtml(labelHtml: string, o: PrintOptions): string {
  const bg = o.background || "#ffffff";
  const pages = Array.from({ length: Math.max(1, o.copies) }, () => `<div class="pg">${labelHtml}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${o.title ?? "Etikett"}</title>
<style>
  @page { size: ${o.widthMm}mm ${o.heightMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: ${bg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .pg { width: ${o.widthMm}mm; height: ${o.heightMm}mm; background: ${bg}; overflow: hidden; page-break-after: always; position: relative; }
  .pg > * { width: ${o.widthMm}mm !important; height: ${o.heightMm}mm !important; box-shadow: none !important; }
  .pg:last-child { page-break-after: auto; }
</style></head><body>${pages}</body></html>`;
}

/** Druckt die übergebene HTML-Seite über ein verstecktes IFrame. */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    let started = false;
    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1000);
    };

    const start = () => {
      if (started) return;
      started = true;
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      const imgs = Array.from(win.document.images);
      const waitImages = Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                })
        )
      );
      waitImages.then(() => {
        window.setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            /* ignore */
          }
          cleanup();
        }, 150);
      });
    };

    iframe.onload = start;

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      resolve();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    // Falls onload nicht mehr feuert (document.write nach Erstellung)
    if (doc.readyState === "complete") window.setTimeout(start, 50);
  });
}
