import { useSamples, useCreateSample, useDeleteSample } from "@/hooks/useSamples";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SamplesPage() {
  const { data: samples = [], isLoading } = useSamples();
  const { data: projects = [] } = useProjects();
  const { user, role } = useAuth();
  const createSample = useCreateSample();
  const deleteSample = useDeleteSample();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sample_name: "", project_id: "", description: "" });

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  const filtered = samples.filter(s =>
    !search ||
    s.sample_number.toLowerCase().includes(search.toLowerCase()) ||
    s.sample_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.sample_name.trim() || !form.project_id || !form.description.trim()) {
      toast.error("Alle Felder sind Pflichtfelder");
      return;
    }
    try {
      await createSample.mutateAsync({
        sample_name: form.sample_name.trim(),
        project_id: form.project_id,
        description: form.description.trim(),
        created_by: user!.id,
      });
      toast.success("Probe erstellt");
      setForm({ sample_name: "", project_id: "", description: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proben</h1>
          <p className="text-muted-foreground">Übersicht aller Proben</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Neue Probe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Probe erstellen</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Probenname *</Label>
                  <Input value={form.sample_name} onChange={e => setForm(f => ({ ...f, sample_name: e.target.value }))} placeholder="Name der Probe" />
                </div>
                <div className="space-y-2">
                  <Label>Projektnummer *</Label>
                  <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Projekt auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung *</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Beschreibung der Probe" rows={3} />
                </div>
                <p className="text-xs text-muted-foreground">Die Probennummer wird automatisch vergeben.</p>
                <Button className="w-full" onClick={handleCreate} disabled={createSample.isPending}>
                  {createSample.isPending ? "Erstelle…" : "Probe erstellen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Probennummer oder Name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proben-Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Erstellt</TableHead>
                {canCreate && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Proben gefunden</TableCell></TableRow>
              ) : (
                filtered.map(s => {
                  const project = (s as any).projects;
                  const canDelete = role === "master" || s.created_by === user?.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sample_number}</TableCell>
                      <TableCell>{s.sample_name}</TableCell>
                      <TableCell>{project?.project_number || "–"}</TableCell>
                      <TableCell className="max-w-xs truncate">{s.description}</TableCell>
                      <TableCell>{new Date(s.created_at).toLocaleDateString("de-DE")}</TableCell>
                      {canCreate && (
                        <TableCell>
                          {canDelete ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Probe löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Probe „{s.sample_number}" wird unwiderruflich gelöscht.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        await deleteSample.mutateAsync(s.id);
                                        toast.success("Probe gelöscht");
                                      } catch (e: any) {
                                        toast.error(e.message || "Fehler beim Löschen");
                                      }
                                    }}
                                  >
                                    Löschen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
