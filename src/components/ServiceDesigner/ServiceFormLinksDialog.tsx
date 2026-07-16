import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, FormInput, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  service: { id: string; service_name: string } | null;
  onClose: () => void;
}

/**
 * Verknüpft ein oder mehrere Formulare aus der Formularbibliothek mit einer Dienstleistung.
 * Erzeugt bzw. löscht Zeilen in `service_form_links`. Es werden keine Formulare gelöscht.
 */
export default function ServiceFormLinksDialog({ service, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!service;

  const { data: allForms = [] } = useQuery({
    queryKey: ["form-definitions"],
    queryFn: () => api.formDefinitions.list(),
    enabled: open,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["service-form-links", service?.id],
    queryFn: () => api.serviceFormLinks.listForService(service!.id),
    enabled: open,
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    setOrderedIds(links.map((l) => l.form_definition_id));
  }, [links, service?.id]);

  const [search, setSearch] = useState("");
  const unusedForms = useMemo(
    () =>
      allForms.filter(
        (f) =>
          !orderedIds.includes(f.id) &&
          (!search || f.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [allForms, orderedIds, search]
  );

  const linkedForms = useMemo(
    () =>
      orderedIds
        .map((id) => allForms.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => !!f),
    [orderedIds, allForms]
  );

  const dirty =
    orderedIds.length !== links.length ||
    orderedIds.some((id, i) => links[i]?.form_definition_id !== id);

  const save = useMutation({
    mutationFn: () => api.serviceFormLinks.setForService(service!.id, orderedIds),
    onSuccess: () => {
      toast.success("Formulare zugeordnet");
      qc.invalidateQueries({ queryKey: ["service-form-links", service!.id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[idx], next[t]] = [next[t], next[idx]];
    setOrderedIds(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FormInput className="h-4 w-4" /> Formulare · {service?.service_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium mb-2">Verfügbare Formulare</div>
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 h-8"
            />
            <ScrollArea className="h-72 border rounded-md p-2">
              {unusedForms.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Keine weiteren Formulare verfügbar.</p>
              )}
              {unusedForms.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={(v) => v && setOrderedIds((prev) => [...prev, f.id])}
                  />
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <Badge variant="outline" className="text-[10px]">v{f.version}</Badge>
                </label>
              ))}
            </ScrollArea>
          </div>

          <div>
            <div className="text-xs font-medium mb-2">
              Zugeordnete Formulare · Reihenfolge <span className="text-muted-foreground">({orderedIds.length})</span>
            </div>
            <ScrollArea className="h-[336px] border rounded-md p-2">
              {linkedForms.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">
                  Noch keine Formulare zugeordnet.
                </p>
              )}
              {linkedForms.map((f, i) => (
                <div key={f.id} className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={i === linkedForms.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setOrderedIds((prev) => prev.filter((id) => id !== f.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
