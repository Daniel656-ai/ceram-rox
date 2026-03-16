import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Database, ShieldCheck, AlertTriangle, CheckCircle2, Download, Upload, RefreshCw, FileJson, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface IntegrityResult {
  checked_at: string;
  issues: Array<{ table: string; issue: string; severity: "warning" | "error"; count: number }>;
  table_counts: Record<string, number>;
  total_issues: number;
  total_errors: number;
  total_warnings: number;
}

export default function AdminDatabasePage() {
  const { t } = useTranslation(["admin"]);
  const { toast } = useToast();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [jsonImport, setJsonImport] = useState("");
  const [jsonValidation, setJsonValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  const runIntegrityCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("db-integrity-check", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: "Integritätsprüfung abgeschlossen",
        description: `${data.total_issues} Probleme gefunden (${data.total_errors} Fehler, ${data.total_warnings} Warnungen)`,
      });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportJson = async () => {
    setExporting(true);
    try {
      const [
        { data: projects },
        { data: orders },
        { data: measurements },
        { data: samples },
        { data: results },
        { data: services },
      ] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("measurement_orders").select("*"),
        supabase.from("order_measurements").select("*"),
        supabase.from("samples").select("*"),
        supabase.from("measurement_results").select("*"),
        supabase.from("measurement_services").select("*"),
      ]);

      const exportData = {
        schema_version: 1,
        exported_at: new Date().toISOString(),
        entity_counts: {
          projects: projects?.length ?? 0,
          orders: orders?.length ?? 0,
          measurements: measurements?.length ?? 0,
          samples: samples?.length ?? 0,
          results: results?.length ?? 0,
          services: services?.length ?? 0,
        },
        data: {
          projects: projects ?? [],
          orders: orders ?? [],
          measurements: measurements ?? [],
          samples: samples ?? [],
          results: results ?? [],
          services: services ?? [],
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `db-export_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export erfolgreich" });
    } catch (err: any) {
      toast({ title: "Fehler beim Export", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const validateJson = () => {
    const errors: string[] = [];
    try {
      const parsed = JSON.parse(jsonImport);
      if (!parsed.schema_version) errors.push("Feld 'schema_version' fehlt");
      if (!parsed.data) errors.push("Feld 'data' fehlt");
      if (parsed.data) {
        const expectedEntities = ["projects", "orders", "measurements", "samples", "results", "services"];
        expectedEntities.forEach(e => {
          if (parsed.data[e] && !Array.isArray(parsed.data[e])) {
            errors.push(`'data.${e}' muss ein Array sein`);
          }
        });
        // Validate referential integrity within JSON
        if (parsed.data.projects && parsed.data.orders) {
          const projectIds = new Set(parsed.data.projects.map((p: any) => p.id));
          const orphanedOrders = parsed.data.orders.filter((o: any) => !projectIds.has(o.project_id));
          if (orphanedOrders.length > 0) {
            errors.push(`${orphanedOrders.length} Aufträge referenzieren nicht-existierende Projekte`);
          }
        }
        if (parsed.data.orders && parsed.data.measurements) {
          const orderIds = new Set(parsed.data.orders.map((o: any) => o.id));
          const orphaned = parsed.data.measurements.filter((m: any) => !orderIds.has(m.order_id));
          if (orphaned.length > 0) {
            errors.push(`${orphaned.length} Messungen referenzieren nicht-existierende Aufträge`);
          }
        }
      }
      setJsonValidation({ valid: errors.length === 0, errors });
    } catch {
      setJsonValidation({ valid: false, errors: ["Ungültiges JSON-Format"] });
    }
  };

  const tableLabels: Record<string, string> = {
    projects: "Projekte",
    measurement_orders: "Messaufträge",
    order_measurements: "Messungen",
    samples: "Proben",
    profiles: "Benutzerprofile",
    work_logs: "Arbeitsprotokolle",
    measurement_services: "Messdienstleistungen",
    measurement_templates: "Templates",
    raw_materials: "Rohstoffe",
    consumables: "Verbrauchsmaterialien",
    workstations: "Arbeitsplätze",
    measurement_results: "Messergebnisse",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Datenbank-Status
        </h1>
        <p className="text-muted-foreground">
          Übersicht, Integritätsprüfung und JSON-Export/Import
        </p>
      </div>

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Status
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Integritätsprüfung
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-1.5">
            <FileJson className="h-4 w-4" /> JSON Export/Import
          </TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          {!result ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Starten Sie die Integritätsprüfung, um den Datenbankstatus zu laden.
                </p>
                <Button onClick={runIntegrityCheck} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Prüfung läuft..." : "Prüfung starten"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tabellen</CardTitle>
                    <Database className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Object.keys(result.table_counts).length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Datensätze gesamt</CardTitle>
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Object.values(result.table_counts).reduce((a, b) => a + b, 0).toLocaleString("de-DE")}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Fehler</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{result.total_errors}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Warnungen</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-warning">{result.total_warnings}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Tabellenübersicht</CardTitle>
                    <Button variant="outline" size="sm" onClick={runIntegrityCheck} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                      Aktualisieren
                    </Button>
                  </div>
                  <CardDescription>
                    Letzte Prüfung: {format(new Date(result.checked_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabelle</TableHead>
                        <TableHead className="text-right">Datensätze</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.table_counts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([table, count]) => (
                          <TableRow key={table}>
                            <TableCell className="font-medium">{tableLabels[table] || table}</TableCell>
                            <TableCell className="text-right font-mono">{count.toLocaleString("de-DE")}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Integrity Tab */}
        <TabsContent value="integrity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Referenzielle Integrität
              </CardTitle>
              <CardDescription>
                Prüft ob alle Fremdschlüssel-Beziehungen konsistent sind.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="text-center py-8">
                  <Button onClick={runIntegrityCheck} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Prüfung läuft..." : "Integritätsprüfung starten"}
                  </Button>
                </div>
              ) : result.issues.length === 0 ? (
                <div className="flex items-center gap-3 py-6 justify-center text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-medium">Keine Integritätsprobleme gefunden</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schwere</TableHead>
                      <TableHead>Tabelle</TableHead>
                      <TableHead>Problem</TableHead>
                      <TableHead className="text-right">Anzahl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.issues.map((issue, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>
                            {issue.severity === "error" ? "Fehler" : "Warnung"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{issue.table}</TableCell>
                        <TableCell>{issue.issue}</TableCell>
                        <TableCell className="text-right font-mono">{issue.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* JSON Tab */}
        <TabsContent value="json" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4" /> JSON-Export
                </CardTitle>
                <CardDescription>
                  Exportiert Projekte, Aufträge, Messungen, Proben und Ergebnisse als JSON.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={exportJson} disabled={exporting} className="w-full">
                  <Download className={`h-4 w-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
                  {exporting ? "Exportiere..." : "Daten als JSON exportieren"}
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Der Export enthält ein versioniertes Schema und kann zur Validierung oder Datensicherung verwendet werden.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" /> JSON-Validierung
                </CardTitle>
                <CardDescription>
                  Fügen Sie JSON-Daten ein, um Schema und Referenzen zu prüfen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder='{"schema_version": 1, "data": { ... }}'
                  value={jsonImport}
                  onChange={(e) => {
                    setJsonImport(e.target.value);
                    setJsonValidation(null);
                  }}
                  rows={6}
                  className="font-mono text-xs"
                />
                <Button onClick={validateJson} disabled={!jsonImport.trim()} variant="outline" className="w-full">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Schema validieren
                </Button>
                {jsonValidation && (
                  <div className={`rounded-md p-3 text-sm ${jsonValidation.valid ? "bg-green-50 text-green-800 border border-green-200" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                    {jsonValidation.valid ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        JSON-Schema ist gültig
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          Validierungsfehler:
                        </div>
                        <ul className="list-disc list-inside ml-2">
                          {jsonValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
