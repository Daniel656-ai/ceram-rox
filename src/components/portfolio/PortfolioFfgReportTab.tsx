import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet, AlertTriangle, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

interface Props {
  portfolioId: string;
  portfolioName: string;
}

function fmtHours(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Die Analysefunktionen liefern Minuten – die Anzeige rechnet daraus Stunden. */
const minutesToHours = (m: number | null | undefined) => Number(m ?? 0) / 60;

export default function PortfolioFfgReportTab({ portfolioId, portfolioName }: Props) {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const range = [start || null, end || null] as const;
  const keyRange = `${start}|${end}`;

  const { data: ffg = [] } = useQuery({
    queryKey: ["portfolio-ffg-summary", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.ffgSummary(portfolioId, range[0], range[1]),
  });
  const { data: hoursByTask = [] } = useQuery({
    queryKey: ["portfolio-ffg-hours-task", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.hoursByTask(portfolioId, range[0], range[1]),
  });
  const { data: hoursByCategory = [] } = useQuery({
    queryKey: ["portfolio-ffg-hours-cat", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.hoursByCategory(portfolioId, range[0], range[1]),
  });
  const { data: byPersonProject = [] } = useQuery({
    queryKey: ["portfolio-ffg-person-project", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.hoursByPersonProject(portfolioId, range[0], range[1]),
  });
  const { data: diagnostics = [] } = useQuery({
    queryKey: ["portfolio-ffg-diagnostics", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.diagnostics(portfolioId, range[0], range[1]),
  });
  const { data: costsByWp = [] } = useQuery({
    queryKey: ["portfolio-ffg-costs-wp", portfolioId, keyRange],
    queryFn: () => api.portfolioFfgAnalytics.costsByWorkPackage(portfolioId, range[0], range[1]),
  });

  const totalHours = ffg.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const totalPersonHours = byPersonProject.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const totalCost = costsByWp.reduce((s: number, r: any) => s + Number(r.total_cost ?? r.cost ?? 0), 0);
  const mismatch = Math.abs(totalHours - totalPersonHours) > 0.01;
  const problems = diagnostics.filter((d) => d.severity !== "info");

  /** Stunden je Projekt aus denselben Buchungen aggregiert. */
  const byProject = Object.values(
    byPersonProject.reduce<Record<string, { key: string; number: string | null; name: string; hours: number }>>((acc, r) => {
      const k = r.project_id;
      acc[k] = acc[k] ?? { key: k, number: r.project_number, name: r.project_name, hours: 0 };
      acc[k].hours += Number(r.hours ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => (a.number ?? "").localeCompare(b.number ?? ""));

  const periodLabel = start || end ? `${start || "Beginn"} – ${end || "heute"}` : "gesamter Zeitraum";

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();

    const sheet1 = [
      ["FFG-Bericht", portfolioName],
      ["Zeitraum", periodLabel],
      ["Erstellt am", new Date().toLocaleString("de-DE")],
      [],
      ["Portfolio-Arbeitspakete – Stunden"],
      ["Nr.", "Arbeitspaket", "Kategorie", "Stunden", "Buchungen"],
      ...ffg.map((r) => [r.work_package_code ?? "", r.work_package_name, r.category_name ?? "", Number(r.hours ?? 0), Number(r.entries_count ?? 0)]),
      ["", "", "Summe", totalHours],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), "APs");

    const sheet2 = [
      ["Task-Nr.", "Task", "Arbeitspaket", "Stunden"],
      ...hoursByTask.map((r: any) => [r.task_code ?? "", r.task_name ?? "", r.work_package_name ?? "", minutesToHours(r.minutes)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Tasks");

    const sheet3 = [
      ["Kategorie", "Stunden"],
      ...hoursByCategory.map((r: any) => [r.category_name ?? "—", minutesToHours(r.minutes)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3), "Kategorien");

    const sheet4 = [
      ["Mitarbeiter", "Kurzzeichen", "Projekt-Nr.", "Projekt", "Arbeitspaket", "Stunden", "Buchungen"],
      ...byPersonProject.map((r) => [
        r.person_name, r.short_code ?? "", r.project_number ?? "", r.project_name,
        r.work_package_name ?? "Nicht zugeordnet", Number(r.hours ?? 0), Number(r.entries_count ?? 0),
      ]),
      ["", "", "", "", "Summe", totalPersonHours],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet4), "Mitarbeiter je Projekt");

    const sheet5 = [
      ["Arbeitspaket", "Kosten (€)"],
      ...costsByWp.map((r: any) => [r.work_package_name ?? r.name ?? "", Number(r.total_cost ?? r.cost ?? 0)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet5), "Kosten");

    if (diagnostics.length) {
      const sheet6 = [
        ["Befund", "Schwere", "Bezug", "Detail", "Stunden"],
        ...diagnostics.map((d) => [d.issue, d.severity, d.reference ?? "", d.detail ?? "", Number(d.hours ?? 0)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet6), "Datenprüfung");
    }

    XLSX.writeFile(wb, `FFG-Bericht_${portfolioName.replace(/\W+/g, "_")}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(16);
    doc.text(`FFG-Bericht`, 14, y); y += 7;
    doc.setFontSize(12);
    doc.text(portfolioName, 14, y); y += 6;
    doc.setFontSize(9);
    doc.text(`Zeitraum: ${periodLabel} · Erstellt am ${new Date().toLocaleString("de-DE")}`, 14, y); y += 8;

    doc.setFontSize(11);
    doc.text("Portfolio-Arbeitspakete – Stunden", 14, y); y += 5;
    doc.setFontSize(9);
    doc.text("Nr.", 14, y);
    doc.text("Arbeitspaket", 30, y);
    doc.text("Kategorie", 110, y);
    doc.text("Stunden", 195, y, { align: "right" });
    y += 1;
    doc.line(14, y, 195, y); y += 4;

    ffg.forEach((r) => {
      if (y > 275) { doc.addPage(); y = 15; }
      doc.text(String(r.work_package_code ?? ""), 14, y);
      doc.text(String(r.work_package_name).substring(0, 45), 30, y);
      doc.text(String(r.category_name ?? "—").substring(0, 30), 110, y);
      doc.text(fmtHours(r.hours), 195, y, { align: "right" });
      y += 5;
    });
    y += 2;
    doc.line(14, y, 195, y); y += 5;
    doc.setFontSize(10);
    doc.text("Summe", 14, y);
    doc.text(fmtHours(totalHours), 195, y, { align: "right" });
    y += 8;

    if (byPersonProject.length) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.text("Stunden je Mitarbeiter und Projekt", 14, y); y += 5;
      doc.setFontSize(9);
      byPersonProject.forEach((r) => {
        if (y > 285) { doc.addPage(); y = 15; }
        doc.text(`${r.person_name} · ${r.project_number ?? ""} ${r.project_name}`.substring(0, 70), 14, y);
        doc.text(fmtHours(r.hours), 195, y, { align: "right" });
        y += 5;
      });
      y += 6;
    }

    if (hoursByTask.length) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.text("Stunden je Task", 14, y); y += 5;
      doc.setFontSize(9);
      hoursByTask.forEach((r: any) => {
        if (y > 285) { doc.addPage(); y = 15; }
        doc.text(`${r.task_code ?? ""} ${r.task_name ?? ""}`.substring(0, 60), 14, y);
        doc.text(fmtHours(minutesToHours(r.minutes)), 195, y, { align: "right" });
        y += 5;
      });
    }

    doc.save(`FFG-Bericht_${portfolioName.replace(/\W+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">FFG-Bericht</h3>
          <p className="text-sm text-muted-foreground">
            Alle Werte stammen direkt aus den Arbeitszeitbuchungen der Portfolio-Projekte und werden
            über interne Kennungen dem Portfolio-Arbeitspaket zugeordnet.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Von</Label>
            <Input type="date" className="h-8 w-36" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bis</Label>
            <Input type="date" className="h-8 w-36" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {(start || end) && (
            <Button size="sm" variant="ghost" onClick={() => { setStart(""); setEnd(""); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Zeitraum zurücksetzen
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {mismatch && (
        <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
          <span>
            Abweichung zwischen Arbeitspaket-Summe ({fmtHours(totalHours)} h) und Mitarbeiter-Summe
            ({fmtHours(totalPersonHours)} h). Siehe Datenprüfung unten.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Portfolio-Arbeitspaket</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Nr.</TableHead>
                <TableHead>Arbeitspaket</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right w-24">Buchungen</TableHead>
                <TableHead className="text-right w-32">Stunden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ffg.map((r) => (
                <TableRow key={r.work_package_id ?? "unmapped"} className={r.work_package_id ? "" : "bg-destructive/5"}>
                  <TableCell className="font-mono">{r.work_package_code ?? "—"}</TableCell>
                  <TableCell>{r.work_package_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.category_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.entries_count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
                </TableRow>
              ))}
              {ffg.length > 0 && (
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={4}>Summe</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtHours(totalHours)}</TableCell>
                </TableRow>
              )}
              {ffg.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Daten</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Mitarbeiter und Projekt</CardTitle></CardHeader>
        <CardContent>
          {byPersonProject.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Keine Arbeitszeitbuchungen im Zeitraum.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Arbeitspaket</TableHead>
                  <TableHead className="text-right w-32">Stunden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPersonProject.map((r, i) => (
                  <TableRow key={`${r.person_id}-${r.project_id}-${r.work_package_id ?? i}`}>
                    <TableCell>{r.person_name}{r.short_code ? ` (${r.short_code})` : ""}</TableCell>
                    <TableCell>{r.project_number ? `${r.project_number} · ` : ""}{r.project_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.work_package_name ?? "Nicht zugeordnet"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={3}>Summe</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtHours(totalPersonHours)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Projekt</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Projekt</TableHead><TableHead className="text-right w-32">Stunden</TableHead></TableRow></TableHeader>
              <TableBody>
                {byProject.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">Keine Daten</TableCell></TableRow>
                ) : byProject.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>{p.number ? `${p.number} · ` : ""}{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(p.hours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Task</CardTitle></CardHeader>
          <CardContent>
            {hoursByTask.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Keine Task-Buchungen.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Nr.</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right w-28">Stunden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoursByTask.map((r: any) => (
                    <TableRow key={r.task_id}>
                      <TableCell className="font-mono">{r.task_code ?? "—"}</TableCell>
                      <TableCell>{r.task_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtHours(minutesToHours(r.minutes))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Kategorie</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Kategorie</TableHead><TableHead className="text-right w-32">Stunden</TableHead></TableRow></TableHeader>
              <TableBody>
                {hoursByCategory.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">Keine Daten</TableCell></TableRow>
                ) : hoursByCategory.map((r: any, i: number) => (
                  <TableRow key={r.category_id ?? i}>
                    <TableCell>{r.category_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(minutesToHours(r.minutes))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Kosten je Arbeitspaket</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Arbeitspaket</TableHead><TableHead className="text-right w-32">Kosten</TableHead></TableRow></TableHeader>
              <TableBody>
                {costsByWp.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">Keine Daten</TableCell></TableRow>
                ) : costsByWp.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{r.work_package_name ?? r.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.total_cost ?? r.cost ?? 0))} €</TableCell>
                  </TableRow>
                ))}
                {costsByWp.length > 0 && (
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Summe</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totalCost)} €</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Datenprüfung
            {problems.length > 0 && <Badge variant="destructive">{problems.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostics.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Keine auffälligen Verknüpfungen – alle Buchungen sind im Bericht berücksichtigt.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Befund</TableHead>
                  <TableHead>Bezug</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right w-28">Stunden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant={d.severity === "error" ? "destructive" : d.severity === "warning" ? "secondary" : "outline"}>
                        {d.issue}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.reference ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{d.detail ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(d.hours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
