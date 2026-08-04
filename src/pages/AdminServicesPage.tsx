import { useTranslation } from "react-i18next";
import {
  useAllServices,
  useUpdateService,
  useCreateService,
  useArchiveService,
  useUnarchiveService,
  useDeleteService,
  useServiceReferences,
} from "@/hooks/useMeasurements";
import { useWorkstations } from "@/hooks/useWorkstations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings2, Eye, AlertTriangle, CheckCircle2, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, FormInput } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ServiceParameterEditor from "@/components/ServiceParameterEditor";
import ServiceBookingForm, { useServiceHasFormLayout } from "@/components/ServiceBookingForm";
import ServiceFormLinksDialog from "@/components/ServiceDesigner/ServiceFormLinksDialog";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

function DurationCell({ service, onUpdate, t }: { service: any; onUpdate: (id: string, val: number) => void; t: any }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(service.standard_duration_hours ?? 1));
  if (editing) {
    return (
      <div className="flex gap-2">
        <Input type="number" value={val} onChange={e => setVal(e.target.value)} className="w-20 h-8" min={0.25} step={0.25} />
        <Button size="sm" onClick={() => { onUpdate(service.id, parseFloat(val)); setEditing(false); }}>OK</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>✕</Button>
      </div>
    );
  }
  return <button className="hover:underline text-left" onClick={() => { setVal(String(service.standard_duration_hours ?? 1)); setEditing(true); }}>{service.standard_duration_hours ?? 1} h</button>;
}

function BookingFormStatusCell({ serviceId, onPreview }: { serviceId: string; onPreview: () => void }) {
  const { data: hasLayout, isLoading } = useServiceHasFormLayout(serviceId, "customer");
  if (isLoading) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <div className="flex items-center gap-2">
      {hasLayout ? (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Aktiv
        </Badge>
      ) : (
        <Badge variant="destructive" className="text-[10px] gap-1" title="Kein Buchungsformular im Designer hinterlegt – Auftraggeber sehen Fallback / Parameter">
          <AlertTriangle className="h-3 w-3" /> Fehlt
        </Badge>
      )}
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onPreview}>
        <Eye className="h-3 w-3" /> Vorschau
      </Button>
    </div>
  );
}

function PreviewEmptyHint({ serviceId }: { serviceId: string }) {
  const { data: hasLayout, isLoading } = useServiceHasFormLayout(serviceId, "customer");
  if (isLoading || hasLayout) return null;
  return (
    <div className="border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
      <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-destructive" />
      Für diese Dienstleistung wurde noch kein Buchungsformular im Service Designer hinterlegt.<br />
      Auftraggeber sehen aktuell nur die klassischen Parameter (sofern vorhanden).
    </div>
  );
}




function useDurchfuehrerUsers() {
  return useQuery({
    queryKey: ["durchfuehrer-users"],
    queryFn: () => api.durchfuehrerUsers.list(),
  });
}


export default function AdminServicesPage() {
  const { t } = useTranslation(["admin", "common"]);
  const { data: services = [], isLoading } = useAllServices();
  const { data: users = [] } = useDurchfuehrerUsers();
  const { data: workstations = [] } = useWorkstations();
  const updateService = useUpdateService();
  const createService = useCreateService();
  const archiveService = useArchiveService();
  const unarchiveService = useUnarchiveService();
  const deleteService = useDeleteService();
  const { hasPermission } = usePermissions();
  const canViewRates = hasPermission("costs.view_hourly_rates");
  const canEditRates = hasPermission("costs.edit_hourly_rates");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>("labor");
  const [newRate, setNewRate] = useState("75");
  const [newResponsible, setNewResponsible] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [newWorkstation, setNewWorkstation] = useState<string>("");
  const [newDuration, setNewDuration] = useState("1");
  const [paramEditorServiceId, setParamEditorServiceId] = useState<string | null>(null);
  const [paramEditorServiceName, setParamEditorServiceName] = useState("");
  const [previewServiceId, setPreviewServiceId] = useState<string | null>(null);
  const [previewServiceName, setPreviewServiceName] = useState("");
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [editService, setEditService] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [formLinksService, setFormLinksService] = useState<any | null>(null);


  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateService.mutateAsync({ id, active });
      toast.success(active ? t("admin:activated") : t("admin:deactivated"));
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const handleRateUpdate = async (id: string) => {
    try {
      await updateService.mutateAsync({ id, hourly_rate: parseFloat(editRate) });
      toast.success(t("admin:rate_updated"));
      setEditId(null);
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const handleResponsibleChange = async (id: string, userId: string) => {
    try {
      await updateService.mutateAsync({ id, responsible_user_id: userId || null });
      toast.success(t("admin:responsible_assigned"));
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const handleWorkstationChange = async (id: string, workstationId: string) => {
    try {
      await updateService.mutateAsync({ id, workstation_id: workstationId || null });
      toast.success(t("admin:workstation_assigned"));
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const handleCreate = async () => {
    if (!newName) { toast.error(t("admin:name_required")); return; }
    try {
      await createService.mutateAsync({
        service_name: newName,
        category: newCategory,
        hourly_rate: parseFloat(newRate),
        responsible_user_id: newResponsible || null,
        workstation_id: newWorkstation || null,
        standard_duration_hours: parseFloat(newDuration),
      } as any);
      toast.success(t("admin:service_created"));
      setNewOpen(false);
      setNewName("");
      setNewRate("75");
      setNewDuration("1");
      setNewResponsible("");
      setNewWorkstation("");
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const visibleServices = showArchived ? services : services.filter((s: any) => !s.archived_at);
  const laborServices = visibleServices.filter(s => s.category === "labor");
  const pilotServices = visibleServices.filter(s => s.category === "pilot_plant");

  const serviceColumns: DataTableColumn<any>[] = [
    {
      key: "service_name",
      header: t("admin:service_name"),
      className: "font-medium",
      cell: (s) => (
        <div className="flex items-center gap-2">
          {s.service_name}
          {!!s.archived_at && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Archive className="h-3 w-3" /> Archiviert
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "workstation",
      header: t("admin:service_workstation"),
      accessor: (s) => workstations.find(w => w.id === s.workstation_id)?.name || "",
      cell: (s) => (
        <Select
          value={s.workstation_id || "none"}
          onValueChange={v => handleWorkstationChange(s.id, v === "none" ? "" : v)}
          disabled={!!s.archived_at}
        >
          <SelectTrigger className="w-44 h-8">
            <SelectValue placeholder={t("common:not_assigned")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common:not_assigned")}</SelectItem>
            {workstations.filter(w => w.status === "active").map(w => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "responsible",
      header: t("admin:service_responsible"),
      accessor: (s) => {
        const u = (users as any[]).find(u => u.user_id === s.responsible_user_id);
        return u ? `${u.first_name} ${u.last_name}` : "";
      },
      cell: (s) => (
        <Select
          value={s.responsible_user_id || "none"}
          onValueChange={v => handleResponsibleChange(s.id, v === "none" ? "" : v)}
          disabled={!!s.archived_at}
        >
          <SelectTrigger className="w-44 h-8">
            <SelectValue placeholder={t("common:not_assigned")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common:not_assigned")}</SelectItem>
            {(users as any[]).map((u: any) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.first_name} {u.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "standard_duration_hours",
      header: t("admin:service_duration"),
      type: "number",
      cell: (s) => (
        <DurationCell service={s} t={t} onUpdate={async (id, val) => {
          try {
            await updateService.mutateAsync({ id, standard_duration_hours: val } as any);
            toast.success(t("admin:duration_updated"));
          } catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
        }} />
      ),
    },
    ...(canViewRates ? [{
      key: "hourly_rate",
      header: t("admin:service_rate"),
      type: "number" as const,
      cell: (s: any) =>
        canEditRates && editId === s.id ? (
          <div className="flex gap-2">
            <Input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-24 h-8" />
            <Button size="sm" onClick={() => handleRateUpdate(s.id)}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>✕</Button>
          </div>
        ) : canEditRates ? (
          <button className="hover:underline text-left" onClick={() => { setEditId(s.id); setEditRate(String(s.hourly_rate)); }}>
            {s.hourly_rate} €/h
          </button>
        ) : (
          <span>{s.hourly_rate} €/h</span>
        ),
    }] : []),
    {
      key: "parameters",
      header: t("admin:service_parameters"),
      type: "custom",
      sortable: false,
      filterable: false,
      searchable: false,
      cell: (s) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setParamEditorServiceId(s.id);
              setParamEditorServiceName(s.service_name);
            }}
          >
            <Settings2 className="h-3 w-3" /> {t("admin:service_parameters")}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.location.assign(`/admin/prozess-designer`)}
          >
            <Settings2 className="h-3 w-3" /> Prozess-Designer
          </Button>
        </div>
      ),
    },
    {
      key: "booking_form",
      header: "Buchungsformular",
      type: "custom",
      sortable: false,
      filterable: false,
      searchable: false,
      cell: (s) => (
        <BookingFormStatusCell
          serviceId={s.id}
          onPreview={() => {
            setPreviewServiceId(s.id);
            setPreviewServiceName(s.service_name);
            setPreviewValues({});
          }}
        />
      ),
    },
    {
      key: "active",
      header: t("admin:service_status"),
      type: "boolean",
      accessor: (s) => !!s.active,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Switch checked={s.active} onCheckedChange={v => handleToggle(s.id, v)} disabled={!!s.archived_at} />
          <span className="text-sm">{s.active ? t("admin:active") : t("admin:inactive")}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      type: "custom",
      sortable: false,
      filterable: false,
      searchable: false,
      headClassName: "w-12",
      cell: (s) => {
        const archived = !!s.archived_at;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditService(s)}>
                <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFormLinksService(s)}>
                <FormInput className="h-4 w-4 mr-2" /> Formulare verknüpfen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggle(s.id, !s.active)} disabled={archived}>
                {s.active ? (
                  <><Settings2 className="h-4 w-4 mr-2" /> Deaktivieren</>
                ) : (
                  <><Settings2 className="h-4 w-4 mr-2" /> Aktivieren</>
                )}
              </DropdownMenuItem>
              {archived ? (
                <DropdownMenuItem onClick={async () => {
                  try { await unarchiveService.mutateAsync(s.id); toast.success("Dienstleistung wiederhergestellt"); }
                  catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
                }}>
                  <ArchiveRestore className="h-4 w-4 mr-2" /> Wiederherstellen
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={async () => {
                  try { await archiveService.mutateAsync(s.id); toast.success("Dienstleistung archiviert"); }
                  catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
                }}>
                  <Archive className="h-4 w-4 mr-2" /> Archivieren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(s)}>
                <Trash2 className="h-4 w-4 mr-2" /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const renderServiceTable = (title: string, items: typeof services, tableId: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId={tableId}
          columns={serviceColumns}
          rows={items as any[]}
          rowKey={(s: any) => s.id}
          emptyMessage="Keine Dienstleistungen gefunden."
          searchPlaceholder="Dienstleistung suchen …"
          defaultSort={{ key: "service_name", dir: "asc" }}
          rowClassName={(s: any) => (s.archived_at ? "opacity-60" : "")}
        />
      </CardContent>
    </Card>
  );



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin:services_title")}</h1>
          <p className="text-muted-foreground">{t("admin:services_subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showArchived} onCheckedChange={v => setShowArchived(!!v)} />
            Archivierte anzeigen
          </label>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />{t("admin:new_service")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("admin:new_service_title")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>{t("admin:service_name")}</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t("admin:service_name_placeholder")} /></div>
                <div>
                  <Label>{t("admin:service_category")}</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="labor">{t("common:category_labor")}</SelectItem>
                      <SelectItem value="pilot_plant">{t("common:category_pilot_plant")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("admin:service_responsible")}</Label>
                  <Select value={newResponsible || "none"} onValueChange={v => setNewResponsible(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("common:not_assigned")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common:not_assigned")}</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("admin:service_duration")}</Label><Input type="number" min={0.25} step={0.25} value={newDuration} onChange={e => setNewDuration(e.target.value)} /></div>
                {canViewRates && canEditRates && <div><Label>{t("admin:service_rate")}</Label><Input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} /></div>}
                <Button onClick={handleCreate}>{t("common:create")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="space-y-6">
          {renderServiceTable(t("common:category_labor"), laborServices, "admin-services-labor")}
          {renderServiceTable(t("common:category_pilot_plant"), pilotServices, "admin-services-pilot")}
        </div>
      )}

      <Dialog open={!!paramEditorServiceId} onOpenChange={(open) => { if (!open) setParamEditorServiceId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {paramEditorServiceId && (
            <ServiceParameterEditor
              serviceId={paramEditorServiceId}
              serviceName={paramEditorServiceName}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewServiceId} onOpenChange={(open) => { if (!open) setPreviewServiceId(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Vorschau als Auftraggeber · {previewServiceName}
            </DialogTitle>
          </DialogHeader>
          {previewServiceId && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Diese Ansicht zeigt das im Service Designer hinterlegte Buchungsformular für die Rolle „Auftraggeber". Eingaben werden nicht gespeichert.
              </p>
              <ServiceBookingForm
                serviceId={previewServiceId}
                roleView="customer"
                values={previewValues}
                onChange={(key, value) => setPreviewValues((p) => ({ ...p, [key]: value }))}
              />
              <PreviewEmptyHint serviceId={previewServiceId} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditServiceDialog
        service={editService}
        onClose={() => setEditService(null)}
        users={users}
        workstations={workstations}
        canEditRates={canViewRates && canEditRates}
        onSave={async (id, updates) => {
          try {
            await updateService.mutateAsync({ id, ...updates } as any);
            toast.success("Änderungen gespeichert");
            setEditService(null);
          } catch (err: any) {
            toast.error(t("common:error"), { description: err.message });
          }
        }}
      />

      <DeleteServiceDialog
        service={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onArchive={async (id) => {
          try { await archiveService.mutateAsync(id); toast.success("Dienstleistung archiviert"); setDeleteTarget(null); }
          catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
        }}
        onDelete={async (id) => {
          try {
            await deleteService.mutateAsync(id);
            toast.success("Dienstleistung gelöscht");
            setDeleteTarget(null);
          } catch (err: any) {
            toast.error("Löschen nicht möglich", { description: err.message });
          }
        }}
      />

      <ServiceFormLinksDialog
        service={formLinksService}
        onClose={() => setFormLinksService(null)}
      />
    </div>
  );
}

// ============================================================
// Edit dialog
// ============================================================
function EditServiceDialog({
  service, onClose, onSave, users, workstations, canEditRates,
}: {
  service: any | null;
  onClose: () => void;
  onSave: (id: string, updates: Record<string, any>) => Promise<void>;
  users: any[];
  workstations: any[];
  canEditRates: boolean;
}) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (service) {
      setForm({
        service_name: service.service_name ?? "",
        category: service.category ?? "labor",
        description: service.description ?? "",
        department: service.department ?? "",
        standard_duration_hours: service.standard_duration_hours ?? 1,
        hourly_rate: service.hourly_rate ?? 0,
        work_instructions: service.work_instructions ?? "",
        
        work_instructions: service.work_instructions ?? "",
        active: !!service.active,
      });
    }
  }, [service]);

  if (!service) return null;

  return (
    <Dialog open={!!service} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Dienstleistung bearbeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Änderungen gelten ausschließlich für zukünftige Aufträge. Bereits abgeschlossene Aufträge und Messergebnisse bleiben unverändert.
          </p>
          <div>
            <Label>Name</Label>
            <Input value={form.service_name} onChange={e => setForm((f: any) => ({ ...f, service_name: e.target.value }))} />
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Textarea value={form.description ?? ""} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="pilot_plant">Technikum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Abteilung</Label>
              <Input value={form.department ?? ""} onChange={e => setForm((f: any) => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <Label>Standarddauer (h)</Label>
              <Input type="number" min={0.25} step={0.25} value={form.standard_duration_hours} onChange={e => setForm((f: any) => ({ ...f, standard_duration_hours: parseFloat(e.target.value) }))} />
            </div>
            {canEditRates && (
              <div>
                <Label>Stundensatz (€/h)</Label>
                <Input type="number" value={form.hourly_rate} onChange={e => setForm((f: any) => ({ ...f, hourly_rate: parseFloat(e.target.value) }))} />
              </div>
            )}
          </div>
          <div>
            <Label>Arbeitsanweisung</Label>
            <Textarea value={form.work_instructions ?? ""} onChange={e => setForm((f: any) => ({ ...f, work_instructions: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(service.id, {
            service_name: form.service_name,
            category: form.category,
            description: form.description || null,
            department: form.department || null,
            standard_duration_hours: form.standard_duration_hours,
            ...(canEditRates ? { hourly_rate: form.hourly_rate } : {}),
            work_instructions: form.work_instructions || null,
          })}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Delete dialog with reference check
// ============================================================
function DeleteServiceDialog({
  service, onClose, onDelete, onArchive,
}: {
  service: any | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}) {
  const { data: refs, isLoading } = useServiceReferences(service?.id ?? null);
  if (!service) return null;

  const total = refs
    ? refs.order_measurements + refs.project_services + refs.template_items + refs.measurement_results
    : 0;
  const hasRefs = !isLoading && total > 0;

  return (
    <AlertDialog open={!!service} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" /> Dienstleistung löschen
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div>
                Möchten Sie die Dienstleistung <span className="font-medium">{service.service_name}</span> wirklich endgültig löschen?
              </div>

              {isLoading && <div className="text-xs text-muted-foreground">Referenzen werden geprüft…</div>}

              {!isLoading && !hasRefs && (
                <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <div>Keine Referenzen gefunden – die Dienstleistung kann endgültig gelöscht werden.</div>
                </div>
              )}

              {hasRefs && refs && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      Diese Dienstleistung wird bereits verwendet und kann daher nicht gelöscht werden.
                      Bitte archivieren oder deaktivieren Sie sie stattdessen.
                    </div>
                  </div>
                  <ul className="text-xs list-disc list-inside pl-1">
                    {refs.order_measurements > 0 && <li>{refs.order_measurements} Auftragsmessungen</li>}
                    {refs.project_services > 0 && <li>{refs.project_services} Projektzuordnungen</li>}
                    {refs.template_items > 0 && <li>{refs.template_items} Vorlagen-Einträge</li>}
                    {refs.measurement_results > 0 && <li>{refs.measurement_results} Messergebnisse</li>}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          {hasRefs ? (
            <AlertDialogAction onClick={() => onArchive(service.id)}>
              <Archive className="h-4 w-4 mr-2" /> Stattdessen archivieren
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(service.id)}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Endgültig löschen
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

