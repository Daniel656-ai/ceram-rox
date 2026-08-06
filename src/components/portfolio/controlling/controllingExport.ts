import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { ControllingReport } from "@/lib/api/portfolioControlling";

export interface ExportMeta {
  title: string;
  periodLabel: string;
  filterLines: string[];
}

type Sheet = { name: string; rows: (string | number | null)[][] };

const n2 = (v: number | null | undefined) =>
  v == null ? 0 : Math.round(Number(v) * 100) / 100;

/** Baut aus dem Report die Tabellen für alle Exportformate (Filter sind bereits angewandt). */
export function buildExportSheets(report: ControllingReport, meta: ExportMeta): Sheet[] {
  const s = report.summary;
  const sheets: Sheet[] = [];

  sheets.push({
    name: "Kennzahlen",
    rows: [
      [meta.title],
      ["Zeitraum", meta.periodLabel],
      ...meta.filterLines.map((l) => ["Filter", l]),
      ["Erstellt am", new Date().toLocaleString("de-DE")],
      [],
      ["Kennzahl", "Wert"],
      ["Gesamtstunden (h)", n2(s.hours_total)],
      ["Zeitbuchungen", s.entries_count],
      ["Beteiligte Personen", s.people_count],
      ["Projekte", s.project_count],
      ["Arbeitspakete", s.wp_count],
      ["Tasks", s.task_count],
      ["Proben", s.sample_count],
      ["Dienstleistungen", s.service_count],
      ["Abgeschlossene Aufträge", s.orders_completed],
      ["Ø Bearbeitungsdauer (Tage)", s.avg_lead_days ?? 0],
      [],
      ["Kostenart", "Betrag (EUR)"],
      ["Personalkosten", n2(s.personnel_cost)],
      ["Materialkosten", n2(s.material_cost)],
      ["Fremdleistungen", n2(s.external_cost)],
      ["Reisekosten", n2(s.travel_cost)],
      ["Sonstige Kosten", n2(s.other_cost)],
      ["Projektaufwendungen (erfasst)", n2(s.expenses_cost)],
      ["Gesamtkosten", n2(s.cost_total)],
      ["Budget", n2(s.budget_total)],
      ["Restbudget", n2(s.budget_remaining)],
    ],
  });

  sheets.push({
    name: "Kosten je Projekt",
    rows: [
      [
        "Projekt-Nr.",
        "Projekt",
        "Status",
        "Förderprojekt",
        "Stunden",
        "Personal",
        "Material",
        "Fremdleistungen",
        "Reisekosten",
        "Sonstige",
        "Gesamt",
        "Budget",
        "Restbudget",
      ],
      ...report.costs_by_project.map((r) => [
        r.code,
        r.label,
        r.status,
        r.funded ? "ja" : "nein",
        n2(r.hours),
        n2(r.personnel),
        n2(r.material),
        n2(r.external),
        n2(r.travel),
        n2(r.other),
        n2(r.total),
        n2(r.budget),
        n2(r.budget - r.total),
      ]),
    ],
  });

  const group = (name: string, rows: { label: string; hours?: number; total?: number }[], valueLabel: string) =>
    sheets.push({
      name,
      rows: [
        ["Bezeichnung", valueLabel],
        ...rows.map((r) => [r.label, n2(r.hours ?? r.total ?? 0)]),
      ],
    });

  group("Stunden je Person", report.hours_by_person, "Stunden");
  group("Stunden je AP", report.hours_by_work_package, "Stunden");
  group("Stunden je Task", report.hours_by_task, "Stunden");
  group("Stunden je Schwerpunkt", report.hours_by_focus, "Stunden");
  group("Kosten je AP", report.costs_by_work_package, "Betrag (EUR)");
  group("Kosten je Kostenart", report.costs_by_category, "Betrag (EUR)");

  sheets.push({
    name: "Verlauf",
    rows: [
      ["Monat", "Stunden", "Personal", "Material", "Fremdleistungen", "Reisekosten", "Sonstige", "Gesamt"],
      ...report.by_month.map((m) => [
        m.month,
        n2(m.hours),
        n2(m.personal),
        n2(m.material),
        n2(m.external),
        n2(m.travel),
        n2(m.other),
        n2(m.total),
      ]),
    ],
  });

  sheets.push({
    name: "Stundenjournal",
    rows: [
      ["Datum", "Projekt-Nr.", "Projekt", "Person", "Arbeitspaket", "Task", "Schwerpunkt", "Typ", "Stunden", "Notiz"],
      ...report.hours_journal.map((r) => [
        r.date,
        r.project_number,
        r.project_name,
        r.person,
        r.work_package,
        r.task,
        r.focus,
        r.type,
        n2(r.hours),
        r.note ?? "",
      ]),
    ],
  });

  sheets.push({
    name: "Kostenjournal",
    rows: [
      ["Datum", "Kostenart", "Kategorie", "Projekt-Nr.", "Projekt", "Arbeitspaket", "Kostenstelle", "Beschreibung", "Betrag (EUR)"],
      ...report.cost_journal.map((r) => [
        r.date,
        r.kind,
        r.category,
        r.project_number,
        r.project_name,
        r.work_package,
        r.cost_center ?? "",
        r.description,
        n2(r.amount),
      ]),
    ],
  });

  return sheets;
}

function fileBase(meta: ExportMeta) {
  return `${meta.title}_${meta.periodLabel}`.replace(/\W+/g, "_").slice(0, 80);
}

export function exportControllingXlsx(report: ControllingReport, meta: ExportMeta) {
  const wb = XLSX.utils.book_new();
  for (const sheet of buildExportSheets(report, meta)) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sheet.rows),
      sheet.name.slice(0, 31)
    );
  }
  XLSX.writeFile(wb, `${fileBase(meta)}.xlsx`);
}

export function exportControllingCsv(report: ControllingReport, meta: ExportMeta) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  for (const sheet of buildExportSheets(report, meta)) {
    lines.push(`# ${sheet.name}`);
    for (const row of sheet.rows) lines.push(row.map(esc).join(";"));
    lines.push("");
  }
  // UTF-8 BOM für korrekte Umlaute in Excel
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(meta)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportControllingPdf(report: ControllingReport, meta: ExportMeta) {
  const doc = new jsPDF();
  let y = 15;
  const line = (text: string, size = 9, indent = 14) => {
    if (y > 282) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(size);
    doc.text(text, indent, y);
    y += size > 10 ? 7 : 5;
  };
  const right = (text: string, atY: number) => doc.text(text, 195, atY, { align: "right" });
  const eur = (v: number) => `${Number(v ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  const hrs = (v: number) => Number(v ?? 0).toLocaleString("de-DE", { maximumFractionDigits: 2 });

  line(meta.title, 16);
  line(`Zeitraum: ${meta.periodLabel}`, 11);
  meta.filterLines.forEach((f) => line(f, 8));
  line(`Erstellt am ${new Date().toLocaleString("de-DE")}`, 8);
  y += 3;

  const s = report.summary;
  line("Kennzahlen", 12);
  const kpis: [string, string][] = [
    ["Gesamtstunden", `${hrs(s.hours_total)} h`],
    ["Personalkosten", eur(s.personnel_cost)],
    ["Materialkosten", eur(s.material_cost)],
    ["Fremdleistungen", eur(s.external_cost)],
    ["Reisekosten", eur(s.travel_cost)],
    ["Sonstige Kosten", eur(s.other_cost)],
    ["Projektaufwendungen", eur(s.expenses_cost)],
    ["Gesamtkosten", eur(s.cost_total)],
    ["Budget", eur(s.budget_total)],
    ["Restbudget", eur(s.budget_remaining)],
    ["Projekte / AP / Tasks", `${s.project_count} / ${s.wp_count} / ${s.task_count}`],
    ["Proben / Dienstleistungen", `${s.sample_count} / ${s.service_count}`],
    ["Abgeschlossene Aufträge", `${s.orders_completed}`],
    ["Ø Bearbeitungsdauer", `${s.avg_lead_days ?? 0} Tage`],
  ];
  kpis.forEach(([k, v]) => {
    if (y > 282) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(9);
    doc.text(k, 14, y);
    right(v, y);
    y += 5;
  });
  y += 4;

  const section = (
    title: string,
    rows: { label: string; value: string }[],
  ) => {
    if (!rows.length) return;
    if (y > 260) {
      doc.addPage();
      y = 15;
    }
    line(title, 12);
    rows.forEach((r) => {
      if (y > 282) {
        doc.addPage();
        y = 15;
      }
      doc.setFontSize(9);
      doc.text(String(r.label).substring(0, 70), 14, y);
      right(r.value, y);
      y += 5;
    });
    y += 4;
  };

  section(
    "Kosten je Projekt",
    report.costs_by_project.map((r) => ({
      label: `${r.code} ${r.label}`,
      value: `${hrs(r.hours)} h · ${eur(r.total)}`,
    }))
  );
  section(
    "Stunden je Mitarbeiter",
    report.hours_by_person.map((r) => ({ label: r.label, value: `${hrs(r.hours ?? 0)} h` }))
  );
  section(
    "Stunden je Arbeitspaket",
    report.hours_by_work_package.map((r) => ({ label: r.label, value: `${hrs(r.hours ?? 0)} h` }))
  );
  section(
    "Kosten je Arbeitspaket",
    report.costs_by_work_package.map((r) => ({ label: r.label, value: eur(r.total ?? 0) }))
  );
  section(
    "Kosten je Kostenart",
    report.costs_by_category.map((r) => ({ label: r.label, value: eur(r.total ?? 0) }))
  );

  doc.save(`${fileBase(meta)}.pdf`);
}
