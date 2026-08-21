import { useState, useMemo, useRef, useEffect } from "react";
import { useResultsDatabase, getUniqueParameterNames, getParameterValue, resultLabel, expandByMeasurementInstance, type ResultRecord } from "@/hooks/useResultsDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Database, BarChart3, Filter, X, Search, Image, FileCode2, Lightbulb, Save, Trash2 } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, ReferenceLine, LabelList, Cell } from "recharts";
import { buildChartSources, collectNumericParameters, buildChartPoints, isCategoryAxis, CATEGORY_AXES, niceScale, buildTicks, type AxisScale } from "@/lib/resultsChartData";
import { AxisScaleControls, type ManualScale } from "@/components/results/AxisScaleControls";
import { computeStats, isOutlier, linearRegression, formatNumber, buildInsights } from "@/lib/resultsStatistics";
import { exportChartAsPng, exportChartAsSvg } from "@/lib/chartExport";
import { loadSavedAnalyses, persistSavedAnalyses, type SavedAnalysis } from "@/lib/resultsAnalysisStorage";
import { useAllServiceParameterDefs } from "@/hooks/useServiceParameters";
import { buildServiceSchemas, flattenSchemas, exportCell, columnHeader } from "@/lib/resultSchema";
import ResultsMatrixTable from "@/components/results/ResultsMatrixTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";



const CHART_COLORS = [
  "hsl(200, 60%, 32%)", "hsl(16, 75%, 48%)", "hsl(152, 55%, 36%)",
  "hsl(38, 85%, 50%)", "hsl(270, 50%, 50%)", "hsl(330, 60%, 45%)",
  "hsl(180, 50%, 35%)", "hsl(60, 70%, 45%)",
];

export default function ResultsDatabasePage() {
  const { data: records = [], isLoading } = useResultsDatabase();
  const { data: paramDefs = [] } = useAllServiceParameterDefs();

  /**
   * Stabile Ergebnisstruktur: aus den definierten Ergebnisparametern je
   * Dienstleistung plus allen tatsächlich vorhandenen Ergebnissen der
   * gesamten Datenbasis (bewusst ungefiltert). Filter verändern daher nie
   * die Spaltenstruktur – fehlende Werte bleiben leere Zellen.
   */
  const serviceSchemas = useMemo(
    () => buildServiceSchemas(records, paramDefs as any),
    [records, paramDefs]
  );
  const allParamColumns = useMemo(() => flattenSchemas(serviceSchemas), [serviceSchemas]);
  const [hiddenParams, setHiddenParams] = useState<string[]>([]);
  const visibleParamColumns = useMemo(
    () => allParamColumns.filter((c) => !hiddenParams.includes(c.key)),
    [allParamColumns, hiddenParams]
  );
  const toggleParam = (key: string) =>
    setHiddenParams((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

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

  // Darstellung & Analyse (Priorität 2/3)
  const [showTrend, setShowTrend] = useState(false);
  const [showMeanLines, setShowMeanLines] = useState(false);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [markOutliers, setMarkOutliers] = useState(false);
  const [refLineY, setRefLineY] = useState("");
  const [refLineX, setRefLineX] = useState("");
  const [analysisName, setAnalysisName] = useState("");
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSavedAnalyses(loadSavedAnalyses()), []);



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

  // ==========================================================
  // Export – die Spaltenstruktur ist immer identisch (stabile
  // Ergebnisdefinition), unabhängig von Filtern, Datensatzanzahl oder
  // gerade sichtbaren Spalten. Fehlende Werte bleiben leer, 0 bleibt 0.
  // ==========================================================
  const buildExportRows = (source: ResultRecord[]) =>
    // Mehrere eigenständige Messungen einer Tätigkeit werden als eigene
    // Zeilen exportiert – die Spaltenstruktur bleibt identisch.
    expandByMeasurementInstance(source).map((r) => {
      const row: Record<string, any> = {
        "Auftrag": r.orderNumber,
        "Probe": r.sampleNumber || r.sampleName,
        "Probenbezeichnung": r.sampleName,
        "Dienstleistung": r.serviceName,
        "Analyse": r.measurementNumber,
        "Messung": r.instanceLabel ?? "",
        "Messkontext": r.instanceContext ? Object.values(r.instanceContext).filter(Boolean).join(" · ") : "",
        "Datum": r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "",
        "Projekt": r.projectName || r.projectNumber,
        "Auftraggeber": r.createdByName,
        "Messdienstleister": r.assignedToName,
      };
      allParamColumns.forEach((col) => {
        row[columnHeader(col)] = exportCell(r, col.key);
      });
      return row;
    });

  const downloadWorkbook = (source: ResultRecord[], kind: "xlsx" | "csv", suffix: string) => {
    const rows = buildExportRows(source);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const stamp = format(new Date(), "yyyy-MM-dd");
    if (kind === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ergebnisse");
      XLSX.writeFile(wb, `Ergebnisdatenbank_${suffix}_${stamp}.xlsx`);
      return;
    }
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ergebnisdatenbank_${suffix}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => downloadWorkbook(filteredRecords, "csv", "gefiltert");
  const exportToExcel = () => downloadWorkbook(filteredRecords, "xlsx", "gefiltert");
  const exportAllToExcel = () => downloadWorkbook(records, "xlsx", "alle");

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

  // ---------- Statistik (Priorität 2) ----------
  const yStats = useMemo(() => computeStats(visibleData.map(d => d.y)), [visibleData]);
  const xStats = useMemo(
    () => (xNumeric ? computeStats(visibleData.map(d => Number(d.x))) : null),
    [visibleData, xNumeric]
  );
  const regression = useMemo(
    () => (xNumeric ? linearRegression(visibleData.map(d => ({ x: Number(d.x), y: d.y }))) : null),
    [visibleData, xNumeric]
  );
  const outlierLabels = useMemo(() => {
    if (!yStats) return [] as string[];
    return visibleData.filter(d => isOutlier(d.y, yStats)).map(d => d.label || "–");
  }, [visibleData, yStats]);
  const pointIsOutlier = (y: number) => !!(markOutliers && yStats && isOutlier(y, yStats));

  const insights = useMemo(
    () =>
      yStats
        ? buildInsights({
            yLabel: axisLabel(yAxis),
            xLabel: axisLabel(xAxis),
            stats: yStats,
            regression,
            outlierLabels,
            totalPoints: chartData.length,
            visiblePoints: visibleData.length,
          })
        : [],
    [yStats, regression, outlierLabels, chartData.length, visibleData.length, xAxis, yAxis]
  );

  const numericRef = (s: string) => {
    const v = Number(String(s).replace(",", "."));
    return s.trim() !== "" && Number.isFinite(v) ? v : null;
  };
  const refY = numericRef(refLineY);
  const refX = xNumeric ? numericRef(refLineX) : null;

  /** Trendgerade als Segment über den sichtbaren X-Bereich. */
  const trendSegment = useMemo(() => {
    if (!showTrend || !regression || !xStats) return null;
    const x1 = xScale?.min ?? xStats.min;
    const x2 = xScale?.max ?? xStats.max;
    return [
      { x: x1, y: regression.intercept + regression.slope * x1 },
      { x: x2, y: regression.intercept + regression.slope * x2 },
    ];
  }, [showTrend, regression, xStats, xScale]);

  // ---------- Export & gespeicherte Analysen (Priorität 3) ----------
  const exportBaseName = `Diagramm_${axisLabel(yAxis) || "Ergebnis"}_${format(new Date(), "yyyy-MM-dd")}`.replace(/[^\w\-]+/g, "_");

  const handleExportPng = async () => {
    try {
      await exportChartAsPng(chartRef.current, exportBaseName);
      toast.success("Diagramm als PNG exportiert");
    } catch (e: any) {
      toast.error(e?.message ?? "Export fehlgeschlagen");
    }
  };
  const handleExportSvg = () => {
    try {
      exportChartAsSvg(chartRef.current, exportBaseName);
      toast.success("Diagramm als SVG exportiert");
    } catch (e: any) {
      toast.error(e?.message ?? "Export fehlgeschlagen");
    }
  };

  const saveAnalysis = () => {
    const name = analysisName.trim();
    if (!name) {
      toast.error("Bitte einen Namen für die Analyse vergeben");
      return;
    }
    const entry: SavedAnalysis = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      chartType, xAxis, yAxis, groupBy,
      xAuto, yAuto, xManual, yManual,
      showTrend, showMeanLines, showDataLabels, markOutliers,
      refLineY, refLineX,
    };
    const next = [entry, ...savedAnalyses.filter(a => a.name !== name)];
    setSavedAnalyses(next);
    persistSavedAnalyses(next);
    setAnalysisName("");
    toast.success(`Analyse „${name}" gespeichert`);
  };

  const applyAnalysis = (a: SavedAnalysis) => {
    setChartType(a.chartType);
    setXAxis(a.xAxis);
    setYAxis(a.yAxis);
    setGroupBy(a.groupBy);
    setXAuto(a.xAuto);
    setYAuto(a.yAuto);
    setXManual(a.xManual);
    setYManual(a.yManual);
    setShowTrend(a.showTrend);
    setShowMeanLines(a.showMeanLines);
    setShowDataLabels(a.showDataLabels);
    setMarkOutliers(a.markOutliers);
    setRefLineY(a.refLineY);
    setRefLineX(a.refLineX);
    setHiddenGroups([]);
    toast.success(`Analyse „${a.name}" geladen`);
  };

  const deleteAnalysis = (id: string) => {
    const next = savedAnalyses.filter(a => a.id !== id);
    setSavedAnalyses(next);
    persistSavedAnalyses(next);
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
    const meta = d?.meta;
    return (
      <div className="rounded-lg border bg-background p-2.5 text-xs shadow-md space-y-1 max-w-[280px]">
        {d.label && <p className="font-medium">{d.label}</p>}
        <p>{axisLabel(xAxis)}: {typeof d.x === "number" ? d.x.toLocaleString("de-DE") : d.x}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey ?? p.name}>
            {axisLabel(yAxis)}{groupBy !== "none" && p.name ? ` · ${p.name}` : ""}:{" "}
            {typeof p.value === "number" ? p.value.toLocaleString("de-DE") : p.value}
            {markOutliers && typeof p.value === "number" && yStats && isOutlier(p.value, yStats) ? " · Ausreißer" : ""}
          </p>
        ))}
        {meta && (
          <div className="border-t pt-1 space-y-0.5 text-muted-foreground">
            {meta.sampleName && <p>Probe: {meta.sampleNumber} · {meta.sampleName}</p>}
            {meta.orderNumber && <p>Auftrag: {meta.orderNumber}</p>}
            {meta.serviceNames && <p>Messart: {meta.serviceNames}</p>}
            {meta.projectName && <p>Projekt: {meta.projectName}</p>}
            {meta.createdByName && <p>Auftraggeber: {meta.createdByName}</p>}
            {meta.completedAt && <p>Datum: {format(parseISO(meta.completedAt), "dd.MM.yyyy", { locale: de })}</p>}
          </div>
        )}
      </div>
    );
  };







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
          <Button variant="outline" size="sm" onClick={exportAllToExcel} disabled={records.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Alle Ergebnisse
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
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Ergebnismatrix
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Eine Analyse = eine Zeile, ein Ergebnisparameter = eine Spalte
                  </span>
                </CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Angezeigte Parameter ({visibleParamColumns.length}/{allParamColumns.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">Parameter anzeigen</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setHiddenParams([])}>
                        Alle
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {allParamColumns.map((col) => (
                        <label key={col.key} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={!hiddenParams.includes(col.key)}
                            onCheckedChange={() => toggleParam(col.key)}
                          />
                          {columnHeader(col)}
                        </label>
                      ))}
                      {allParamColumns.length === 0 && (
                        <p className="text-xs text-muted-foreground">Keine Ergebnisparameter vorhanden.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground">
                Die Spaltenstruktur bleibt unabhängig von Filtern stabil. Fehlende Ergebnisse bleiben
                leer – ein tatsächlich gemessener Wert 0 wird als 0 angezeigt.
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ResultsMatrixTable records={filteredRecords} columns={visibleParamColumns} />
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

                {/* Darstellung, Referenzlinien & Analyse */}
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium">Darstellung</p>
                    {([
                      { key: "labels", label: "Datenlabels anzeigen", checked: showDataLabels, set: setShowDataLabels, disabled: false },
                      { key: "mean", label: "Mittelwert & ±1 SD einzeichnen", checked: showMeanLines, set: setShowMeanLines, disabled: false },
                      { key: "outlier", label: "Ausreißer markieren (1,5 × IQR)", checked: markOutliers, set: setMarkOutliers, disabled: false },
                      { key: "trend", label: "Trendlinie (lineare Regression)", checked: showTrend, set: setShowTrend, disabled: !xNumeric },
                    ] as const).map(o => (
                      <div key={o.key} className="flex items-center justify-between gap-2">
                        <Label className={`text-xs ${o.disabled ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                          {o.label}{o.disabled ? " – nur bei numerischer X-Achse" : ""}
                        </Label>
                        <Switch checked={o.checked && !o.disabled} disabled={o.disabled} onCheckedChange={o.set} />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium">Referenzlinien (Grenzwerte)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Y-Referenz</Label>
                        <Input className="h-8" inputMode="decimal" placeholder="z. B. 25" value={refLineY} onChange={e => setRefLineY(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">X-Referenz</Label>
                        <Input className="h-8" inputMode="decimal" placeholder={xNumeric ? "z. B. 1,8" : "nur numerisch"} disabled={!xNumeric} value={refLineX} onChange={e => setRefLineX(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Referenzlinien dienen dem Soll-Ist-Vergleich und verändern keine Daten.
                    </p>
                  </div>
                </div>

                {/* Gespeicherte Analysen */}
                <div className="mt-4 rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium">Gespeicherte Analysen</p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="h-8 w-56"
                      placeholder="Name der Analyse …"
                      value={analysisName}
                      onChange={e => setAnalysisName(e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={saveAnalysis} disabled={!xAxis || !yAxis}>
                      <Save className="h-4 w-4 mr-1" /> Speichern
                    </Button>
                  </div>
                  {savedAnalyses.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Noch keine Analyse gespeichert. Gespeichert werden ausschließlich Ansichtseinstellungen.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {savedAnalyses.map(a => (
                        <div key={a.id} className="flex items-center gap-1 rounded-full border pl-3 pr-1 py-0.5 text-xs">
                          <button type="button" className="hover:underline" onClick={() => applyAnalysis(a)}>
                            {a.name}
                          </button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteAnalysis(a.id)} aria-label={`Analyse ${a.name} löschen`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {visibleData.length} von {chartData.length} Datenpunkten sichtbar
                        {markOutliers && outlierLabels.length > 0 ? ` · ${outlierLabels.length} Ausreißer markiert` : ""}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportPng}>
                          <Image className="h-4 w-4 mr-1" /> PNG
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportSvg}>
                          <FileCode2 className="h-4 w-4 mr-1" /> SVG
                        </Button>
                      </div>
                    </div>
                    <div ref={chartRef}>
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
                          {showMeanLines && yStats && (
                            <ReferenceLine y={yStats.mean} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4"
                              label={{ value: `Ø ${formatNumber(yStats.mean)}`, position: "right", fontSize: 10 }} />
                          )}
                          {showMeanLines && yStats && yStats.sd > 0 && [yStats.mean - yStats.sd, yStats.mean + yStats.sd].map((v, i) => (
                            <ReferenceLine key={i} y={v} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.6} />
                          ))}
                          {refY != null && (
                            <ReferenceLine y={refY} stroke="hsl(16, 75%, 48%)" strokeWidth={1.5}
                              label={{ value: `Grenzwert ${formatNumber(refY)}`, position: "insideTopRight", fontSize: 10 }} />
                          )}
                          {refX != null && (
                            <ReferenceLine x={refX} stroke="hsl(16, 75%, 48%)" strokeWidth={1.5} strokeDasharray="4 4" />
                          )}
                          {trendSegment && (
                            <ReferenceLine
                              segment={trendSegment as any}
                              stroke="hsl(200, 60%, 32%)"
                              strokeWidth={2}
                              strokeDasharray="5 3"
                              ifOverflow="extendDomain"
                            />
                          )}
                          {chartGroups.map(g => (
                            <Scatter key={g.name} name={g.name} data={g.data} fill={groupColor(g.name)}>
                              {g.data.map((p, i) => (
                                <Cell key={i} fill={pointIsOutlier(p.y) ? "hsl(0, 72%, 50%)" : groupColor(g.name)} />
                              ))}
                              {showDataLabels && (
                                <LabelList dataKey="y" position="top" fontSize={10} formatter={(v: any) => formatNumber(Number(v))} />
                              )}
                            </Scatter>
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
                          {showMeanLines && yStats && (
                            <ReferenceLine y={yStats.mean} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4"
                              label={{ value: `Ø ${formatNumber(yStats.mean)}`, position: "right", fontSize: 10 }} />
                          )}
                          {refY != null && (
                            <ReferenceLine y={refY} stroke="hsl(16, 75%, 48%)" strokeWidth={1.5}
                              label={{ value: `Grenzwert ${formatNumber(refY)}`, position: "insideTopRight", fontSize: 10 }} />
                          )}
                          {chartGroups.map(g => (
                            <Bar key={g.name} dataKey={g.name} name={g.name} fill={groupColor(g.name)} radius={[4, 4, 0, 0]}>
                              {showDataLabels && (
                                <LabelList dataKey={g.name} position="top" fontSize={10} formatter={(v: any) => formatNumber(Number(v))} />
                              )}
                            </Bar>
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
                          {showMeanLines && yStats && (
                            <ReferenceLine y={yStats.mean} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4"
                              label={{ value: `Ø ${formatNumber(yStats.mean)}`, position: "right", fontSize: 10 }} />
                          )}
                          {refY != null && (
                            <ReferenceLine y={refY} stroke="hsl(16, 75%, 48%)" strokeWidth={1.5}
                              label={{ value: `Grenzwert ${formatNumber(refY)}`, position: "insideTopRight", fontSize: 10 }} />
                          )}
                          {chartGroups.map(g => (
                            <Line
                              key={g.name} type="monotone" dataKey={g.name} name={g.name}
                              stroke={groupColor(g.name)} strokeWidth={2} dot={{ r: 3 }} connectNulls
                            >
                              {showDataLabels && (
                                <LabelList dataKey={g.name} position="top" fontSize={10} formatter={(v: any) => formatNumber(Number(v))} />
                              )}
                            </Line>
                          ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                    </div>


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

            {/* Erweiterte Statistik */}
            {xAxis && yAxis && yStats && (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Datenpunkte", value: `${visibleData.length}${visibleData.length !== chartData.length ? ` / ${chartData.length}` : ""}` },
                  { label: `Ø ${axisLabel(yAxis)}`, value: formatNumber(yStats.mean) },
                  { label: "Median", value: formatNumber(yStats.median) },
                  { label: "Standardabw.", value: formatNumber(yStats.sd) },
                  { label: "Q1 / Q3", value: `${formatNumber(yStats.q1)} / ${formatNumber(yStats.q3)}` },
                  { label: "Min / Max", value: `${formatNumber(yStats.min)} / ${formatNumber(yStats.max)}` },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg font-bold font-mono">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Automatische Auswertung */}
            {insights.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" /> Automatische Auswertung
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {regression && (
                    <p className="text-xs text-muted-foreground">
                      Regression: y = {formatNumber(regression.slope, 4)} · x + {formatNumber(regression.intercept, 4)} · R² = {formatNumber(regression.r2, 3)} (n = {regression.n})
                    </p>
                  )}
                  <ul className="list-disc pl-5 space-y-1">
                    {insights.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}


          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
