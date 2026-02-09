import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { user, role } = useAuth();
  const createProject = useCreateProject();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_number: "", project_name: "", description: "" });

  const filtered = projects.filter(p =>
    !search || p.project_number.toLowerCase().includes(search.toLowerCase()) || p.project_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.project_number.trim()) {
      toast.error("Projektnummer ist erforderlich");
      return;
    }
    try {
      await createProject.mutateAsync({
        project_number: form.project_number.trim(),
        project_name: form.project_name.trim() || undefined,
        description: form.description.trim() || undefined,
        created_by: user!.id,
      });
      toast.success("Projekt erstellt");
      setForm({ project_number: "", project_name: "", description: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground">Übersicht aller Projekte</p>
        </div>
        {role === "master" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Neues Projekt</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Projekt erstellen</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Projektnummer *</Label>
                  <Input value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))} placeholder="z. B. P-2026-001" />
                </div>
                <div className="space-y-2">
                  <Label>Projektname</Label>
                  <Input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" rows={3} />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createProject.isPending}>
                  {createProject.isPending ? "Erstelle…" : "Projekt erstellen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Projektnummer oder Name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt-Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Erstellt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine Projekte gefunden</TableCell></TableRow>
              ) : (
                filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.project_number}</TableCell>
                    <TableCell>{p.project_name || "–"}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.description || "–"}</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString("de-DE")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
