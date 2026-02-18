import { useState, useMemo } from "react";
import { useSamples, useCreateSample } from "@/hooks/useSamples";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SampleSelectorProps {
  value: string;
  onSelect: (sampleId: string) => void;
  projectId?: string;
}

export default function SampleSelector({ value, onSelect, projectId }: SampleSelectorProps) {
  const { data: samples = [] } = useSamples();
  const { data: projects = [] } = useProjects();
  const { user, role } = useAuth();
  const createSample = useCreateSample();

  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ sample_name: "", project_id: "", description: "" });

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  const filteredSamples = useMemo(() => {
    if (projectId) return samples.filter(s => s.project_id === projectId);
    return samples;
  }, [samples, projectId]);

  const selected = samples.find(s => s.id === value);

  const handleCreate = async () => {
    if (!form.sample_name.trim() || !form.project_id || !form.description.trim()) {
      toast.error("Alle Felder sind Pflichtfelder");
      return;
    }
    try {
      const newSample = await createSample.mutateAsync({
        sample_name: form.sample_name.trim(),
        project_id: form.project_id,
        description: form.description.trim(),
        created_by: user!.id,
      });
      toast.success("Probe erstellt");
      onSelect(newSample.id);
      setForm({ sample_name: "", project_id: "", description: "" });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Erstellen");
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {selected
              ? `${selected.sample_number} – ${selected.sample_name}`
              : "Probe auswählen..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Suche nach Probennr. oder Name..." />
            <CommandList>
              <CommandEmpty>Keine Proben gefunden.</CommandEmpty>
              <CommandGroup>
                {filteredSamples.map(s => {
                  const proj = (s as any).projects;
                  return (
                    <CommandItem
                      key={s.id}
                      value={`${s.sample_number} ${s.sample_name} ${proj?.project_number || ""}`}
                      onSelect={() => { onSelect(s.id); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="font-medium">{s.sample_number} – {s.sample_name}</span>
                        <span className="text-xs text-muted-foreground">Projekt: {proj?.project_number || "–"}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {canCreate && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setForm(f => ({ ...f, project_id: projectId || "" }));
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="font-medium">+ Neue Probe anlegen</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Probe erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Probenname *</Label>
              <Input value={form.sample_name} onChange={e => setForm(f => ({ ...f, sample_name: e.target.value }))} placeholder="Name der Probe" />
            </div>
            <div className="space-y-2">
              <Label>Projekt *</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Projekt auswählen" /></SelectTrigger>
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
    </>
  );
}
