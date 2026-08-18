/**
 * Export eines gerenderten Recharts-Diagramms als SVG oder PNG.
 * Arbeitet direkt auf dem gerenderten SVG-Element – keine zusätzlichen Abhängigkeiten.
 */

function serializeSvg(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Hintergrund weiß hinterlegen, damit Exporte druck- und berichtstauglich sind
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = "text { font-family: 'Source Sans 3', system-ui, sans-serif; }";
  clone.insertBefore(style, clone.firstChild);

  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function findChartSvg(container: HTMLElement | null): SVGSVGElement | null {
  return container?.querySelector("svg") ?? null;
}

export function exportChartAsSvg(container: HTMLElement | null, filename: string) {
  const svg = findChartSvg(container);
  if (!svg) throw new Error("Kein Diagramm zum Exportieren gefunden");
  const { markup } = serializeSvg(svg);
  download(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`);
}

export async function exportChartAsPng(container: HTMLElement | null, filename: string, scale = 2) {
  const svg = findChartSvg(container);
  if (!svg) throw new Error("Kein Diagramm zum Exportieren gefunden");
  const { markup, width, height } = serializeSvg(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Diagramm konnte nicht gerendert werden"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG konnte nicht erzeugt werden");
    download(blob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
