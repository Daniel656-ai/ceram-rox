import { useTranslation } from "react-i18next";
import { useAllServices, useUpdateService, useCreateService } from "@/hooks/useMeasurements";
import { useWorkstations } from "@/hooks/useWorkstations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings2, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ServiceParameterEditor from "@/components/ServiceParameterEditor";
import ServiceBookingForm, { useServiceHasFormLayout } from "@/components/ServiceBookingForm";
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

  const laborServices = services.filter(s => s.category === "labor");
  const pilotServices = services.filter(s => s.category === "pilot_plant");

  const renderServiceTable = (title: string, items: typeof services) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin:service_name")}</TableHead>
              <TableHead>{t("admin:service_workstation")}</TableHead>
              <TableHead>{t("admin:service_responsible")}</TableHead>
              <TableHead>{t("admin:service_duration")}</TableHead>
              {canViewRates && <TableHead>{t("admin:service_rate")}</TableHead>}
              <TableHead>{t("admin:service_parameters")}</TableHead>
              <TableHead>{t("admin:service_status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.service_name}</TableCell>
                <TableCell>
                  <Select
                    value={(s as any).workstation_id || "none"}
                    onValueChange={v => handleWorkstationChange(s.id, v === "none" ? "" : v)}
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
                </TableCell>
                <TableCell>
                  <Select
                    value={(s as any).responsible_user_id || "none"}
                    onValueChange={v => handleResponsibleChange(s.id, v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="w-44 h-8">
                      <SelectValue placeholder={t("common:not_assigned")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common:not_assigned")}</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <DurationCell service={s} t={t} onUpdate={async (id, val) => {
                    try {
                      await updateService.mutateAsync({ id, standard_duration_hours: val } as any);
                      toast.success(t("admin:duration_updated"));
                    } catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
                  }} />
                </TableCell>
                {canViewRates && (
                <TableCell>
                  {canEditRates && editId === s.id ? (
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
                  )}
                </TableCell>
                )}
                <TableCell>
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
                      onClick={() => window.location.assign(`/admin/messdienstleistungen/${s.id}/designer`)}
                    >
                      <Settings2 className="h-3 w-3" /> Designer
                    </Button>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.active} onCheckedChange={v => handleToggle(s.id, v)} />
                    <span className="text-sm">{s.active ? t("admin:active") : t("admin:inactive")}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="space-y-6">
          {renderServiceTable(t("common:category_labor"), laborServices)}
          {renderServiceTable(t("common:category_pilot_plant"), pilotServices)}
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
    </div>
  );
}
