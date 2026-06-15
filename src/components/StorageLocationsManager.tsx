import { useMemo, useState } from "react";
import {
  useStorageLocations,
  useAddStorageLocation,
  useUpdateStorageLocation,
  useDeleteStorageLocation,
} from "@/hooks/useRawMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Search } from "lucide-react";

export interface StorageLocationsManagerProps {
  triggerLabel?: string;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  hall: string;
  room: string;
  shelf: string;
  position: string;
}

const emptyForm: FormState = { name: "", description: "", hall: "", room: "", shelf: "", position: "" };

export function StorageLocationsManager({ triggerLabel = "Lagerorte verwalten" }: StorageLocationsManagerProps) {
  const { data: locations, isLoading } = useStorageLocations();
  const addLoc = useAddStorageLocation();
  const updateLoc = useUpdateStorageLocation();
  const deleteLoc = useDeleteStorageLocation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations || [];
    return (locations || []).filter((l: any) =>
      [l.name, l.description, l.hall, l.room, l.shelf, l.position]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [locations, search]);

  const reset = () => {
    setForm(emptyForm);
    setEditing(false);
  };

  const startEdit = (l: any) => {
    setForm({
      id: l.id,
      name: l.name ?? "",
      description: l.description ?? "",
      hall: l.hall ?? "",
      room: l.room ?? "",
      shelf: l.shelf ?? "",
      position: l.position ?? "",
    });
    setEditing(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Bezeichnung ist erforderlich");
      return;
    }
    const dup = (locations || []).find(
      (l: any) => l.name?.toLowerCase() === name.toLowerCase() && l.id !== form.id
    );
    if (dup) {
      toast.error("Bezeichnung existiert bereits");
      return;
    }
    const payload = {
      name,
      description: form.description.trim() || undefined,
      hall: form.hall.trim() || undefined,
      room: form.room.trim() || undefined,
      shelf: form.shelf.trim() || undefined,
      position: form.position.trim() || undefined,
    };
    try {
      if (editing && form.id) {
        await updateLoc.mutateAsync({
          id: form.id,
          name,
          description: form.description.trim() || null as any,
          hall: payload.hall ?? null,
          room: payload.room ?? null,
          shelf: payload.shelf ?? null,
          position: payload.position ?? null,
        });
        toast.success("Lagerort aktualisiert");
      } else {
        await addLoc.mutateAsync(payload);
        toast.success("Lagerort erstellt");
      }
      reset();
    } catch (e: any) {
      toast.error("Fehler", { description: e.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteLoc.mutateAsync(id);
      toast.success(`Lagerort „${name}“ gelöscht`);
      if (form.id === id) reset();
    } catch (e: any) {
      toast.error("Löschen fehlgeschlagen", {
        description: e.message?.includes("foreign key")
          ? "Der Lagerort wird noch von Rohstoffen verwendet."
          : e.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { reset(); setSearch(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4 mr-1" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lagerorte verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="border rounded-md p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">
                {editing ? "Lagerort bearbeiten" : "Neuer Lagerort"}
              </h3>
              {editing && (
                <Button variant="ghost" size="sm" onClick={reset}>Abbrechen</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bezeichnung *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z. B. Halle 1 - Regal A"
                />
              </div>
              <div>
                <Label>Bereich / Halle</Label>
                <Input
                  value={form.hall}
                  onChange={(e) => setForm({ ...form, hall: e.target.value })}
                  placeholder="z. B. Halle 1"
                />
              </div>
              <div>
                <Label>Raum</Label>
                <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
              <div>
                <Label>Regal</Label>
                <Input value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} />
              </div>
              <div>
                <Label>Position</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Beschreibung</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={addLoc.isPending || updateLoc.isPending}>
                {editing ? <><Pencil className="h-4 w-4 mr-1" />Speichern</> : <><Plus className="h-4 w-4 mr-1" />Anlegen</>}
              </Button>
            </DialogFooter>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lagerorte suchen..."
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead>Geändert</TableHead>
                  <TableHead className="w-24 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Lädt...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Lagerorte gefunden</TableCell></TableRow>
                ) : (
                  filtered.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[l.hall, l.room, l.shelf, l.position].filter(Boolean).join(" › ") || "–"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{l.description || "–"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.created_at ? new Date(l.created_at).toLocaleDateString("de-AT") : "–"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.updated_at ? new Date(l.updated_at).toLocaleDateString("de-AT") : "–"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Lagerort löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Der Lagerort „{l.name}“ wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(l.id, l.name)}
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
