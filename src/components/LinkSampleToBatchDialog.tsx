import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mixtureBatchId: string;
  mixtureBatchNumber: string;
}

export function LinkSampleToBatchDialog({
  open,
  onOpenChange,
  mixtureBatchId,
  mixtureBatchNumber,
}: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ["unlinked_samples"],
    queryFn: () => api.batches.unlinkedSamples(),
    enabled: open,
  });

  const filtered = (samples as any[]).filter((s) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      s.sample_number?.toLowerCase().includes(q) ||
      s.sample_name?.toLowerCase().includes(q)
    );
  });

  const handleLink = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.batches.linkSampleToMixtureBatch(selected, mixtureBatchId);
      qc.invalidateQueries({ queryKey: ["unlinked_samples"] });
      qc.invalidateQueries({ queryKey: ["mixture_batch_samples", mixtureBatchId] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Probe mit Charge verknüpft");
      setSelected(null);
      setFilter("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Verknüpfung fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Bestehende Probe mit Charge {mixtureBatchNumber} verknüpfen
          </DialogTitle>
          <DialogDescription>
            Wähle eine noch nicht verknüpfte Probe aus, um sie nachträglich dieser
            Mischungscharge zuzuordnen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Suche</Label>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Probennummer oder Name…"
            />
          </div>
          <ScrollArea className="h-72 rounded-md border">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Lade…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Keine verfügbaren Proben.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((s: any) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(s.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        selected === s.id ? "bg-muted" : ""
                      }`}
                    >
                      <span className="font-mono">{s.sample_number}</span>
                      <span className="truncate text-muted-foreground">
                        {s.sample_name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleLink} disabled={!selected || submitting}>
            Verknüpfen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
