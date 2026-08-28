import { describe, it, expect } from "vitest";
import {
  applyFormat, hasRichMarkup, normalizeUnicodeToMarkup, parseRichText, toPlain, toUnicode,
} from "@/lib/richText";

describe("richText – Darstellung", () => {
  it("erzeugt Unicode für Tiefstellung", () => {
    expect(toUnicode("N_{2}")).toBe("N₂");
    expect(toUnicode("O_{2}")).toBe("O₂");
    expect(toUnicode("CO_{2}")).toBe("CO₂");
    expect(toUnicode("Al_{2}O_{3}")).toBe("Al₂O₃");
    expect(toUnicode("Fe_{2}O_{3}")).toBe("Fe₂O₃");
    expect(toUnicode("NO_{x}")).toBe("NOₓ");
    expect(toUnicode("PO_{4}")).toBe("PO₄");
  });

  it("erzeugt Unicode für Hochstellung", () => {
    expect(toUnicode("m^{2}/g")).toBe("m²/g");
    expect(toUnicode("cm^{3}")).toBe("cm³");
    expect(toUnicode("Ca^{2+}")).toBe("Ca²⁺");
    expect(toUnicode("Fe^{3+}")).toBe("Fe³⁺");
  });

  it("erzeugt Unicode für gemischte Schreibweisen", () => {
    expect(toUnicode("PO_{4}^{3-}")).toBe("PO₄³⁻");
  });

  it("behält Zeichen ohne Unicode-Äquivalent bei", () => {
    expect(toUnicode("X_{q}")).toBe("X_q".replace("_", "")); // q hat kein Subscript
    expect(toUnicode("X_{q}")).toBe("Xq");
  });

  it("liefert Segmente für die HTML-Darstellung", () => {
    expect(parseRichText("Al_{2}O_{3}")).toEqual([
      { text: "Al", variant: "normal" },
      { text: "2", variant: "sub" },
      { text: "O", variant: "normal" },
      { text: "3", variant: "sub" },
    ]);
  });
});

describe("richText – Datenverarbeitung", () => {
  it("liefert reinen Text für Suche/Sortierung/Export", () => {
    expect(toPlain("Al_{2}O_{3}")).toBe("Al2O3");
    expect(toPlain("m^{2}/g")).toBe("m2/g");
  });

  it("ist abwärtskompatibel mit unformatiertem Text", () => {
    expect(toPlain("Al2O3")).toBe("Al2O3");
    expect(toUnicode("Al₂O₃")).toBe("Al₂O₃");
    expect(parseRichText("Rohdichte")).toEqual([{ text: "Rohdichte", variant: "normal" }]);
    expect(hasRichMarkup("Rohdichte")).toBe(false);
    expect(hasRichMarkup("NO_{x}")).toBe(true);
  });

  it("verkraftet leere Werte", () => {
    expect(toPlain(null)).toBe("");
    expect(toUnicode(undefined)).toBe("");
    expect(parseRichText("")).toEqual([]);
  });
});

describe("richText – Editor-Operationen", () => {
  it("stellt eine Auswahl tief", () => {
    // "CO2" – die "2" (Index 2..3) tiefstellen
    const r = applyFormat("CO2", 2, 3, "toggle-sub");
    expect(r.value).toBe("CO_{2}");
    expect(toUnicode(r.value)).toBe("CO₂");
  });

  it("stellt eine Auswahl hoch", () => {
    const r = applyFormat("m2/g", 1, 2, "toggle-sup");
    expect(r.value).toBe("m^{2}/g");
    expect(toUnicode(r.value)).toBe("m²/g");
  });

  it("schaltet zwischen Normal und Tiefstellung um", () => {
    const sub = applyFormat("NOx", 2, 3, "toggle-sub");
    expect(sub.value).toBe("NO_{x}");
    // erneut markieren (jetzt Position der Auszeichnung) → zurück auf normal
    const back = applyFormat(sub.value, sub.selectionStart, sub.selectionEnd, "toggle-sub");
    expect(back.value).toBe("NOx");
  });

  it("wechselt direkt von Tief- auf Hochstellung", () => {
    const sub = applyFormat("Ca2+", 2, 4, "toggle-sub");
    const sup = applyFormat(sub.value, sub.selectionStart, sub.selectionEnd, "toggle-sup");
    expect(toUnicode(sup.value)).toBe("Ca²⁺");
  });

  it("lässt den Text bei leerer Auswahl unverändert", () => {
    expect(applyFormat("CO2", 1, 1, "toggle-sub").value).toBe("CO2");
  });

  it("übernimmt eingefügte Unicode-Zeichen als Formatierung", () => {
    expect(normalizeUnicodeToMarkup("Al₂O₃")).toBe("Al_{2}O_{3}");
    expect(normalizeUnicodeToMarkup("m²/g")).toBe("m^{2}/g");
    expect(normalizeUnicodeToMarkup("Rohdichte")).toBe("Rohdichte");
  });
});
