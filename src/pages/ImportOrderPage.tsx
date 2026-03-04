import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
import { useCreateSample } from "@/hooks/useSamples";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Upload, Download, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  parseExcelFile,
  groupRowsIntoOrders,
  generateTemplate,
  validateRows,
  type ImportedOrderRow,
} from "@/lib/excel-import";
import ImportOrderEditor from "@/components/ImportOrderEditor";

export default function ImportOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const createProject = useCreateProject();
  const createOrder = useCreateOrder();
  const addMeasurement = useAddOrderMeasurement();
  const createSample = useCreateSample();

  const [rawRows, setRawRows] = useState<ImportedOrderRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const serviceList = useMemo(
    () => services.map((s) => ({ id: s.id, service_name: s.service_name, workstation_id: s.workstation_id })),
    [services]
  );

  const fieldErrors = useMemo(() => validateRows(rawRows, serviceList), [rawRows, serviceList]);

  const totalErrors = useMemo(
    () => fieldErrors.reduce((sum, e) => sum + Object.keys(e).length, 0),
    [fieldErrors]
  );

  const rowsWithErrors = useMemo(
    () => fieldErrors.filter((e) => Object.keys(e).length > 0).length,
    [fieldErrors]
  );

  const groupedOrders = useMemo(
    () => (rawRows.length > 0 ? groupRowsIntoOrders(rawRows, serviceList) : []),
    [rawRows, serviceList]
  );

  const validOrders = useMemo(
    () => groupedOrders.filter((o) => o.errors.length === 0),
    [groupedOrders]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const { rows } = parseExcelFile(buffer);
        if (rows.length === 0) {
          toast.error("Die Datei enthält keine Daten.");
          setRawRows([]);
          return;
        }
        setRawRows(rows);
        toast.success(`${rows.length} Zeile(n) eingelesen`);
      } catch (err: any) {
        toast.error("Fehler beim Lesen der Datei", { description: err.message });
        setRawRows([]);
      }
      e.target.value = "";
    },
    []
  );

  const handleImport = async () => {
    if (!user || validOrders.length === 0 || totalErrors > 0) return;
    setSubmitting(true);
    let created = 0;
    try {
      for (const order of validOrders) {
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

        const sample = await createSample.mutateAsync({
          sample_name: order.sample.sample_name,
          project_id: projectId,
          description: order.sample.sample_description,
          created_by: user.id,
        });

        const newOrder = await createOrder.mutateAsync({
          project_id: projectId,
          order_type: order.order_type as any,
          created_by: user.id,
          due_date: order.due_date || undefined,
          notes: order.notes || undefined,
          priority: order.priority as any,
          sample_id: sample.id,
        });

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
      toast.error(`Fehler beim Import (${created} erstellt)`, { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Excel-Import</h1>
          <p className="text-muted-foreground">Messaufträge aus einer Excel-Datei importieren</p>
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
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              <div className="inline-flex items-center gap-2 px-4 py-2 border rounded-md bg-background hover:bg-accent transition-colors text-sm font-medium">
                <Upload className="h-4 w-4" /> Excel-Datei auswählen
              </div>
            </label>
            <Button variant="outline" size="sm" onClick={generateTemplate}>
              <Download className="h-4 w-4 mr-2" /> Vorlage herunterladen
            </Button>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName} – {rawRows.length} Zeile(n)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor with inline correction */}
      {rawRows.length > 0 && (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{rawRows.length} Zeilen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">→ {groupedOrders.length} Aufträge</span>
                </div>
                {totalErrors > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {totalErrors} Fehler in {rowsWithErrors} Zeile(n)
                  </Badge>
                ) : (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Alle Daten gültig
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editable Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Daten bearbeiten
                {totalErrors > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    – Fehlerhafte Felder sind rot markiert. Fahren Sie mit der Maus darüber für Details.
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <ImportOrderEditor
                rows={rawRows}
                onRowsChange={setRawRows}
                services={serviceList}
                fieldErrors={fieldErrors}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={submitting || totalErrors > 0 || validOrders.length === 0}
            >
              {submitting
                ? "Importiere..."
                : `${validOrders.length} Auftrag/Aufträge importieren`}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRawRows([]);
                setFileName("");
              }}
            >
              Zurücksetzen
            </Button>
          </div>
        </>
      )}

      {/* Instructions */}
      {rawRows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anleitung</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Laden Sie die <strong>Vorlage</strong> herunter und füllen Sie sie mit Ihren Auftragsdaten aus.
            </p>
            <p>
              Jede Zeile entspricht einer Messung. Mehrere Zeilen mit gleicher Projektnummer, Probenname und
              Auftragstyp werden zu einem Auftrag zusammengefasst.
            </p>
            <p>
              <strong>Pflichtfelder:</strong> Projektnummer, Probenname, Probenbeschreibung, Auftragstyp,
              Messdienstleistung
            </p>
            <p><strong>Auftragstypen:</strong> Kundenauftrag, Produktionsauftrag, F&E-Auftrag</p>
            <p><strong>Prioritäten:</strong> Normal, Wichtig, Höchste</p>
            <p className="text-primary font-medium">
              Neu: Fehler können direkt in der Vorschau korrigiert werden!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
