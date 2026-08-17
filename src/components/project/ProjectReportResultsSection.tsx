import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ProjectResultRow } from "@/components/project/ProjectResultsTab";
import {
  useProjectReports,
  useProjectReportSelections,
  useCreateProjectReport,
  useDeleteProjectReport,
  useSetProjectReportSelection,
} from "@/hooks/useProjectReports";

const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");

interface Props {
  projectId: string;
  /** Nur offizielle Ergebnisse – Quelle ist die bestehende Ergebnislogik. */
  rows: ProjectResultRow[];
  canEdit: boolean;
}

/**
 * Optionale Auswahl offizieller Ergebnisse für den Projektbericht.
 * Gespeichert werden ausschließlich Referenzen (project_report_results).
 */
export function ProjectReportResultsSection({ projectId, rows, canEdit }: Props) {
  const { data: reports = [] } = useProjectReports(projectId);
  const { data: selections = [] } = useProjectReportSelections(projectId);
  const createReport = useCreateProjectReport(projectId);
  const deleteReport = useDeleteProjectReport(projectId);
  const saveSelection = useSetProjectReportSelection(projectId);

  const [reportId, setReportId] = useState<string>("__none__");
  const [newTitle, setNewTitle] = useState("");
  const [draft, setDraft] = useState<string[]>([]);

  useEffect(() => {
    if (reportId === "__none__" && (reports as any[]).length > 0) {
      setReportId((reports as any[])[0].id);
    }
  }, [reports, reportId]);

  const savedIds = useMemo(
    () =>
      (selections as any[])
        .filter((s) => s.report_id === reportId)
        .map((s) => s.measurement_result_id),
    [selections, reportId]
  );

  useEffect(() => {
    setDraft(savedIds);
  }, [reportId, selections]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRows = rows.filter((r) => draft.includes(r.id));
  const dirty =
    draft.length !== savedIds.length || draft.some((id) => !savedIds.includes(id));

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectResultRow[]>();
    for (const r of rows) {
      const key = `${r.orderNumber} · ${r.serviceName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const toggle = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const created: any = await createReport.mutateAsync({ title: newTitle.trim() });
    setNewTitle("");
    if (created?.id) setReportId(created.id);
    toast({ title: "Bericht angelegt" });
  };

  const handleSave = async () => {
    if (reportId === "__none__") return;
    await saveSelection.mutateAsync({ reportId, resultIds: draft });
    toast({ title: "Auswahl gespeichert" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="min-w-[240px]">
          <Label className="text-xs">Bericht</Label>
          <Select value={reportId} onValueChange={setReportId}>
            <SelectTrigger>
              <SelectValue placeholder="Bericht wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Kein Bericht ausgewählt</SelectItem>
              {(reports as any[]).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <>
            <div className="min-w-[200px]">
              <Label className="text-xs">Neuer Bericht</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titel"
              />
            </div>
            <Button variant="outline" onClick={handleCreate} disabled={!newTitle.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Anlegen
            </Button>
            {reportId !== "__none__" && (
              <>
                <Button onClick={handleSave} disabled={!dirty}>
                  <Save className="h-4 w-4 mr-2" />
                  Auswahl speichern
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await deleteReport.mutateAsync(reportId);
                    setReportId("__none__");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {reportId !== "__none__" && canEdit && (
        <div className="rounded-lg border p-3 space-y-3 print:hidden">
          <p className="text-sm text-muted-foreground">
            Nur offiziell freigegebene Ergebnisse stehen zur Auswahl ({rows.length}).
          </p>
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offiziellen Ergebnisse vorhanden.</p>
          ) : (
            grouped.map(([group, groupRows]) => (
              <div key={group}>
                <p className="text-sm font-medium mb-1">{group}</p>
                <div className="grid gap-1 md:grid-cols-2">
                  {groupRows.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.includes(r.id)}
                        onCheckedChange={() => toggle(r.id)}
                      />
                      <span>
                        {r.sampleNumber} · {r.parameter}
                        {r.value != null ? `: ${r.value}` : ""} {r.unit || ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="rox-print-block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Probe</TableHead>
                <TableHead>Auftrag</TableHead>
                <TableHead>Dienstleistung</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead className="text-right">Wert</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead>Gemessen am</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.sampleNumber}
                    {r.originalSampleNumber ? ` (Ersatz für ${r.originalSampleNumber})` : ""}
                  </TableCell>
                  <TableCell>{r.orderNumber}</TableCell>
                  <TableCell>{r.serviceName}</TableCell>
                  <TableCell>{r.parameter}</TableCell>
                  <TableCell className="text-right">{r.value ?? "–"}</TableCell>
                  <TableCell>{r.unit || "–"}</TableCell>
                  <TableCell>{d(r.measuredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {selectedRows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Für diesen Bericht wurden keine Ergebnisse ausgewählt.
        </p>
      )}
    </div>
  );
}
