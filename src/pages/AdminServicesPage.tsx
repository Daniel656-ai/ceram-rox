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
import { Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ServiceParameterEditor from "@/components/ServiceParameterEditor";

function DurationCell({ service, onUpdate }: { service: any; onUpdate: (id: string, val: number) => void }) {
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
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      const durchfuehrerIds = new Set(
        (rolesRes.data || [])
          .filter((r: any) => r.role === "durchfuehrer" || r.role === "master")
          .map((r: any) => r.user_id)
      );
      return (profilesRes.data || []).filter((p: any) => durchfuehrerIds.has(p.user_id));
    },
  });
}

export default function AdminServicesPage() {
  const { data: services = [], isLoading } = useAllServices();
  const { data: users = [] } = useDurchfuehrerUsers();
  const { data: workstations = [] } = useWorkstations();
  const updateService = useUpdateService();
  const createService = useCreateService();
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
      toast.success(active ? "Aktiviert" : "Deaktiviert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleRateUpdate = async (id: string) => {
    try {
      await updateService.mutateAsync({ id, hourly_rate: parseFloat(editRate) });
      toast.success("Stundensatz aktualisiert");
      setEditId(null);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleResponsibleChange = async (id: string, userId: string) => {
    try {
      await updateService.mutateAsync({ id, responsible_user_id: userId || null });
      toast.success("Messdienstleister zugeordnet");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleWorkstationChange = async (id: string, workstationId: string) => {
    try {
      await updateService.mutateAsync({ id, workstation_id: workstationId || null });
      toast.success("Arbeitsplatz zugeordnet");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleCreate = async () => {
    if (!newName) { toast.error("Name erforderlich"); return; }
    try {
      await createService.mutateAsync({
        service_name: newName,
        category: newCategory,
        hourly_rate: parseFloat(newRate),
        responsible_user_id: newResponsible || null,
        workstation_id: newWorkstation || null,
        standard_duration_hours: parseFloat(newDuration),
      } as any);
      toast.success("Messung erstellt");
      setNewOpen(false);
      setNewName("");
      setNewRate("75");
      setNewDuration("1");
      setNewResponsible("");
      setNewWorkstation("");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
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
              <TableHead>Name</TableHead>
              <TableHead>Arbeitsplatz</TableHead>
              <TableHead>Messdienstleister</TableHead>
              <TableHead>Standarddauer (h)</TableHead>
              <TableHead>Stundensatz (€/h)</TableHead>
              <TableHead>Parameter</TableHead>
              <TableHead>Status</TableHead>
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
                      <SelectValue placeholder="Nicht zugeordnet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugeordnet</SelectItem>
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
                      <SelectValue placeholder="Nicht zugeordnet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugeordnet</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <DurationCell service={s} onUpdate={async (id, val) => {
                    try {
                      await updateService.mutateAsync({ id, standard_duration_hours: val } as any);
                      toast.success("Standarddauer aktualisiert");
                    } catch (err: any) { toast.error("Fehler", { description: err.message }); }
                  }} />
                </TableCell>
                <TableCell>
                  {editId === s.id ? (
                    <div className="flex gap-2">
                      <Input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-24 h-8" />
                      <Button size="sm" onClick={() => handleRateUpdate(s.id)}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>✕</Button>
                    </div>
                  ) : (
                    <button className="hover:underline text-left" onClick={() => { setEditId(s.id); setEditRate(String(s.hourly_rate)); }}>
                      {s.hourly_rate} €/h
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setParamEditorServiceId(s.id);
                      setParamEditorServiceName(s.service_name);
                    }}
                  >
                    <Settings2 className="h-3 w-3" /> Parameter
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.active} onCheckedChange={v => handleToggle(s.id, v)} />
                    <span className="text-sm">{s.active ? "Aktiv" : "Inaktiv"}</span>
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
          <h1 className="text-2xl font-bold tracking-tight">Messungen</h1>
          <p className="text-muted-foreground">Verwaltung der Messdienstleistungen, Stundensätze und Parameterdefinitionen</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Neue Messung</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Messdienstleistung</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Viskosimetrie" /></div>
              <div>
                <Label>Kategorie</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="pilot_plant">Pilot Plant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Messdienstleister</Label>
                <Select value={newResponsible || "none"} onValueChange={v => setNewResponsible(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nicht zugeordnet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht zugeordnet</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Standarddauer (h)</Label><Input type="number" min={0.25} step={0.25} value={newDuration} onChange={e => setNewDuration(e.target.value)} /></div>
              <div><Label>Stundensatz (€/h)</Label><Input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} /></div>
              <Button onClick={handleCreate}>Erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="space-y-6">
          {renderServiceTable("Labor", laborServices)}
          {renderServiceTable("Pilot Plant", pilotServices)}
        </div>
      )}

      {/* Parameter Editor Dialog */}
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
