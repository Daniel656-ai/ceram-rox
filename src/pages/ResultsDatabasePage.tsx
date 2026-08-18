import { useState, useMemo } from "react";
import { useResultsDatabase, getUniqueParameterNames, getParameterValue, resultLabel, buildResultUnitMap, withUnit, type ResultRecord } from "@/hooks/useResultsDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Database, BarChart3, Filter, X, Search } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from "recharts";
import { buildChartSources, collectNumericParameters, buildChartPoints, isCategoryAxis, CATEGORY_AXES, niceScale, buildTicks, type AxisScale } from "@/lib/resultsChartData";
import { AxisScaleControls, type ManualScale } from "@/components/results/AxisScaleControls";
import { toast } from "sonner";


const CHART_COLORS = [
  "hsl(200, 60%, 32%)", "hsl(16, 75%, 48%)", "hsl(152, 55%, 36%)",
  "hsl(38, 85%, 50%)", "hsl(270, 50%, 50%)", "hsl(330, 60%, 45%)",
  "hsl(180, 50%, 35%)", "hsl(60, 70%, 45%)",
];

export default function ResultsDatabasePage() {
  const { data: records = [], isLoading } = useResultsDatabase();

  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [sampleFilter, setSampleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");

  // Chart state
  const [chartType, setChartType] = useState<"scatter" | "bar" | "line">("scatter");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("none");
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const [xAuto, setXAuto] = useState(true);
  const [yAuto, setYAuto] = useState(true);
  const [xManual, setXManual] = useState<ManualScale>({ min: "", max: "", step: "" });
  const [yManual, setYManual] = useState<ManualScale>({ min: "", max: "", step: "" });
  const [savedScale, setSavedScale] = useState<{ x: ManualScale; y: ManualScale } | null>(null);


  const resultUnits = useMemo(() => buildResultUnitMap(records), [records]);
  const { inputParameterNames, outputParameterNames } = useMemo(
    () => getUniqueParameterNames(records), [records]
  );


  // Unique values for filters
  const uniqueServices = useMemo(() => [...new Set(records.map(r => r.serviceName))].sort(), [records]);
  const uniqueProjects = useMemo(() => [...new Set(records.map(r => r.projectName).filter(Boolean))].sort(), [records]);
  const uniqueCreators = useMemo(() => [...new Set(records.map(r => r.createdByName).filter(Boolean))].sort(), [records]);
  const uniqueTechnicians = useMemo(() => [...new Set(records.map(r => r.assignedToName).filter(Boolean))].sort(), [records]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (serviceFilter !== "all" && r.serviceName !== serviceFilter) return false;
      if (projectFilter !== "all" && r.projectName !== projectFilter) return false;
      if (creatorFilter !== "all" && r.createdByName !== creatorFilter) return false;
      if (technicianFilter !== "all" && r.assignedToName !== technicianFilter) return false;
      if (sampleFilter && !r.sampleNumber.toLowerCase().includes(sampleFilter.toLowerCase()) && !r.sampleName.toLowerCase().includes(sampleFilter.toLowerCase())) return false;
      if (dateFrom && r.completedAt && isBefore(parseISO(r.completedAt), parseISO(dateFrom))) return false;
      if (dateTo && r.completedAt && isAfter(parseISO(r.completedAt), parseISO(dateTo + "T23:59:59"))) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        const matches = [r.measurementNumber, r.orderNumber, r.projectNumber, r.projectName, r.sampleNumber, r.sampleName, r.serviceName, r.assignedToName, r.createdByName, r.remarks]
          .some(v => v?.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });
  }, [records, serviceFilter, projectFilter, creatorFilter, technicianFilter, sampleFilter, dateFrom, dateTo, searchText]);

  const clearFilters = () => {
    setServiceFilter("all");
    setProjectFilter("all");
    setCreatorFilter("all");
    setTechnicianFilter("all");
    setSampleFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchText("");
  };

  const hasActiveFilters = serviceFilter !== "all" || projectFilter !== "all" || creatorFilter !== "all" || technicianFilter !== "all" || sampleFilter || dateFrom || dateTo || searchText;

  // Export functions
  const exportToExcel = () => {
    const rows = filteredRecords.map(r => {
      const row: Record<string, any> = {
        "Messnummer": r.measurementNumber,
        "Auftragsnummer": r.orderNumber,
        "Projekt": r.projectName || r.projectNumber,
        "Probe": r.sampleNumber || r.sampleName,
        "Messart": r.serviceName,
        "Auftraggeber": r.createdByName,
        "Messdienstleister": r.assignedToName,
        "Abgeschlossen": r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "",
        "Ist-Dauer (h)": r.actualDurationHours ?? r.standardDurationHours,
      };
      // Add input params
      inputParameterNames.forEach(name => {
        const p = r.inputParameters[name];
        row[`[E] ${name}`] = p?.value ?? "";
      });
      // Add output results
      outputParameterNames.forEach(name => {
        const res = r.outputResults.find(o => resultLabel(o) === name);
        row[`[A] ${withUnit(name, resultUnits)}`] = res?.value ?? "";
      });
      row["Bemerkungen"] = r.remarks;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ergebnisse");
    XLSX.writeFile(wb, `Ergebnisdatenbank_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportToCSV = () => {
    const rows = filteredRecords.map(r => {
      const row: Record<string, any> = {
        "Messnummer": r.measurementNumber,
        "Auftragsnummer": r.orderNumber,
        "Projekt": r.projectName || r.projectNumber,
        "Probe": r.sampleNumber || r.sampleName,
        "Messart": r.serviceName,
        "Auftraggeber": r.createdByName,
        "Messdienstleister": r.assignedToName,
        "Abgeschlossen": r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "",
      };
      inputParameterNames.forEach(name => {
        row[name] = r.inputParameters[name]?.value ?? "";
      });
      outputParameterNames.forEach(name => {
        const res = r.outputResults.find(o => resultLabel(o) === name);
        row[withUnit(name, resultUnits)] = res?.value ?? "";
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ergebnisdatenbank_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart data – identische Datenbasis wie die Ergebnisdatenbank (nur offizielle Ergebnisse)
  const chartSources = useMemo(() => buildChartSources(filteredRecords), [filteredRecords]);
  const numericParams = useMemo(() => collectNumericParameters(filteredRecords), [filteredRecords]);
  const numericKeys = useMemo(() => new Set(numericParams.map(p => p.key)), [numericParams]);

  const chartData = useMemo(
    () => buildChartPoints(chartSources, xAxis, yAxis, groupBy),
    [chartSources, xAxis, yAxis, groupBy]
  );

  const missingAxes = [xAxis, yAxis].filter(
    (a) => a && !isCategoryAxis(a) && !numericKeys.has(a)
  );

  const axisLabel = (key: string) =>
    CATEGORY_AXES.find(c => c.key === key)?.label
      ?? numericParams.find(p => p.key === key)?.label
      ?? key;

  const handleChartType = (v: "scatter" | "bar" | "line") => {
    setChartType(v);
    // Scatter benötigt eine numerische X-Achse
    if (v === "scatter" && isCategoryAxis(xAxis)) setXAxis("");
  };


  // Alle Serien (Legende) – unabhängig von der Sichtbarkeit
  const allGroups = useMemo(() => {
    if (groupBy === "none") return ["Alle"];
    return Array.from(new Set(chartData.map(d => d.group))).sort((a, b) => a.localeCompare(b, "de"));
  }, [chartData, groupBy]);

  const groupColor = (name: string) =>
    CHART_COLORS[Math.max(0, allGroups.indexOf(name)) % CHART_COLORS.length];

  const visibleData = useMemo(
    () => chartData.filter(d => !hiddenGroups.includes(d.group)),
    [chartData, hiddenGroups]
  );

  const chartGroups = useMemo(
    () => allGroups
      .filter(name => !hiddenGroups.includes(name))
      .map(name => ({ name, data: visibleData.filter(d => d.group === name) })),
    [allGroups, hiddenGroups, visibleData]
  );

  const toggleGroup = (name: string) =>
    setHiddenGroups(prev => prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]);

  // Balken/Linien: Serien nebeneinander über gemeinsame X-Kategorien
  const pivotData = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    const sums = new Map<string, { sum: number; n: number }>();
    visibleData.forEach(d => {
      const key = String(d.x);
      if (!rows.has(key)) rows.set(key, { x: d.x });
      const sk = `${key}||${d.group}`;
      const agg = sums.get(sk) ?? { sum: 0, n: 0 };
      agg.sum += d.y;
      agg.n += 1;
      sums.set(sk, agg);
      rows.get(key)![d.group] = agg.sum / agg.n;
    });
    return Array.from(rows.values()).sort((a, b) =>
      typeof a.x === "number" && typeof b.x === "number"
        ? a.x - b.x
        : String(a.x).localeCompare(String(b.x), "de")
    );
  }, [visibleData]);

  // Achsenskalierung
  const xNumeric = !!xAxis && !isCategoryAxis(xAxis);
  const xAutoScale = useMemo<AxisScale | null>(() => {
    if (!xNumeric || visibleData.length === 0) return null;
    const vals = visibleData.map(d => Number(d.x)).filter(Number.isFinite);
    return vals.length ? niceScale(Math.min(...vals), Math.max(...vals)) : null;
  }, [visibleData, xNumeric]);

  const yAutoScale = useMemo<AxisScale | null>(() => {
    if (visibleData.length === 0) return null;
    const vals = visibleData.map(d => d.y).filter(Number.isFinite);
    return vals.length ? niceScale(Math.min(...vals), Math.max(...vals)) : null;
  }, [visibleData]);

  const resolveScale = (auto: boolean, manual: ManualScale, autoScale: AxisScale | null): AxisScale | null => {
    if (auto || !autoScale) return autoScale;
    const num = (s: string, fb: number) => {
      const v = Number(String(s).replace(",", "."));
      return s.trim() !== "" && Number.isFinite(v) ? v : fb;
    };
    const min = num(manual.min, autoScale.min);
    const max = num(manual.max, autoScale.max);
    const step = num(manual.step, autoScale.step);
    if (max <= min) return autoScale;
    return { min, max, step: step > 0 ? step : autoScale.step };
  };

  const xScale = resolveScale(xAuto, xManual, xAutoScale);
  const yScale = resolveScale(yAuto, yManual, yAutoScale);
  const xTicks = xScale && !xAuto ? buildTicks(xScale) : [];
  const yTicks = yScale && !yAuto ? buildTicks(yScale) : [];
  const xDomain: [number, number] | undefined = xScale ? [xScale.min, xScale.max] : undefined;
  const yDomain: [number, number] | undefined = yScale ? [yScale.min, yScale.max] : undefined;

  const saveScalePreset = () => {
    const toManual = (s: AxisScale | null): ManualScale =>
      s ? { min: String(s.min), max: String(s.max), step: String(s.step) } : { min: "", max: "", step: "" };
    setSavedScale({ x: toManual(xScale), y: toManual(yScale) });
    toast.success("Skalierung gemerkt – für Vergleiche übernehmbar");
  };

  const applyScalePreset = () => {
    if (!savedScale) return;
    setXManual(savedScale.x);
    setYManual(savedScale.y);
    if (xNumeric) setXAuto(false);
    setYAuto(false);
    toast.success("Gemerkte Skalierung übernommen");
  };

  const CHART_MARGIN = { top: 16, right: 24, bottom: 44, left: 56 };
  const xAxisLabelProps = (key: string) => ({
    value: axisLabel(key),
    position: "insideBottom" as const,
    offset: -12,
    style: { textAnchor: "middle" as const, fontSize: 12 },
  });
  const yAxisLabelProps = (key: string) => ({
    value: axisLabel(key),
    angle: -90 as const,
    position: "insideLeft" as const,
    offset: -8,
    style: { textAnchor: "middle" as const, fontSize: 12 },
  });

  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 text-xs shadow-md space-y-0.5">
        {d.label && <p className="font-medium">{d.label}</p>}
        <p>{axisLabel(xAxis)}: {typeof d.x === "number" ? d.x.toLocaleString("de-DE") : d.x}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey ?? p.name}>
            {axisLabel(yAxis)}{groupBy !== "none" && p.name ? ` · ${p.name}` : ""}:{" "}
            {typeof p.value === "number" ? p.value.toLocaleString("de-DE") : p.value}
          </p>
        ))}
      </div>
    );
  };




  const resultColumns = useMemo<DataTableColumn<ResultRecord>[]>(() => {
    const base: DataTableColumn<ResultRecord>[] = [
      { key: "measurementNumber", header: "Messnr.", accessor: r => r.measurementNumber, cell: r => <span className="font-mono text-xs">{r.measurementNumber}</span> },
      { key: "orderNumber", header: "Auftragsnr.", accessor: r => r.orderNumber, cell: r => <span className="font-mono text-xs">{r.orderNumber}</span> },
      { key: "serviceName", type: "status", header: "Messart", accessor: r => r.serviceName, cell: r => <Badge variant="secondary" className="text-xs">{r.serviceName}</Badge> },
      { key: "projectName", header: "Projekt", accessor: r => r.projectName || r.projectNumber },
      { key: "sampleName", header: "Probe", accessor: r => r.sampleNumber || r.sampleName,
        cell: r => (
          <div className="leading-tight">
            <span className="font-mono text-xs">{r.sampleNumber || "–"}</span>
            {r.sampleName ? <div className="text-xs text-muted-foreground">{r.sampleName}</div> : null}
            {r.originalSampleNumber ? (
              <div className="text-[11px] text-muted-foreground">Ersatzprobe für {r.originalSampleNumber}</div>
            ) : null}
          </div>
        ) },
      { key: "createdByName", type: "status", header: "Auftraggeber", accessor: r => r.createdByName },
      { key: "assignedToName", type: "status", header: "MDL", accessor: r => r.assignedToName },
      { key: "completedAt", type: "date", header: "Abgeschlossen", accessor: r => r.completedAt ?? null,
        cell: r => r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yy", { locale: de }) : "-" },
      { key: "duration", type: "number", header: "Dauer (h)", accessor: r => r.actualDurationHours ?? r.standardDurationHours ?? null,
        cell: r => <span className="font-mono text-sm">{r.actualDurationHours ?? r.standardDurationHours ?? "-"}</span> },
    ];
    outputParameterNames.slice(0, 5).forEach(name => {
      base.push({
        key: `out_${name}`,
        type: "number",
        header: withUnit(name, resultUnits),
        accessor: r => {
          const res = r.outputResults.find(o => resultLabel(o) === name);
          const v = res?.value;
          return v == null ? null : v;
        },
        cell: r => {
          const res = r.outputResults.find(o => resultLabel(o) === name);
          return <span className="font-mono text-sm">{res?.value != null ? String(res.value) : "-"}</span>;
        },
      });
    });
    return base;
  }, [outputParameterNames, resultUnits]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Ergebnisdatenbank
          </h1>
          <p className="text-muted-foreground">
            {filteredRecords.length} von {records.length} Messungen mit offiziellem Ergebnis
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Die Ergebnisdatenbank zeigt ausschließlich Ergebnisse an, die ausdrücklich als
            offizielles Ergebnis freigegeben wurden. Erledigte Tätigkeiten und nicht-offizielle
            Messwerte bleiben in den Auftrags- und Arbeitsansichten sichtbar.
          </p>

        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filteredRecords.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredRecords.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Zurücksetzen
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Volltextsuche..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger><SelectValue placeholder="Messart" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Messarten</SelectItem>
                {uniqueServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue placeholder="Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Projekte</SelectItem>
                {uniqueProjects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger><SelectValue placeholder="Auftraggeber" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Auftraggeber</SelectItem>
                {uniqueCreators.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger><SelectValue placeholder="Messdienstleister" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Messdienstleister</SelectItem>
                {uniqueTechnicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Proben-ID..." value={sampleFilter} onChange={e => setSampleFilter(e.target.value)} />
            <Input type="date" placeholder="Von" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" placeholder="Bis" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="statistics">Statistik & Diagramme</TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table">
          <Card>
            <CardContent className="p-4">
              <DataTable
                tableId="results-database"
                columns={resultColumns}
                rows={filteredRecords}
                rowKey={(r) => r.measurementId}
                searchPlaceholder="Tabelle durchsuchen …"
                emptyMessage="Keine abgeschlossenen Aufgaben gefunden"
                defaultSort={{ key: "completedAt", dir: "desc" }}
              />
            </CardContent>
          </Card>
        </TabsContent>


        {/* Statistics View */}
        <TabsContent value="statistics">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Diagramm-Konfiguration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Diagrammtyp</label>
                    <Select value={chartType} onValueChange={v => handleChartType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scatter">Scatter Plot</SelectItem>
                        <SelectItem value="bar">Balkendiagramm</SelectItem>
                        <SelectItem value="line">Liniendiagramm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">X-Achse</label>
                    <Select value={xAxis} onValueChange={setXAxis}>
                      <SelectTrigger><SelectValue placeholder="Parameter wählen" /></SelectTrigger>
                      <SelectContent>
                        {chartType !== "scatter" && CATEGORY_AXES.map(c => (
                          <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                        ))}
                        {numericParams.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Y-Achse</label>
                    <Select value={yAxis} onValueChange={setYAxis}>
                      <SelectTrigger><SelectValue placeholder="Parameter wählen" /></SelectTrigger>
                      <SelectContent>
                        {numericParams.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Gruppierung</label>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        <SelectItem value="project">Projekt</SelectItem>
                        <SelectItem value="service">Messart</SelectItem>
                        <SelectItem value="creator">Auftraggeber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Skalierung */}
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <AxisScaleControls
                    title={`Skalierung X-Achse${xAxis ? ` – ${axisLabel(xAxis)}` : ""}`}
                    auto={xAuto}
                    onAutoChange={setXAuto}
                    manual={xManual}
                    onManualChange={setXManual}
                    autoScale={xAutoScale}
                    disabled={!xNumeric}
                    disabledHint="Kategorie-Achse – Skalierung nicht anwendbar"
                  />
                  <AxisScaleControls
                    title={`Skalierung Y-Achse${yAxis ? ` – ${axisLabel(yAxis)}` : ""}`}
                    auto={yAuto}
                    onAutoChange={setYAuto}
                    manual={yManual}
                    onManualChange={setYManual}
                    autoScale={yAutoScale}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={saveScalePreset} disabled={!yScale}>
                    Skalierung merken
                  </Button>
                  <Button variant="outline" size="sm" onClick={applyScalePreset} disabled={!savedScale}>
                    Gemerkte Skalierung übernehmen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setXAuto(true); setYAuto(true); }}
                  >
                    Auto-Skalierung
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {!xAxis || !yAxis ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    Bitte X- und Y-Achse wählen
                  </div>
                ) : missingAxes.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground text-sm gap-1">
                    <p>Die Datenquelle „{missingAxes.join("“, „")}“ ist nicht mehr als offizielles numerisches Ergebnis verfügbar.</p>
                    <p>Bitte eine andere Achse wählen.</p>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                    Keine offiziellen numerischen Ergebnisse für die gewählte Kombination (Zusammenführung über die Probe).
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ResponsiveContainer width="100%" height={420}>
                      {chartType === "scatter" ? (
                        <ScatterChart margin={CHART_MARGIN}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number" dataKey="x" name={xAxis} fontSize={12}
                            domain={xDomain} ticks={xTicks.length ? xTicks : undefined} allowDataOverflow={!xAuto}
                            label={xAxisLabelProps(xAxis)}
                          />
                          <YAxis
                            type="number" dataKey="y" name={yAxis} fontSize={12}
                            domain={yDomain} ticks={yTicks.length ? yTicks : undefined} allowDataOverflow={!yAuto}
                            label={yAxisLabelProps(yAxis)}
                          />
                          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip />} />
                          {chartGroups.map(g => (
                            <Scatter key={g.name} name={g.name} data={g.data} fill={groupColor(g.name)} />
                          ))}
                        </ScatterChart>
                      ) : chartType === "bar" ? (
                        <BarChart data={pivotData} margin={CHART_MARGIN}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="x" fontSize={12}
                            type={xNumeric ? "number" : "category"}
                            domain={xNumeric ? xDomain : undefined}
                            ticks={xNumeric && xTicks.length ? xTicks : undefined}
                            label={xAxisLabelProps(xAxis)}
                          />
                          <YAxis
                            fontSize={12} domain={yDomain}
                            ticks={yTicks.length ? yTicks : undefined} allowDataOverflow={!yAuto}
                            label={yAxisLabelProps(yAxis)}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          {chartGroups.map(g => (
                            <Bar key={g.name} dataKey={g.name} name={g.name} fill={groupColor(g.name)} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      ) : (
                        <LineChart data={pivotData} margin={CHART_MARGIN}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="x" fontSize={12}
                            type={xNumeric ? "number" : "category"}
                            domain={xNumeric ? xDomain : undefined}
                            ticks={xNumeric && xTicks.length ? xTicks : undefined}
                            label={xAxisLabelProps(xAxis)}
                          />
                          <YAxis
                            fontSize={12} domain={yDomain}
                            ticks={yTicks.length ? yTicks : undefined} allowDataOverflow={!yAuto}
                            label={yAxisLabelProps(yAxis)}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          {chartGroups.map(g => (
                            <Line
                              key={g.name} type="monotone" dataKey={g.name} name={g.name}
                              stroke={groupColor(g.name)} strokeWidth={2} dot={{ r: 3 }} connectNulls
                            />
                          ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>

                    {/* Externe, klickbare Legende – verdeckt keine Datenpunkte */}
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      {allGroups.map(name => {
                        const hidden = hiddenGroups.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleGroup(name)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${hidden ? "opacity-40" : "hover:bg-muted"}`}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: groupColor(name) }}
                            />
                            <span className={hidden ? "line-through" : ""}>{name}</span>
                          </button>
                        );
                      })}
                      {hiddenGroups.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setHiddenGroups([])}>
                          Alle anzeigen
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary stats */}
            {xAxis && yAxis && visibleData.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Datenpunkte", value: `${visibleData.length}${visibleData.length !== chartData.length ? ` von ${chartData.length}` : ""}` },
                  { label: `Ø ${axisLabel(yAxis)}`, value: (visibleData.reduce((s, d) => s + d.y, 0) / visibleData.length).toFixed(2) },
                  { label: `Min ${axisLabel(yAxis)}`, value: Math.min(...visibleData.map(d => d.y)).toFixed(2) },
                  { label: `Max ${axisLabel(yAxis)}`, value: Math.max(...visibleData.map(d => d.y)).toFixed(2) },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-bold font-mono">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
