import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, FileText, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { ControllingFilters, ControllingReport } from "@/lib/api/portfolioControlling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatCurrency";
import MultiSelectFilter from "./MultiSelectFilter";
import {
  exportControllingCsv,
  exportControllingPdf,
  exportControllingXlsx,
} from "./controllingExport";

type PeriodPreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom";

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: "Gesamter Zeitraum",
  today: "Heute",
  week: "Diese Woche",
  month: "Dieser Monat",
  quarter: "Dieses Quartal",
  year: "Dieses Jahr",
  custom: "Benutzerdefiniert",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function presetRange(p: PeriodPreset): { start: string | null; end: string | null } {
  const now = new Date();
  switch (p) {
    case "today":
      return { start: iso(now), end: iso(now) };
    case "week": {
      const day = (now.getDay() + 6) % 7; // Montag = 0
      const s = new Date(now);
      s.setDate(now.getDate() - day);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: iso(s), end: iso(e) };
    }
    case "month":
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return {
        start: iso(new Date(now.getFullYear(), q * 3, 1)),
        end: iso(new Date(now.getFullYear(), q * 3 + 3, 0)),
      };
    }
    case "year":
      return {
        start: iso(new Date(now.getFullYear(), 0, 1)),
        end: iso(new Date(now.getFullYear(), 11, 31)),
      };
    default:
      return { start: null, end: null };
  }
}

const fmtHours = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("de-DE", { maximumFractionDigits: 2 });
const fmtEuro = (v: number | null | undefined) =>
  v == null ? "—" : `${formatCurrency(v)} €`;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(25 95% 53%)",
  "hsl(200 80% 45%)",
  "hsl(150 60% 40%)",
  "hsl(280 60% 55%)",
  "hsl(45 90% 50%)",
];

const STATUS_OPTIONS = [
  { id: "active", label: "Aktiv" },
  { id: "completed", label: "Abgeschlossen" },
];

export default function PortfolioControllingTab({
  portfolioId,
  portfolioName,
}: {
  portfolioId: string;
  portfolioName?: string;
}) {
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [portfolios, setPortfolios] = useState<string[]>([portfolioId]);
  const [projects, setProjects] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [leaders, setLeaders] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [workPackages, setWorkPackages] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [funding, setFunding] = useState<string>("alle");

  const range = useMemo(
    () =>
      preset === "custom"
        ? { start: customStart || null, end: customEnd || null }
        : presetRange(preset),
    [preset, customStart, customEnd]
  );

  const filters: ControllingFilters = useMemo(
    () => ({
      start: range.start,
      end: range.end,
      portfolio_ids: portfolios,
      project_ids: projects,
      category_ids: categories,
      leader_ids: leaders,
      person_ids: people,
      work_package_ids: workPackages,
      task_ids: tasks,
      cost_centers: costCenters,
      statuses,
      funding: funding === "alle" ? null : funding,
    }),
    [
      range,
      portfolios,
      projects,
      categories,
      leaders,
      people,
      workPackages,
      tasks,
      costCenters,
      statuses,
      funding,
    ]
  );

  const options = useQuery({
    queryKey: ["controlling-filter-options"],
    queryFn: () => api.portfolioControlling.filterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const reportQuery = useQuery({
    queryKey: ["controlling-report", filters],
    queryFn: () => api.portfolioControlling.report(filters),
  });

  const report = reportQuery.data as ControllingReport | undefined;
  const s = report?.summary;

  const periodLabel =
    range.start || range.end
      ? `${range.start ?? "Beginn"} – ${range.end ?? "heute"}`
      : "Gesamter Zeitraum";

  const filterLines = useMemo(() => {
    const o = options.data;
    const lines: string[] = [];
    const add = (label: string, ids: string[], list?: { id: string; label: string }[]) => {
      if (!ids.length) return;
      const names = ids.map((id) => list?.find((x) => x.id === id)?.label ?? id);
      lines.push(`${label}: ${names.join(", ")}`);
    };
    add("Portfolio", portfolios, o?.portfolios);
    add("Projekt", projects, o?.projects);
    add("Forschungsschwerpunkt", categories, o?.categories);
    add("Projektleiter", leaders, o?.people);
    add("Mitarbeiter", people, o?.people);
    add("Arbeitspaket", workPackages, o?.workPackages);
    add("Task", tasks, o?.tasks);
    add("Kostenstelle", costCenters, o?.costCenters);
    add("Status", statuses, STATUS_OPTIONS);
    if (funding !== "alle") lines.push(`Förderprojekt: ${funding}`);
    return lines;
  }, [
    options.data,
    portfolios,
    projects,
    categories,
    leaders,
    people,
    workPackages,
    tasks,
    costCenters,
    statuses,
    funding,
  ]);

  const exportMeta = {
    title: `Controlling-Auswertung${portfolioName ? " " + portfolioName : ""}`,
    periodLabel,
    filterLines,
  };

  const resetFilters = () => {
    setPreset("all");
    setCustomStart("");
    setCustomEnd("");
    setPortfolios([portfolioId]);
    setProjects([]);
    setCategories([]);
    setLeaders([]);
    setPeople([]);
    setWorkPackages([]);
    setTasks([]);
    setCostCenters([]);
    setStatuses([]);
    setFunding("alle");
  };

  const monthData = (report?.by_month ?? []).map((m) => ({
    month: m.month,
    Stunden: Number(m.hours),
    Personal: Number(m.personal),
    Material: Number(m.material),
    Fremdleistungen: Number(m.external),
    Reisekosten: Number(m.travel),
    Sonstige: Number(m.other),
    Gesamt: Number(m.total),
  }));

  const cumulative = useMemo(() => {
    let acc = 0;
    return monthData.map((m) => {
      acc += m.Gesamt;
      return { month: m.month, Kumuliert: Math.round(acc * 100) / 100, Budget: Number(s?.budget_total ?? 0) };
    });
  }, [monthData, s?.budget_total]);

  const busy = reportQuery.isLoading;

  return (
    <div className="space-y-4">
      {/* Zeitraum & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum &amp; Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Zeitraum</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
                <SelectTrigger className="w-52 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div>
                  <Label className="text-xs">Von</Label>
                  <Input
                    type="date"
                    className="w-40 h-9"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Bis</Label>
                  <Input
                    type="date"
                    className="w-40 h-9"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </>
            )}
            <Badge variant="outline" className="h-9 px-3 flex items-center">
              {periodLabel}
            </Badge>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" /> Zurücksetzen
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!report}
                onClick={() => report && exportControllingXlsx(report, exportMeta)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!report}
                onClick={() => report && exportControllingCsv(report, exportMeta)}
              >
                <FileText className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button
                size="sm"
                disabled={!report}
                onClick={() => report && exportControllingPdf(report, exportMeta)}
              >
                <FileDown className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <MultiSelectFilter
              label="Portfolio"
              options={options.data?.portfolios ?? []}
              value={portfolios}
              onChange={setPortfolios}
            />
            <MultiSelectFilter
              label="Projekt"
              options={options.data?.projects ?? []}
              value={projects}
              onChange={setProjects}
            />
            <MultiSelectFilter
              label="Forschungsschwerpunkt"
              options={options.data?.categories ?? []}
              value={categories}
              onChange={setCategories}
            />
            <MultiSelectFilter
              label="Projektleiter"
              options={options.data?.people ?? []}
              value={leaders}
              onChange={setLeaders}
            />
            <MultiSelectFilter
              label="Mitarbeiter"
              options={options.data?.people ?? []}
              value={people}
              onChange={setPeople}
            />
            <MultiSelectFilter
              label="Arbeitspaket"
              options={options.data?.workPackages ?? []}
              value={workPackages}
              onChange={setWorkPackages}
            />
            <MultiSelectFilter
              label="Task"
              options={options.data?.tasks ?? []}
              value={tasks}
              onChange={setTasks}
            />
            <MultiSelectFilter
              label="Kostenstelle"
              options={options.data?.costCenters ?? []}
              value={costCenters}
              onChange={setCostCenters}
            />
            <MultiSelectFilter
              label="Status"
              options={STATUS_OPTIONS}
              value={statuses}
              onChange={setStatuses}
            />
            <Select value={funding} onValueChange={setFunding}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="alle">Förderprojekt: alle</SelectItem>
                <SelectItem value="ja">nur Förderprojekte</SelectItem>
                <SelectItem value="nein">ohne Förderprojekte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Alle Kennzahlen werden ausschließlich für den gewählten Zeitraum und die gesetzten
            Filter berechnet – live aus Projekten, Arbeitspaketen, Tasks, Arbeitszeiten,
            Aufwendungen, Materialien, Dienstleistungen und Proben. Exporte übernehmen die
            aktuellen Filter.
            {report && !report.can_view_personnel_costs && (
              <> Personalkosten sind für Ihre Rolle ausgeblendet.</>
            )}
          </p>
        </CardContent>
      </Card>

      {busy && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {reportQuery.isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Auswertung konnte nicht geladen werden: {(reportQuery.error as any)?.message}
          </CardContent>
        </Card>
      )}

      {report && !busy && (
        <>
          {/* KPI Kacheln */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Kpi label="Gesamtstunden" value={`${fmtHours(s?.hours_total)} h`} sub={`${s?.entries_count ?? 0} Buchungen · ${s?.people_count ?? 0} Personen`} />
            <Kpi label="Gesamtkosten" value={fmtEuro(s?.cost_total)} sub={`Budget ${fmtEuro(s?.budget_total)}`} />
            <Kpi
              label="Budgetverbrauch"
              value={
                s && s.budget_total > 0
                  ? `${Math.round((s.cost_total / s.budget_total) * 100)} %`
                  : "—"
              }
              sub={`Rest ${fmtEuro(s?.budget_remaining)}`}
            />
            <Kpi label="Ø Bearbeitungsdauer" value={s?.avg_lead_days != null ? `${s.avg_lead_days} Tage` : "—"} sub={`${s?.orders_completed ?? 0} abgeschlossene Aufträge`} />
            <Kpi label="Personalkosten" value={fmtEuro(s?.personnel_cost)} />
            <Kpi label="Materialkosten" value={fmtEuro(s?.material_cost)} />
            <Kpi label="Fremdleistungen" value={fmtEuro(s?.external_cost)} sub={`Reisekosten ${fmtEuro(s?.travel_cost)}`} />
            <Kpi label="Projektaufwendungen" value={fmtEuro(s?.expenses_cost)} sub={`Sonstige ${fmtEuro(s?.other_cost)}`} />
            <Kpi label="Projekte" value={`${s?.project_count ?? 0}`} sub={`${s?.active_count ?? 0} aktiv · ${s?.closed_count ?? 0} abgeschlossen`} />
            <Kpi label="Arbeitspakete" value={`${s?.wp_count ?? 0}`} sub={`${s?.task_count ?? 0} Tasks`} />
            <Kpi label="Proben" value={`${s?.sample_count ?? 0}`} />
            <Kpi label="Dienstleistungen" value={`${s?.service_count ?? 0}`} sub={`${s?.orders_total ?? 0} Aufträge gesamt`} />
          </div>

          <Tabs defaultValue="charts">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="charts">Diagramme</TabsTrigger>
              <TabsTrigger value="projects">Projekte</TabsTrigger>
              <TabsTrigger value="hours">Stunden</TabsTrigger>
              <TabsTrigger value="costs">Kosten</TabsTrigger>
              <TabsTrigger value="hours-journal">Stundenjournal</TabsTrigger>
              <TabsTrigger value="cost-journal">Kostenjournal</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="mt-4 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Stundenverlauf">
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Stunden" fill={CHART_COLORS[0]} />
                </BarChart>
              </ChartCard>
              <ChartCard title="Kostenverlauf nach Kostenart">
                <LineChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Personal" stroke={CHART_COLORS[0]} />
                  <Line type="monotone" dataKey="Material" stroke={CHART_COLORS[1]} />
                  <Line type="monotone" dataKey="Fremdleistungen" stroke={CHART_COLORS[2]} />
                  <Line type="monotone" dataKey="Reisekosten" stroke={CHART_COLORS[3]} />
                  <Line type="monotone" dataKey="Sonstige" stroke={CHART_COLORS[4]} />
                </LineChart>
              </ChartCard>
              <ChartCard title="Budgetverbrauch (kumuliert)">
                <LineChart data={cumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Kumuliert" stroke={CHART_COLORS[0]} strokeWidth={2} />
                  <Line type="monotone" dataKey="Budget" stroke={CHART_COLORS[1]} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ChartCard>
              <ChartCard title="Stunden je Mitarbeiter">
                <BarChart data={(report.hours_by_person ?? []).map((r) => ({ name: r.label, Stunden: Number(r.hours ?? 0) }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={130} />
                  <Tooltip />
                  <Bar dataKey="Stunden" fill={CHART_COLORS[2]} />
                </BarChart>
              </ChartCard>
              <ChartCard title="Kosten je Arbeitspaket">
                <BarChart data={(report.costs_by_work_package ?? []).map((r) => ({ name: r.label, Kosten: Number(r.total ?? 0) }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={130} />
                  <Tooltip />
                  <Bar dataKey="Kosten" fill={CHART_COLORS[1]} />
                </BarChart>
              </ChartCard>
              <ChartCard title="Kosten nach Kostenart">
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie
                    data={(report.costs_by_category ?? []).map((r) => ({ name: r.label, value: Number(r.total ?? 0) }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {(report.costs_by_category ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartCard>
              <ChartCard title="Stunden je Forschungsschwerpunkt">
                <BarChart data={(report.hours_by_focus ?? []).map((r) => ({ name: r.label, Stunden: Number(r.hours ?? 0) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Stunden" fill={CHART_COLORS[3]} />
                </BarChart>
              </ChartCard>
            </TabsContent>

            <TabsContent value="projects" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kosten, Stunden und Budget je Projekt</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projekt-Nr.</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead className="text-right">Stunden</TableHead>
                        <TableHead className="text-right">Personal</TableHead>
                        <TableHead className="text-right">Material</TableHead>
                        <TableHead className="text-right">Fremdleistungen</TableHead>
                        <TableHead className="text-right">Reise</TableHead>
                        <TableHead className="text-right">Sonstige</TableHead>
                        <TableHead className="text-right">Gesamt</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Rest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.costs_by_project.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.code}</TableCell>
                          <TableCell>
                            {r.label}
                            {r.funded && (
                              <Badge variant="secondary" className="ml-2">Förderprojekt</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{fmtHours(r.hours)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.personnel)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.material)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.external)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.travel)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.other)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtEuro(r.total)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmtEuro(r.budget)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.budget - r.total)}</TableCell>
                        </TableRow>
                      ))}
                      {report.costs_by_project.length === 0 && <Empty cols={11} />}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="hours" className="mt-4 grid gap-4 lg:grid-cols-2">
              <GroupTable title="Stunden je Projekt" rows={report.hours_by_project} unit="h" />
              <GroupTable title="Stunden je Mitarbeiter" rows={report.hours_by_person} unit="h" />
              <GroupTable title="Stunden je Arbeitspaket" rows={report.hours_by_work_package} unit="h" />
              <GroupTable title="Stunden je Task" rows={report.hours_by_task} unit="h" />
              <GroupTable title="Stunden je Forschungsschwerpunkt" rows={report.hours_by_focus} unit="h" />
            </TabsContent>

            <TabsContent value="costs" className="mt-4 grid gap-4 lg:grid-cols-2">
              <GroupTable title="Kosten je Arbeitspaket" rows={report.costs_by_work_package} unit="€" />
              <GroupTable title="Kosten je Kostenart" rows={report.costs_by_category} unit="€" />
            </TabsContent>

            <TabsContent value="hours-journal" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Stundenjournal</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead>Person</TableHead>
                        <TableHead>Arbeitspaket</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="text-right">Stunden</TableHead>
                        <TableHead>Notiz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.hours_journal.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell><span className="font-mono">{r.project_number}</span> {r.project_name}</TableCell>
                          <TableCell>{r.person}</TableCell>
                          <TableCell>{r.work_package}</TableCell>
                          <TableCell>{r.task}</TableCell>
                          <TableCell className="text-right">{fmtHours(r.hours)}</TableCell>
                          <TableCell className="max-w-xs truncate" title={r.note ?? ""}>{r.note ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {report.hours_journal.length === 0 && <Empty cols={7} />}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cost-journal" className="mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Kostenjournal</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead>Arbeitspaket</TableHead>
                        <TableHead>Kostenstelle</TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.cost_journal.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell><span className="font-mono">{r.project_number}</span> {r.project_name}</TableCell>
                          <TableCell>{r.work_package}</TableCell>
                          <TableCell>{r.cost_center ?? "—"}</TableCell>
                          <TableCell className="max-w-xs truncate" title={r.description}>{r.description}</TableCell>
                          <TableCell className="text-right">{fmtEuro(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {report.cost_journal.length === 0 && <Empty cols={7} />}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function GroupTable({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: { id?: string; code?: string | null; label: string; hours?: number; total?: number }[];
  unit: "h" | "€";
}) {
  const sum = rows.reduce((a, r) => a + Number(r.hours ?? r.total ?? 0), 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead className="text-right">{unit === "h" ? "Stunden" : "Betrag"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id ?? i}>
                <TableCell>
                  {r.code && <span className="font-mono mr-2">{r.code}</span>}
                  {r.label}
                </TableCell>
                <TableCell className="text-right">
                  {unit === "h" ? fmtHours(r.hours ?? 0) : fmtEuro(r.total ?? 0)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <Empty cols={2} />}
            {rows.length > 0 && (
              <TableRow>
                <TableCell className="font-semibold">Summe</TableCell>
                <TableCell className="text-right font-semibold">
                  {unit === "h" ? fmtHours(sum) : fmtEuro(sum)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Empty({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-sm text-muted-foreground">
        Keine Daten im gewählten Zeitraum.
      </TableCell>
    </TableRow>
  );
}
