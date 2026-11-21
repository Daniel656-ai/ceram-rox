/**
 * Berichts-Platzhalter, Report-Bindings und Feldkatalog-Formatierung
 * (lib/reportPlaceholders.ts, lib/reportBindings.ts, lib/reportFieldCatalog.ts).
 *
 * Datumswerte werden ohne Zeitzonenangabe übergeben (lokale Zeit), damit das
 * Ergebnis nicht von der Zeitzone des Rechners abhängt.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  PLACEHOLDER_CATALOG,
  TOKEN_TO_PATH,
  formatPlaceholderValue,
  replaceTokens,
  resolvePath,
} from "@/lib/reportPlaceholders";
import {
  flattenSharedData,
  renderBindingString,
  renderBindings,
  resolveBindingPath,
} from "@/lib/reportBindings";
import { formatReportValue, resolveReportPath, sampleValueFor } from "@/lib/reportFieldCatalog";

afterEach(() => {
  vi.useRealTimers();
});

describe("Berichts-Platzhalter: Katalog", () => {
  it("jedes Token im Katalog ist eindeutig", () => {
    const tokens = PLACEHOLDER_CATALOG.flatMap((g) => g.items.map((i) => i.token));
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("ordnet feste Tokens ihrem Pfad zu, aber nicht die Vorlagen {{AG:…}} und {{MDL:…}}", () => {
    expect(TOKEN_TO_PATH["{{Auftragsnummer}}"]).toBe("order.order_number");
    expect(TOKEN_TO_PATH["{{Hauptrohstoff}}"]).toBe("raw_material.recipe[0].material");
    expect(TOKEN_TO_PATH["{{auftrag.auftragsnummer}}"]).toBe("auftrag.auftragsnummer");
    expect(TOKEN_TO_PATH["{{AG:feldschluessel}}"]).toBeUndefined();
    expect(TOKEN_TO_PATH["{{MDL:feldschluessel}}"]).toBeUndefined();
  });

  it("enthält die Systemvariablen als eigene Gruppen", () => {
    const labels = PLACEHOLDER_CATALOG.map((g) => g.label);
    expect(labels.some((l) => l.startsWith("Systemvariablen · "))).toBe(true);
  });
});

describe("Berichts-Platzhalter: Pfad im Snapshot auflösen", () => {
  const snap = { order: { order_number: "L1" }, list: [{ name: "a" }, { name: "b" }] };

  it("folgt Punkt- und Index-Schreibweise", () => {
    expect(resolvePath(snap, "order.order_number")).toBe("L1");
    expect(resolvePath(snap, "list[1].name")).toBe("b");
    expect(resolvePath(snap, "list.0.name")).toBe("a");
  });

  it("liefert undefined für fehlende Zwischenstufen, leeren Pfad oder fehlenden Snapshot", () => {
    expect(resolvePath(snap, "project.name")).toBeUndefined();
    expect(resolvePath(snap, "")).toBeUndefined();
    expect(resolvePath(null, "order.order_number")).toBeUndefined();
  });
});

describe("Berichts-Platzhalter: Werte formatieren", () => {
  it("zeigt leere Werte als Gedankenstrich", () => {
    for (const v of [null, undefined, "", []]) expect(formatPlaceholderValue(v)).toBe("—");
  });

  it("zeigt Wahrheitswerte als Ja/Nein und 0 als 0", () => {
    expect(formatPlaceholderValue(true)).toBe("Ja");
    expect(formatPlaceholderValue(false)).toBe("Nein");
    expect(formatPlaceholderValue(0)).toBe("0");
  });

  it("verbindet einfache Listen mit Komma, Tabellenzeilen zeilenweise mit ·", () => {
    expect(formatPlaceholderValue(["L1", "L2"])).toBe("L1, L2");
    expect(formatPlaceholderValue([{ a: "SiO2", b: 50 }, { a: "Al2O3", b: 30 }])).toBe("SiO2 · 50\nAl2O3 · 30");
  });

  it("zeigt Objekte als Schlüssel: Wert", () => {
    expect(formatPlaceholderValue({ user: "Anna", hours: 1.5 })).toBe("user: Anna · hours: 1.5");
  });

  it("formatiert ISO-Datumswerte deutsch (Österreich), anderen Text unverändert", () => {
    expect(formatPlaceholderValue("2025-11-04T10:30:00")).toBe("4.11.2025, 10:30:00");
    expect(formatPlaceholderValue("Probe 2025-11-04")).toBe("Probe 2025-11-04");
    expect(formatPlaceholderValue("12 %")).toBe("12 %");
  });
});

describe("Berichts-Platzhalter: Tokens ersetzen", () => {
  const snap = {
    order: { order_number: "L2500123", notes: null, priority: "" },
    customer_form: { probe: "A/4", leer: "" },
    employee_form: { geraet: "Analyzer 3000" },
    auftrag: { auftragsnummer: "L2500123" },
    raw_material: { recipe: [{ material: "SiO2" }] },
  };

  it("ersetzt bekannte Tokens, auch mit Leerzeichen innerhalb der Klammern", () => {
    expect(replaceTokens("Auftrag {{Auftragsnummer}}", snap)).toBe("Auftrag L2500123");
    expect(replaceTokens("Auftrag {{ Auftragsnummer }}", snap)).toBe("Auftrag L2500123");
    expect(replaceTokens("{{Hauptrohstoff}}", snap)).toBe("SiO2");
  });

  it("ersetzt mehrfach vorkommende und verschiedene Tokens in einem Text", () => {
    expect(replaceTokens("{{Auftragsnummer}}/{{AG:probe}}/{{Auftragsnummer}}", snap)).toBe("L2500123/A/4/L2500123");
  });

  it("liest Auftraggeber- und Messdienstleisterfelder über AG: und MDL:", () => {
    expect(replaceTokens("{{AG:probe}}", snap)).toBe("A/4");
    expect(replaceTokens("{{AG: probe }}", snap)).toBe("A/4");
    expect(replaceTokens("{{MDL:geraet}}", snap)).toBe("Analyzer 3000");
    expect(replaceTokens("{{MDL:probe}}", snap)).toBe("—");
  });

  it("zeigt leere Werte bekannter Tokens als Gedankenstrich", () => {
    expect(replaceTokens("Notiz: {{Auftragsnotizen}}", snap)).toBe("Notiz: —");
    expect(replaceTokens("{{Prioritaet}}", snap)).toBe("—");
    expect(replaceTokens("{{Projekt}}", snap)).toBe("—");
    expect(replaceTokens("{{AG:leer}}", snap)).toBe("—");
  });

  it("löst freie Pfade und Systemvariablen auf", () => {
    expect(replaceTokens("{{customer_form.probe}}", snap)).toBe("A/4");
    expect(replaceTokens("{{auftrag.auftragsnummer}}", snap)).toBe("L2500123");
    expect(replaceTokens("{{order.notes}}", snap)).toBe("—");
  });

  it("lässt unbekannte Tokens und nicht auflösbare Pfade unverändert stehen", () => {
    expect(replaceTokens("{{Unbekannt}} und {{gibt.es.nicht}}", snap)).toBe("{{Unbekannt}} und {{gibt.es.nicht}}");
    expect(replaceTokens("ohne Token { einfach }", snap)).toBe("ohne Token { einfach }");
  });

  it("liefert für leeren Text einen leeren String", () => {
    expect(replaceTokens("", snap)).toBe("");
    expect(replaceTokens(null as unknown as string, snap)).toBe("");
  });
});

describe("Report-Bindings: Pfade gegen shared_data und Auftrag", () => {
  const ctx = {
    shared: { schrittA: { feld: 5, liste: [{ value: "x" }], leer: null }, order: { nicht: "shared" } },
    order: { order_number: "L1" },
  };

  it("liest Schrittwerte verschachtelt, auch über Listenindex", () => {
    expect(resolveBindingPath("schrittA.feld", ctx)).toBe(5);
    expect(resolveBindingPath("schrittA.liste.0.value", ctx)).toBe("x");
    expect(resolveBindingPath(" schrittA . feld ", ctx)).toBe(5);
  });

  it("liest order.* aus dem Auftrag, nicht aus shared_data", () => {
    expect(resolveBindingPath("order.order_number", ctx)).toBe("L1");
    expect(resolveBindingPath("order.nicht", ctx)).toBeUndefined();
    expect(resolveBindingPath("order.order_number", { shared: {} })).toBeUndefined();
  });

  it("liefert undefined für leere oder nicht vorhandene Pfade", () => {
    expect(resolveBindingPath("", ctx)).toBeUndefined();
    expect(resolveBindingPath("...", ctx)).toBeUndefined();
    expect(resolveBindingPath("schrittB.feld", ctx)).toBeUndefined();
    expect(resolveBindingPath("schrittA.leer.tiefer", ctx)).toBeUndefined();
  });

  it("ersetzt Tokens im Text: Werte als Text, fehlende leer, Objekte als JSON", () => {
    expect(renderBindingString("Nr {{order.order_number}}, Wert {{ schrittA.feld }}", ctx)).toBe("Nr L1, Wert 5");
    expect(renderBindingString("[{{schrittA.leer}}][{{fehlt.ganz}}]", ctx)).toBe("[][]");
    expect(renderBindingString("{{schrittA.liste}}", ctx)).toBe('[{"value":"x"}]');
    expect(renderBindingString("{{a}}{{a}}", { shared: { a: 0 } })).toBe("00");
    expect(renderBindingString("{{a}}", { shared: { a: false } })).toBe("false");
  });

  it("löst einen ganzen Baum auf, lässt Nicht-Texte unverändert und verändert die Eingabe nicht", () => {
    const tpl = { titel: "Auftrag {{order.order_number}}", zeilen: ["{{schrittA.feld}}", 3, null], flag: true };
    const kopie = structuredClone(tpl);
    const sharedKopie = structuredClone(ctx.shared);
    expect(renderBindings(tpl, ctx)).toEqual({ titel: "Auftrag L1", zeilen: ["5", 3, null], flag: true });
    expect(tpl).toEqual(kopie);
    expect(ctx.shared).toEqual(sharedKopie);
  });

  it("flacht shared_data zu Zeilen (Schritt, Feld, Wert) ab; Nicht-Objekte ohne Feldschlüssel", () => {
    expect(flattenSharedData({ a: { x: 1, y: "z" }, b: 5, c: [1, 2] })).toEqual([
      { stepKey: "a", fieldKey: "x", value: 1 },
      { stepKey: "a", fieldKey: "y", value: "z" },
      { stepKey: "b", fieldKey: "", value: 5 },
      { stepKey: "c", fieldKey: "", value: [1, 2] },
    ]);
    expect(flattenSharedData(null as unknown as Record<string, unknown>)).toEqual([]);
  });
});

describe("Berichts-Feldkatalog: Pfad mit Ablageort-Rückfall auflösen", () => {
  it("nimmt den exakten Treffer, wenn er einen Wert hat", () => {
    const snap = { customer_form: { probe: "AG" }, employee_form: { probe: "MDL" } };
    expect(resolveReportPath(snap, "customer_form.probe")).toBe("AG");
  });

  it("sucht ein leeres oder fehlendes Feld in den anderen Formularbereichen", () => {
    const snap = { customer_form: { probe: "" }, employee_form: { probe: "MDL" }, computed: { dichte: 2.6 } };
    expect(resolveReportPath(snap, "customer_form.probe")).toBe("MDL");
    expect(resolveReportPath(snap, "order.dichte")).toBe(2.6);
    expect(resolveReportPath({ order: { nr: "L1" } }, "nr")).toBe("L1");
  });

  it("überspringt auch leere Werte in den Rückfall-Ablageorten", () => {
    const snap = { customer_form: { x: "" }, employee_form: { x: "" }, order: { x: null }, computed: { x: "Wert" } };
    expect(resolveReportPath(snap, "customer_form.x")).toBe("Wert");
  });

  it("liefert den leeren exakten Wert, wenn nirgends ein Wert steht", () => {
    expect(resolveReportPath({ customer_form: { probe: "" } }, "customer_form.probe")).toBe("");
    expect(resolveReportPath({}, "customer_form.probe")).toBeUndefined();
  });

  it("liefert undefined ohne Snapshot oder Pfad", () => {
    expect(resolveReportPath(null, "a.b")).toBeUndefined();
    expect(resolveReportPath({ a: { b: 1 } }, "")).toBeUndefined();
  });
});

describe("Berichts-Feldkatalog: Werte formatieren", () => {
  it("leere Werte werden zu leerem Text, auch mit Einheit", () => {
    expect(formatReportValue(null, { unit: "mm" })).toBe("");
    expect(formatReportValue("", { unit: "mm" })).toBe("");
    expect(formatReportValue([], { unit: "mm" })).toBe("");
  });

  it("formatiert Zahlen deutsch und hängt die Einheit an, außer sie ist abgeschaltet", () => {
    expect(formatReportValue(1234.5)).toBe("1.234,5");
    expect(formatReportValue(2.61, { unit: "g/cm³" })).toBe("2,61 g/cm³");
    expect(formatReportValue(2.61, { unit: "g/cm³", showUnit: false })).toBe("2,61");
    expect(formatReportValue(0, { unit: "%" })).toBe("0 %");
  });

  it("formatiert Zahlen als Text mit Dezimalpunkt deutsch, andere Texte bleiben unverändert", () => {
    expect(formatReportValue("1234.5")).toBe("1.234,5");
    expect(formatReportValue("-3")).toBe("-3");
    expect(formatReportValue("12,4")).toBe("12,4");
    expect(formatReportValue("ca. 5")).toBe("ca. 5");
    expect(formatReportValue("1e3")).toBe("1e3");
  });

  it("rundet mit festen Nachkommastellen, auch bei Dezimalkomma im Text", () => {
    expect(formatReportValue(2.456, { format: "0" })).toBe("2");
    expect(formatReportValue(2.456, { format: "0.0" })).toBe("2,5");
    expect(formatReportValue("2,4", { format: "0.00", unit: "%" })).toBe("2,40 %");
    expect(formatReportValue(1234.5, { format: "0.000" })).toBe("1.234,500");
    expect(formatReportValue("abc", { format: "0.00" })).toBe("abc");
  });

  it("formatiert Datum, Datum mit Uhrzeit und Uhrzeit; ungültige Daten bleiben als Text", () => {
    const s = "2025-11-04T10:30:00";
    expect(formatReportValue(s, { format: "date" })).toBe("4.11.2025");
    expect(formatReportValue(s, { format: "time" })).toBe("10:30");
    expect(formatReportValue(s, { format: "datetime" })).toBe("4.11.2025, 10:30:00");
    expect(formatReportValue("kein Datum", { format: "date" })).toBe("kein Datum");
    expect(formatReportValue(s)).toBe("4.11.2025, 10:30:00");
  });

  it("zeigt Wahrheitswerte, Listen, Tabellen und Objekte lesbar", () => {
    expect(formatReportValue(true)).toBe("Ja");
    expect(formatReportValue(false, { unit: "x" })).toBe("Nein");
    expect(formatReportValue(["a", "b"])).toBe("a, b");
    expect(formatReportValue([{ m: "SiO2", q: 50 }, { m: "Al2O3", q: 30 }])).toBe("SiO2 · 50\nAl2O3 · 30");
    expect(formatReportValue({ a: 1, b: "x" })).toBe("a: 1 · b: x");
  });
});

describe("Berichts-Feldkatalog: Beispielwerte für die Vorschau", () => {
  it("liefert je Datentyp einen passenden Beispielwert", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T08:00:00.000Z"));
    expect(sampleValueFor({ dataType: "number", label: "x" })).toBe(4.8);
    expect(sampleValueFor({ dataType: "decimal", label: "x" })).toBe(4.8);
    expect(sampleValueFor({ dataType: "percent", label: "x" })).toBe(12.5);
    expect(sampleValueFor({ dataType: "boolean", label: "x" })).toBe(true);
    expect(sampleValueFor({ dataType: "date", label: "x" })).toBe("2026-03-15");
    expect(sampleValueFor({ dataType: "datetime", label: "x" })).toBe("2026-03-15T08:00:00.000Z");
    expect(sampleValueFor({ dataType: "text", label: "Dichte" })).toBe("Dichte (Beispiel)");
    expect(sampleValueFor({ dataType: null, label: "Dichte" })).toBe("Dichte (Beispiel)");
  });
});
