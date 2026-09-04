/**
 * Textextraktion aus PDF-Dateien für den Fertigungsfreigabe-Import.
 *
 * Bewusst layout-tolerant: es wird der Text jeder Seite einzeln geliefert,
 * damit das Beiblatt (Seite 2) mit den Prüfvorgaben separat ausgewertet werden
 * kann. Es wird NICHT davon ausgegangen, dass alle Dokumente dasselbe Layout
 * oder dieselben ausgefüllten Felder besitzen.
 */
import { pdfjs } from "react-pdf";

export async function extractPdfPages(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Positionsbasiert zeilenweise zusammensetzen, damit Label/Wert-Paare
    // erhalten bleiben (Formulare mit Spalten).
    const items = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => ({
        str: String(it.str ?? ""),
        x: Array.isArray(it.transform) ? Number(it.transform[4]) : 0,
        y: Array.isArray(it.transform) ? Number(it.transform[5]) : 0,
      }))
      .filter((it) => it.str.trim() !== "");

    const lines = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      const key = Math.round(it.y / 4) * 4;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key)!.push({ x: it.x, str: it.str });
    }
    const text = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) =>
        parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join("  ")
          .replace(/\s{3,}/g, "   ")
          .trim()
      )
      .filter(Boolean)
      .join("\n");
    pages.push(text);
  }
  return pages;
}
