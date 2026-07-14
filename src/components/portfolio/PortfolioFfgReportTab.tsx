import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
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

export default function PortfolioFfgReportTab({ portfolioId, portfolioName }: Props) {
  const { data: ffg = [] } = useQuery({
    queryKey: ["portfolio-ffg-summary", portfolioId],
    queryFn: () => api.portfolioFfgAnalytics.ffgSummary(portfolioId),
  });
  const { data: hoursByTask = [] } = useQuery({
    queryKey: ["portfolio-ffg-hours-task", portfolioId],
    queryFn: () => api.portfolioFfgAnalytics.hoursByTask(portfolioId),
  });
  const { data: hoursByCategory = [] } = useQuery({
    queryKey: ["portfolio-ffg-hours-cat", portfolioId],
    queryFn: () => api.portfolioFfgAnalytics.hoursByCategory(portfolioId),
  });
  const { data: costsByWp = [] } = useQuery({
    queryKey: ["portfolio-ffg-costs-wp", portfolioId],
    queryFn: () => api.portfolioFfgAnalytics.costsByWorkPackage(portfolioId),
  });

  const totalHours = ffg.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const totalCost = costsByWp.reduce((s: number, r: any) => s + Number(r.total_cost ?? r.cost ?? 0), 0);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();

    const sheet1 = [
      ["FFG-Bericht", portfolioName],
      ["Erstellt am", new Date().toLocaleString("de-DE")],
      [],
      ["Portfolio-Arbeitspakete – Stunden"],
      ["Nr.", "Arbeitspaket", "Kategorie", "Stunden"],
      ...ffg.map((r) => [r.work_package_code ?? "", r.work_package_name, r.category_name ?? "", Number(r.hours ?? 0)]),
      ["", "", "Summe", totalHours],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), "APs");

    const sheet2 = [
      ["Task-Nr.", "Task", "Arbeitspaket", "Stunden"],
      ...hoursByTask.map((r: any) => [
        r.task_code ?? "",
        r.task_name ?? "",
        r.work_package_name ?? "",
        Number(r.hours ?? 0),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Tasks");

    const sheet3 = [
      ["Kategorie", "Stunden"],
      ...hoursByCategory.map((r: any) => [r.category_name ?? r.name ?? "", Number(r.hours ?? 0)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3), "Kategorien");

    const sheet4 = [
      ["Arbeitspaket", "Kosten (€)"],
      ...costsByWp.map((r: any) => [r.work_package_name ?? r.name ?? "", Number(r.total_cost ?? r.cost ?? 0)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet4), "Kosten");

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
    doc.text(`Erstellt am ${new Date().toLocaleString("de-DE")}`, 14, y); y += 8;

    doc.setFontSize(11);
    doc.text("Portfolio-Arbeitspakete – Stunden", 14, y); y += 5;
    doc.setFontSize(9);
    doc.text("Nr.", 14, y);
    doc.text("Arbeitspaket", 30, y);
    doc.text("Kategorie", 110, y);
    doc.text("Stunden", 175, y, { align: "right" });
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

    if (hoursByTask.length) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.text("Stunden je Task", 14, y); y += 5;
      doc.setFontSize(9);
      hoursByTask.forEach((r: any) => {
        if (y > 285) { doc.addPage(); y = 15; }
        doc.text(`${r.task_code ?? ""} ${r.task_name ?? ""}`.substring(0, 60), 14, y);
        doc.text(fmtHours(r.hours), 195, y, { align: "right" });
        y += 5;
      });
    }

    doc.save(`FFG-Bericht_${portfolioName.replace(/\W+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">FFG-Bericht</h3>
          <p className="text-sm text-muted-foreground">
            Automatische Aggregation nach Portfolio-Arbeitspaketen (via Kategorien-Zuordnung) und Tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Portfolio-Arbeitspaket</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Nr.</TableHead>
                <TableHead>Arbeitspaket</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right w-32">Stunden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ffg.map((r) => (
                <TableRow key={r.work_package_id}>
                  <TableCell className="font-mono">{r.work_package_code ?? "—"}</TableCell>
                  <TableCell>{r.work_package_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.category_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
                </TableRow>
              ))}
              {ffg.length > 0 && (
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={3}>Summe</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtHours(totalHours)}</TableCell>
                </TableRow>
              )}
              {ffg.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Daten</TableCell></TableRow>
              )}
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
                  <TableHead className="w-24">Nr.</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Arbeitspaket</TableHead>
                  <TableHead className="text-right w-32">Stunden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hoursByTask.map((r: any) => (
                  <TableRow key={r.task_id ?? `${r.task_name}-${r.work_package_name}`}>
                    <TableCell className="font-mono">{r.task_code ?? "—"}</TableCell>
                    <TableCell>{r.task_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.work_package_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Stunden je Kategorie</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Kategorie</TableHead><TableHead className="text-right w-32">Stunden</TableHead></TableRow></TableHeader>
              <TableBody>
                {hoursByCategory.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">Keine Daten</TableCell></TableRow>
                ) : hoursByCategory.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{r.category_name ?? r.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(r.hours)}</TableCell>
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
    </div>
  );
}
