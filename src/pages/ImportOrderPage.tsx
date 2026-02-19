import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
import { useCreateSample } from "@/hooks/useSamples";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_TYPE_LABELS, ORDER_PRIORITY_LABELS } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Upload, Download, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { parseExcelFile, groupRowsIntoOrders, generateTemplate, type ParsedImportOrder } from "@/lib/excel-import";

export default function ImportOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const createProject = useCreateProject();
  const createOrder = useCreateOrder();
  const addMeasurement = useAddOrderMeasurement();
  const createSample = useCreateSample();

  const [parsedOrders, setParsedOrders] = useState<ParsedImportOrder[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validOrders = parsedOrders.filter((o) => o.errors.length === 0);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      try {
        const buffer = await file.arrayBuffer();
        const rows = parseExcelFile(buffer);
        if (rows.length === 0) {
          toast.error("Die Datei enthält keine Daten.");
          setParsedOrders([]);
          return;
        }
        const serviceList = services.map((s) => ({
          id: s.id,
          service_name: s.service_name,
          workstation_id: s.workstation_id,
        }));
        const orders = groupRowsIntoOrders(rows, serviceList);
        setParsedOrders(orders);
        toast.success(`${orders.length} Auftrag/Aufträge erkannt`);
      } catch (err: any) {
        toast.error("Fehler beim Lesen der Datei", { description: err.message });
        setParsedOrders([]);
      }

      // Reset file input
      e.target.value = "";
    },
    [services]
  );

  const handleImport = async () => {
    if (!user || validOrders.length === 0) return;
    setSubmitting(true);

    let created = 0;
    try {
      for (const order of validOrders) {
        // 1. Find or create project
        let projectId = projects.find(
          (p) => p.project_number.toLowerCase() === order.project_number.toLowerCase()
        )?.id;

        if (!projectId) {
          const newProj = await createProject.mutateAsync({
            project_number: order.project_number,
            project_name: order.project_name || undefined,
            created_by: user.id,
          });
          projectId = newProj.id;
        }

        // 2. Create sample
        const sample = await createSample.mutateAsync({
          sample_name: order.sample.sample_name,
          project_id: projectId,
          description: order.sample.sample_description,
          created_by: user.id,
        });

        // 3. Create order
        const newOrder = await createOrder.mutateAsync({
          project_id: projectId,
          order_type: order.order_type as any,
          created_by: user.id,
          due_date: order.due_date || undefined,
          notes: order.notes || undefined,
          priority: order.priority as any,
          sample_id: sample.id,
        });

        // 4. Create measurements
        await Promise.all(
          order.measurements
            .filter((m) => m.matched_service_id)
            .map((m) =>
              addMeasurement.mutateAsync({
                order_id: newOrder.id,
                service_id: m.matched_service_id!,
                planned_hours: m.planned_hours,
                due_date: order.due_date || undefined,
                workstation_id: m.matched_workstation_id || undefined,
              })
            )
        );

        created++;
      }

      toast.success(`${created} Messauftrag/Messaufträge erfolgreich erstellt!`);
      navigate("/auftraege");
    } catch (err: any) {
      toast.error(`Fehler beim Import (${created} von ${validOrders.length} erstellt)`, {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Excel-Import</h1>
          <p className="text-muted-foreground">
            Messaufträge aus einer Excel-Datei importieren
          </p>
        </div>
      </div>

      {/* Upload & Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datei hochladen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md bg-background hover:bg-accent transition-colors text-sm font-medium">
                <Upload className="h-4 w-4" />
                Excel-Datei auswählen
              </div>
            </label>
            <Button variant="outline" size="sm" onClick={generateTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Vorlage herunterladen
            </Button>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName} – {parsedOrders.length} Auftrag/Aufträge erkannt
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Vorschau ({validOrders.length} gültig, {parsedOrders.length - validOrders.length} fehlerhaft)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Probe</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Messungen</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedOrders.map((order, idx) => (
                  <TableRow key={idx} className={order.errors.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {order.errors.length > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{order.project_number}</div>
                      {order.project_name && (
                        <div className="text-xs text-muted-foreground">{order.project_name}</div>
                      )}
                      {!projects.find(
                        (p) => p.project_number.toLowerCase() === order.project_number.toLowerCase()
                      ) && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Neu
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{order.sample.sample_name}</TableCell>
                    <TableCell className="text-sm">
                      {ORDER_TYPE_LABELS[order.order_type as keyof typeof ORDER_TYPE_LABELS] || order.order_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.priority === "hoechste"
                            ? "destructive"
                            : order.priority === "wichtig"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {ORDER_PRIORITY_LABELS[order.priority as keyof typeof ORDER_PRIORITY_LABELS] || order.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.measurements.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-1">
                          <span>{m.service_name}</span>
                          <span className="text-muted-foreground">({m.planned_hours}h)</span>
                          {!m.matched_service_id && (
                            <Badge variant="destructive" className="text-xs">
                              ?
                            </Badge>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {order.errors.length > 0 && (
                        <ul className="text-xs text-destructive list-disc list-inside">
                          {order.errors.map((e, ei) => (
                            <li key={ei}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {parsedOrders.length > 0 && (
        <div className="flex gap-3">
          <Button
            onClick={handleImport}
            disabled={submitting || validOrders.length === 0}
          >
            {submitting
              ? "Importiere..."
              : `${validOrders.length} Auftrag/Aufträge importieren`}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setParsedOrders([]);
              setFileName("");
            }}
          >
            Zurücksetzen
          </Button>
        </div>
      )}

      {/* Instructions */}
      {parsedOrders.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anleitung</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Laden Sie die <strong>Vorlage</strong> herunter und füllen Sie sie mit Ihren Auftragsdaten aus.
            </p>
            <p>Jede Zeile entspricht einer Messung. Mehrere Zeilen mit gleicher Projektnummer, Probenname und Auftragstyp werden zu einem Auftrag zusammengefasst.</p>
            <p><strong>Pflichtfelder:</strong> Projektnummer, Probenname, Probenbeschreibung, Auftragstyp, Messdienstleistung</p>
            <p><strong>Auftragstypen:</strong> Kundenauftrag, Produktionsauftrag, F&E-Auftrag</p>
            <p><strong>Prioritäten:</strong> Normal, Wichtig, Höchste</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
