import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ServiceVersion,
  ServiceVersionEntity,
} from "@/lib/api/serviceVersions";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  History, Plus, Save, Undo2, CheckCircle2, Archive, Trash2, FileText, FormInput, Layers,
} from "lucide-react";

const ROLE_VIEWS: { value: FormRoleView; label: string }[] = [
  { value: "customer", label: "Kunden-Ansicht" },
  { value: "employee", label: "Mitarbeiter-Ansicht" },
  { value: "public", label: "Öffentlich" },
];

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  draft: { label: "Entwurf", variant: "outline" },
  published: { label: "Veröffentlicht", variant: "default" },
  archived: { label: "Archiviert", variant: "secondary" },
};

const ENTITY_ICON: Record<ServiceVersionEntity, JSX.Element> = {
  form_layout: <FormInput className="h-4 w-4" />,
  document_template: <FileText className="h-4 w-4" />,
  block: <Layers className="h-4 w-4" />,
};
const ENTITY_LABEL: Record<ServiceVersionEntity, string> = {
  form_layout: "Formular-Layout",
  document_template: "Dokumentvorlage",
  block: "Baustein",
};

export default function VersionsDesigner({
  serviceId, canManage,
}: { serviceId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState<ServiceVersionEntity>("form_layout");
  const [entityId, setEntityId] = useState<string>("");
  const [roleView, setRoleView] = useState<FormRoleView>("customer");
  const [saveOpen, setSaveOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ServiceVersion | null>(null);
  const [publishTarget, setPublishTarget] = useState<ServiceVersion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceVersion | null>(null);
  const [saveForm, setSaveForm] = useState({ label: "", change_summary: "" });

  const layoutsQ = useQuery({
    queryKey: ["versions-layouts", serviceId, roleView],
    queryFn: () => api.serviceFormLayouts.get(serviceId, roleView),
    enabled: entityType === "form_layout",
  });
  const docsQ = useQuery({
    queryKey: ["versions-docs", serviceId],
    queryFn: () => api.serviceDocumentTemplates.listForService(serviceId),
    enabled: entityType === "document_template",
  });
  const blocksQ = useQuery({
    queryKey: ["versions-blocks"],
    queryFn: () => api.serviceBlocks.list(),
    enabled: entityType === "block",
  });

  // when entity list changes, default entityId
  useMemo(() => {
    if (entityType === "form_layout") {
      const id = layoutsQ.data?.id ?? "";
      if (id !== entityId) setEntityId(id);
    } else if (entityType === "document_template") {
      const first = docsQ.data?.[0]?.id ?? "";
      if (!docsQ.data?.some((d) => d.id === entityId)) setEntityId(first);
    } else if (entityType === "block") {
      const first = blocksQ.data?.[0]?.id ?? "";
      if (!blocksQ.data?.some((b) => b.id === entityId)) setEntityId(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, layoutsQ.data, docsQ.data, blocksQ.data]);

  const versionsQ = useQuery({
    queryKey: ["service-versions", entityType, entityId],
    queryFn: () => api.serviceVersions.list(entityType, entityId),
    enabled: !!entityId,
  });

  const currentSnapshot = (): any => {
    if (entityType === "form_layout") {
      return { layout: layoutsQ.data?.layout ?? { sections: [] }, role_view: roleView };
    }
    if (entityType === "document_template") {
      return docsQ.data?.find((d) => d.id === entityId) ?? null;
    }
    if (entityType === "block") {
      return blocksQ.data?.find((b) => b.id === entityId) ?? null;
    }
    return null;
  };

  const saveVersion = useMutation({
    mutationFn: () =>
      api.serviceVersions.create({
        entity_type: entityType,
        entity_id: entityId,
        service_id: entityType === "block" ? null : serviceId,
        snapshot: currentSnapshot(),
        label: saveForm.label.trim() || null,
        change_summary: saveForm.change_summary.trim() || null,
        status: "draft",
      }),
    onSuccess: () => {
      toast.success("Version gespeichert");
      setSaveOpen(false);
      setSaveForm({ label: "", change_summary: "" });
      qc.invalidateQueries({ queryKey: ["service-versions", entityType, entityId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const publishM = useMutation({
    mutationFn: (id: string) => api.serviceVersions.publish(id),
    onSuccess: () => {
      toast.success("Version veröffentlicht");
      setPublishTarget(null);
      qc.invalidateQueries({ queryKey: ["service-versions", entityType, entityId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => api.serviceVersions.remove(id),
    onSuccess: () => {
      toast.success("Version gelöscht");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["service-versions", entityType, entityId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const restoreM = useMutation({
    mutationFn: async (v: ServiceVersion) => {
      const snap = v.snapshot ?? {};
      if (v.entity_type === "form_layout") {
        const rv = (snap.role_view as FormRoleView) ?? roleView;
        await api.serviceFormLayouts.upsert(serviceId, rv, snap.layout ?? { sections: [] });
      } else if (v.entity_type === "document_template") {
        const { id, created_at, updated_at, updated_by, ...rest } = snap;
        await api.serviceDocumentTemplates.update(v.entity_id, rest);
      } else if (v.entity_type === "block") {
        const { id, created_at, updated_at, created_by, is_system, ...rest } = snap;
        await api.serviceBlocks.update(v.entity_id, rest);
      }
    },
    onSuccess: () => {
      toast.success("Version wiederhergestellt");
      setRestoreTarget(null);
      qc.invalidateQueries({ queryKey: ["versions-layouts", serviceId, roleView] });
      qc.invalidateQueries({ queryKey: ["versions-docs", serviceId] });
      qc.invalidateQueries({ queryKey: ["versions-blocks"] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const entityOptions = useMemo(() => {
    if (entityType === "document_template") {
      return (docsQ.data ?? []).map((d) => ({ value: d.id, label: d.name }));
    }
    if (entityType === "block") {
      return (blocksQ.data ?? []).map((b) => ({ value: b.id, label: `${b.category} · ${b.name}` }));
    }
    return [];
  }, [entityType, docsQ.data, blocksQ.data]);

  const noEntity =
    (entityType === "form_layout" && !layoutsQ.data) ||
    (entityType === "document_template" && !entityId) ||
    (entityType === "block" && !entityId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Versionierung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Objekttyp</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as ServiceVersionEntity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_layout">Formular-Layout</SelectItem>
                  <SelectItem value="document_template">Dokumentvorlage</SelectItem>
                  <SelectItem value="block">Baustein</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {entityType === "form_layout" && (
              <div className="space-y-1.5">
                <Label>Rollen-Ansicht</Label>
                <Select value={roleView} onValueChange={(v) => setRoleView(v as FormRoleView)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_VIEWS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {entityType !== "form_layout" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>{ENTITY_LABEL[entityType]}</Label>
                <Select value={entityId || "__none__"} onValueChange={(v) => setEntityId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
                  <SelectContent>
                    {entityOptions.length === 0 ? (
                      <SelectItem value="__none__" disabled>Keine Einträge</SelectItem>
                    ) : (
                      entityOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {ENTITY_ICON[entityType]}
              {entityType === "form_layout"
                ? `Layout (${ROLE_VIEWS.find((r) => r.value === roleView)?.label})`
                : entityOptions.find((o) => o.value === entityId)?.label ?? "Kein Eintrag ausgewählt"}
            </div>
            <Button
              size="sm"
              onClick={() => setSaveOpen(true)}
              disabled={!canManage || noEntity || !entityId}
            >
              <Save className="h-4 w-4 mr-1" /> Aktuelle Version speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versionsverlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {!entityId ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              Bitte zuerst ein Objekt auswählen.
            </div>
          ) : versionsQ.isLoading ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Lade …</div>
          ) : (versionsQ.data?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">
              Noch keine Versionen gespeichert. Klicke oben auf <Plus className="inline h-3 w-3" /> „Aktuelle Version speichern".
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nr.</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versionsQ.data!.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">v{v.version_no}</TableCell>
                    <TableCell>{v.label ?? `v${v.version_no}`}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABEL[v.status]?.variant ?? "outline"}>
                        {STATUS_LABEL[v.status]?.label ?? v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {v.change_summary ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManage && v.status !== "published" && (
                        <Button size="sm" variant="ghost" onClick={() => setPublishTarget(v)} title="Veröffentlichen">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => setRestoreTarget(v)} title="Wiederherstellen">
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(v)} title="Löschen">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Version speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Bezeichnung (optional)</Label>
              <Input
                placeholder={`z.B. v${(versionsQ.data?.[0]?.version_no ?? 0) + 1}.0 – Layout für QM`}
                value={saveForm.label}
                onChange={(e) => setSaveForm((s) => ({ ...s, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Änderungsbeschreibung</Label>
              <Textarea
                rows={3}
                placeholder="Was wurde geändert?"
                value={saveForm.change_summary}
                onChange={(e) => setSaveForm((s) => ({ ...s, change_summary: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Abbrechen</Button>
            <Button onClick={() => saveVersion.mutate()} disabled={saveVersion.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirm */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die aktuelle Konfiguration wird durch <b>v{restoreTarget?.version_no}</b> ersetzt.
              Tipp: Speichere vorher die aktuelle Version, um sie nicht zu verlieren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreTarget && restoreM.mutate(restoreTarget)}>
              Wiederherstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish confirm */}
      <AlertDialog open={!!publishTarget} onOpenChange={(o) => !o && setPublishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version veröffentlichen?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>v{publishTarget?.version_no}</b> wird als veröffentlichte Version markiert.
              Eine bisher veröffentlichte Version wird archiviert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishTarget && publishM.mutate(publishTarget.id)}>
              Veröffentlichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>v{deleteTarget?.version_no}</b> wird unwiderruflich entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteM.mutate(deleteTarget.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
