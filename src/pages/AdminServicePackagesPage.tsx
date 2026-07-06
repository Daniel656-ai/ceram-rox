import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, ArrowUp, ArrowDown, Layers, Package as PackageIcon,
} from "lucide-react";

export default function AdminServicePackagesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canManage = role === "master" || hasPermission("services.manage" as any);

  const [showInactive, setShowInactive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string }>({ name: "", description: "" });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["service-packages", showInactive],
    queryFn: () => api.servicePackages.listWithItems({ includeInactive: showInactive }),
  });

  const { data: services = [] } = useQuery({
    queryKey: ["measurement-services", "all-active-for-packages"],
    queryFn: () => api.measurementServices.listActive(),
  });

  const activeServices = useMemo(
    () => services.filter((s: any) => !s.archived_at && s.is_active !== false),
    [services]
  );

  const createPkg = useMutation({
    mutationFn: () =>
      api.servicePackages.create({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        created_by: user?.id ?? null,
      }),
    onSuccess: () => {
      toast.success("Servicepaket angelegt");
      setCreateOpen(false);
      setDraft({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["service-packages"] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler beim Anlegen"),
  });

  const updatePkg = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => api.servicePackages.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages"] }),
    onError: (e: any) => toast.error(e?.message || "Fehler beim Speichern"),
  });

  const deletePkg = useMutation({
    mutationFn: (id: string) => api.servicePackages.delete(id),
    onSuccess: () => {
      toast.success("Servicepaket gelöscht");
      qc.invalidateQueries({ queryKey: ["service-packages"] });
    },
    onError: (e: any) => toast.error(e?.message || "Löschen fehlgeschlagen"),
  });

  const addItem = useMutation({
    mutationFn: ({ packageId, serviceId, sortOrder }: { packageId: string; serviceId: string; sortOrder: number }) =>
      api.servicePackages.addItem(packageId, serviceId, sortOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages"] }),
    onError: (e: any) => toast.error(e?.message || "Dienstleistung konnte nicht hinzugefügt werden (evtl. bereits im Paket)"),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.servicePackages.removeItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages"] }),
  });

  const reorderItems = useMutation({
    mutationFn: (orders: Array<{ id: string; sort_order: number }>) => api.servicePackages.reorderItems(orders),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-packages"] }),
  });

  const editing = packages.find((p) => p.id === editingId) || null;

  return (
    <div className="p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="h-6 w-6" /> Servicepakete
          </h1>
          <p className="text-sm text-muted-foreground">
            Bündele häufig gemeinsam beauftragte Dienstleistungen zu Prüfprogrammen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive">Inaktive anzeigen</Label>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={!canManage}>
            <Plus className="h-4 w-4 mr-1" /> Neues Paket
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade Servicepakete …</CardContent></Card>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <PackageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Noch keine Servicepakete definiert.</p>
            {canManage && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Erstes Paket anlegen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map((p) => (
            <Card key={p.id} className={p.is_active ? "" : "opacity-70"}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {p.name}
                    {!p.is_active && <Badge variant="outline">inaktiv</Badge>}
                  </CardTitle>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(p.id)} disabled={!canManage}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Paket "${p.name}" wirklich löschen? Bestehende Aufträge bleiben erhalten.`)) {
                        deletePkg.mutate(p.id);
                      }
                    }}
                    disabled={!canManage}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {p.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Keine Dienstleistungen</span>
                  ) : (
                    p.items.map((it) => (
                      <Badge key={it.id} variant="secondary" className="font-normal">
                        {it.measurement_services?.service_name ?? "—"}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={(v) => updatePkg.mutate({ id: p.id, patch: { is_active: v } })}
                      disabled={!canManage}
                    />
                    <span>{p.is_active ? "Aktiv" : "Inaktiv"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(p.id)}>
                    Inhalt bearbeiten
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Servicepaket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createPkg.mutate()} disabled={!draft.name.trim() || createPkg.isPending}>
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.name} bearbeiten</DialogTitle>
          </DialogHeader>
          {editing && (
            <PackageEditor
              pkg={editing}
              activeServices={activeServices}
              canManage={canManage}
              onUpdate={(patch) => updatePkg.mutate({ id: editing.id, patch })}
              onAddService={(serviceId) =>
                addItem.mutate({
                  packageId: editing.id,
                  serviceId,
                  sortOrder: (editing.items.at(-1)?.sort_order ?? -1) + 1,
                })
              }
              onRemoveItem={(itemId) => removeItem.mutate(itemId)}
              onMove={(idx, dir) => {
                const arr = [...editing.items];
                const j = idx + dir;
                if (j < 0 || j >= arr.length) return;
                [arr[idx], arr[j]] = [arr[j], arr[idx]];
                reorderItems.mutate(arr.map((it, i) => ({ id: it.id, sort_order: i })));
              }}
            />
          )}
          <DialogFooter>
            <Button onClick={() => setEditingId(null)}>Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageEditor({
  pkg,
  activeServices,
  canManage,
  onUpdate,
  onAddService,
  onRemoveItem,
  onMove,
}: {
  pkg: any;
  activeServices: any[];
  canManage: boolean;
  onUpdate: (patch: any) => void;
  onAddService: (serviceId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
}) {
  const [name, setName] = useState(pkg.name);
  const [description, setDescription] = useState(pkg.description ?? "");
  const usedServiceIds = new Set((pkg.items ?? []).map((it: any) => it.service_id));
  const addable = activeServices.filter((s) => !usedServiceIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== pkg.name && onUpdate({ name })}
            disabled={!canManage}
          />
        </div>
        <div>
          <Label>Sortierung</Label>
          <Input
            type="number"
            defaultValue={pkg.sort_order}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10) || 0;
              if (v !== pkg.sort_order) onUpdate({ sort_order: v });
            }}
            disabled={!canManage}
          />
        </div>
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => (description ?? "") !== (pkg.description ?? "") && onUpdate({ description: description || null })}
          disabled={!canManage}
          rows={2}
        />
      </div>

      <div>
        <Label>Dienstleistung hinzufügen</Label>
        <Select onValueChange={(v) => v && onAddService(v)} disabled={!canManage || addable.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={addable.length ? "Dienstleistung auswählen …" : "Alle verfügbaren bereits enthalten"} />
          </SelectTrigger>
          <SelectContent>
            {addable.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.service_name}
                {s.category ? ` · ${s.category}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Dienstleistung</TableHead>
              <TableHead className="w-32">Kategorie</TableHead>
              <TableHead className="w-32 text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pkg.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  Noch keine Dienstleistungen zugeordnet.
                </TableCell>
              </TableRow>
            ) : (
              pkg.items.map((it: any, idx: number) => (
                <TableRow key={it.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    {it.measurement_services?.service_name ?? "—"}
                    {it.measurement_services?.archived_at && (
                      <Badge variant="outline" className="ml-2">archiviert</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.measurement_services?.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => onMove(idx, -1)} disabled={!canManage || idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onMove(idx, 1)} disabled={!canManage || idx === pkg.items.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onRemoveItem(it.id)} disabled={!canManage}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
