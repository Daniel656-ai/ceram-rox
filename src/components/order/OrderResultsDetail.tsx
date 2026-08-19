import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FlaskConical } from "lucide-react";
import {
  buildOrderResultStructure,
  buildComparison,
  groupByResultGroup,
  type AnalysisEntry,
} from "@/lib/orderResultsStructure";
import type { RawMeasurementRow } from "@/lib/orderResultsAggregation";
import { buildServiceSchemas, type ResultParamColumn } from "@/lib/resultSchema";

function fmt(n: number | null) {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 }).format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString("de-AT");
}

/** Vertikale Detailtabelle: Parameter | Ergebnis | Einheit (vollständig, scrollbar). */
function AnalysisTable({ analysis }: { analysis: AnalysisEntry }) {
  const groups = groupByResultGroup(analysis.values);
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <ParamGroup key={g.name} name={g.name} count={g.rows.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Parameter</TableHead>
                <TableHead className="text-right">Ergebnis</TableHead>
                <TableHead className="w-24">Einheit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.rows.map((v) => (
                <TableRow key={v.key}>
                  <TableCell>{v.label}</TableCell>
                  <TableCell className="text-right tabular-nums font-mono">
                    {v.value !== null ? fmt(v.value) : v.text ?? ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.unit ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ParamGroup>
      ))}
    </div>
  );
}

function ParamGroup({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-md">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            {name}
            <Badge variant="secondary" className="text-[10px]">{count}</Badge>
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-[520px] overflow-y-auto">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ComparisonView({ analyses }: { analyses: AnalysisEntry[] }) {
  const [selected, setSelected] = useState<string[]>(analyses.map((a) => a.measurementId));
  const chosen = analyses.filter((a) => selected.includes(a.measurementId));
  const rows = useMemo(() => buildComparison(chosen), [chosen]);
  const groups = groupByResultGroup(rows);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {analyses.map((a) => (
          <label key={a.measurementId} className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={selected.includes(a.measurementId)}
              onCheckedChange={() => toggle(a.measurementId)}
            />
            <span>
              Analyse {a.index}
              <span className="text-muted-foreground ml-1 font-mono">{a.measurementNumber}</span>
            </span>
          </label>
        ))}
      </div>

      {chosen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bitte mindestens eine Analyse auswählen.</p>
      ) : (
        groups.map((g) => (
          <ParamGroup key={g.name} name={g.name} count={g.rows.length}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Parameter</TableHead>
                    {chosen.map((a) => (
                      <TableHead key={a.measurementId} className="text-right whitespace-nowrap">
                        Analyse {a.index}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Mittelwert</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">SD</TableHead>
                    <TableHead className="w-20">Einheit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="sticky left-0 bg-background z-10">{r.label}</TableCell>
                      {r.cells.map((c, i) => (
                        <TableCell key={i} className="text-right tabular-nums font-mono">
                          {c.value !== null ? fmt(c.value) : c.text ?? ""}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums font-mono">{fmt(r.mean)}</TableCell>
                      <TableCell className="text-right tabular-nums font-mono">{fmt(r.min)}</TableCell>
                      <TableCell className="text-right tabular-nums font-mono">{fmt(r.max)}</TableCell>
                      <TableCell className="text-right tabular-nums font-mono">{fmt(r.sd)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.unit ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ParamGroup>
        ))
      )}
    </div>
  );
}

/**
 * Vollständige Ergebnisdarstellung eines Auftrags:
 * Probe → Dienstleistung/Analyse → alle Ergebnisparameter (vertikal),
 * inklusive Vergleichsansicht bei mehreren Analysen derselben Dienstleistung.
 */
export default function OrderResultsDetail({ orderId }: { orderId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["order-results-overview", orderId],
    queryFn: () => api.orderSamples.resultsOverview(orderId) as Promise<RawMeasurementRow[]>,
    enabled: !!orderId,
  });

  const { data: paramDefs = [] } = useQuery({
    queryKey: ["all-service-param-defs"],
    queryFn: () => api.serviceParameters.listAll() as Promise<any[]>,
  });

  // Definierte Ergebnisstruktur je Dienstleistung (Reihenfolge + Gruppen).
  const columnsByService = useMemo(() => {
    const map = new Map<string, ResultParamColumn[]>();
    const schemas = buildServiceSchemas(
      (rows as RawMeasurementRow[]).map((m) => ({
        serviceId: m.service_id,
        serviceName: m.measurement_services?.service_name || "",
        outputResults: (m.measurement_results || []).filter((r) => r.is_official === true),
      })) as any,
      paramDefs as any
    );
    schemas.forEach((s) => s.serviceId && map.set(s.serviceId, s.columns));
    return map;
  }, [rows, paramDefs]);

  const samples = useMemo(
    () => buildOrderResultStructure(rows as RawMeasurementRow[], columnsByService),
    [rows, columnsByService]
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Ergebnisse werden geladen…</p>;
  }

  if (samples.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Für diesen Auftrag liegen noch keine offiziellen Ergebnisse vor.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {samples.map((s) => (
        <Card key={s.sampleId ?? s.sampleNumber}>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="font-mono">{s.sampleNumber}</span>
              <span className="font-normal text-muted-foreground">{s.sampleName}</span>
              {s.isReplacement && (
                <Badge variant="outline" className="text-[10px]">
                  Ersatzprobe für {s.originalSampleNumber}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {s.analysisCount} Analyse{s.analysisCount === 1 ? "" : "n"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.services.map((svc) => (
              <div key={svc.serviceId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{svc.serviceName}</h4>
                  <Badge variant="outline" className="text-[10px]">
                    {svc.analyses.length} Analyse{svc.analyses.length === 1 ? "" : "n"}
                  </Badge>
                </div>

                {svc.analyses.length > 1 ? (
                  <Tabs defaultValue="single">
                    <TabsList>
                      <TabsTrigger value="single">Einzelergebnisse</TabsTrigger>
                      <TabsTrigger value="compare">Vergleich</TabsTrigger>
                    </TabsList>
                    <TabsContent value="single" className="space-y-3 pt-3">
                      {svc.analyses.map((a) => (
                        <AnalysisBlock key={a.measurementId} analysis={a} />
                      ))}
                    </TabsContent>
                    <TabsContent value="compare" className="pt-3">
                      <ComparisonView analyses={svc.analyses} />
                    </TabsContent>
                  </Tabs>
                ) : (
                  svc.analyses.map((a) => <AnalysisBlock key={a.measurementId} analysis={a} />)
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnalysisBlock({ analysis }: { analysis: AnalysisEntry }) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Analyse {analysis.index}</span>
        <span className="font-mono text-xs text-muted-foreground">{analysis.measurementNumber}</span>
        <span className="text-xs text-muted-foreground">Datum: {fmtDate(analysis.date)}</span>
        <Badge variant={analysis.status === "completed" ? "default" : "secondary"} className="text-[10px]">
          {analysis.status === "completed" ? "Abgeschlossen" : analysis.status ?? "offen"}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {analysis.values.length} Ergebnisse
        </Badge>
      </div>
      <AnalysisTable analysis={analysis} />
    </div>
  );
}
