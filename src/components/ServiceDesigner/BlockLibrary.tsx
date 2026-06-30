import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ServiceBlock, ServiceBlockKind } from "@/lib/api/serviceBlocks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers, Search } from "lucide-react";

const KIND_LABEL: Record<ServiceBlockKind, string> = {
  field_group: "Feldgruppe",
  document_snippet: "Dokument-Schnipsel",
  workflow_snippet: "Workflow-Baustein",
  rule_snippet: "Regel-Baustein",
};

export default function BlockLibrary({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["service-blocks", "all"],
    queryFn: () => api.serviceBlocks.list(),
  });

  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [editing, setEditing] = useState<ServiceBlock | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ServiceBlock | null>(null);

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    return blocks.filter((b) =>
      (kindFilter === "all" || b.kind === kindFilter) &&
      (!q || b.name.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [blocks, filter, kindFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceBlock[]>();
    for (const b of visible) {
      if (!map.has(b.category)) map.set(b.category, []);
      map.get(b.category)!.push(b);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const remove = useMutation({
    mutationFn: (id: string) => api.serviceBlocks.delete(id),
    onSuccess: () => {
      toast.success("Baustein gelöscht");
      qc.invalidateQueries({ queryKey: ["service-blocks"] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4" />Bausteinbibliothek</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Globale, wiederverwendbare Bausteine für Formulare, Dokumente, Workflows und Regeln.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> Neuer Baustein
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Suche Name, Beschreibung, Tag …"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground">Lade …</div>
          ) : grouped.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
              Noch keine Bausteine. {canManage && "Lege oben den ersten an."}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{cat}</h3>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((b) => (
                      <Card key={b.id} className="border">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{b.name}</div>
                              <Badge variant="outline" className="text-[10px] mt-1">{KIND_LABEL[b.kind]}</Badge>
                              {b.is_system && <Badge variant="secondary" className="text-[10px] ml-1">System</Badge>}
                            </div>
                            {canManage && (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                                {!b.is_system && (
                                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(b)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          {b.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                          )}
                          {b.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {b.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <BlockDialog
          block={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["service-blocks"] });
            setEditing(null); setCreating(false);
          }}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Baustein löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDelete?.name}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) remove.mutate(confirmDelete.id); setConfirmDelete(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BlockDialog({
  block, onClose, onSaved,
}: { block: ServiceBlock | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !block;
  const [form, setForm] = useState<Partial<ServiceBlock>>(
    block ?? {
      name: "",
      description: "",
      category: "Allgemein",
      kind: "document_snippet",
      content: { snippet: "" },
      tags: [],
    }
  );
  const [tagsInput, setTagsInput] = useState((block?.tags ?? []).join(", "));
  const [contentText, setContentText] = useState(
    JSON.stringify(block?.content ?? { snippet: "" }, null, 2)
  );

  const save = useMutation({
    mutationFn: async () => {
      let parsed: any;
      try { parsed = JSON.parse(contentText); }
      catch { throw new Error("Inhalt ist kein gültiges JSON."); }
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        name: form.name!.trim(),
        description: form.description ?? null,
        category: form.category || "Allgemein",
        kind: form.kind as ServiceBlockKind,
        content: parsed,
        tags,
      };
      if (isNew) await api.serviceBlocks.create(payload as any);
      else await api.serviceBlocks.update(block!.id, payload as any);
    },
    onSuccess: () => { toast.success(isNew ? "Baustein angelegt" : "Gespeichert"); onSaved(); },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Neuer Baustein" : "Baustein bearbeiten"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Typ</Label>
              <Select value={form.kind ?? "document_snippet"} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as ServiceBlockKind }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tags (komma-getrennt)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Beschreibung</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">
              Inhalt (JSON). Bei „Dokument-Schnipsel": <code>{`{ "snippet": "<h2>…</h2>" }`}</code>
            </Label>
            <Textarea rows={10} className="font-mono text-xs" value={contentText} onChange={(e) => setContentText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name?.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
