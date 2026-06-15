import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mixtureBatchId: string;
  mixtureBatchNumber: string;
  mixtureName: string;
}

/** Creates a new sample linked to a mixture batch (full traceability). */
export function CreateSampleFromBatchDialog({
  open,
  onOpenChange,
  mixtureBatchId,
  mixtureBatchNumber,
  mixtureName,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setProjectId("__none__");
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    if (projectId === "__none__") {
      toast.error("Bitte ein Projekt auswählen");
      return;
    }
    setSubmitting(true);
    try {
      const sample = await api.samples.create({
        sample_name: name.trim(),
        description:
          description.trim() ||
          `Aus Herstellungscharge ${mixtureBatchNumber} (${mixtureName})`,
        project_id: projectId,
        mixture_batch_id: mixtureBatchId,
        created_by: user.id,
        status: "neu",
      });
      qc.invalidateQueries({ queryKey: ["mixture_batch_samples", mixtureBatchId] });
      qc.invalidateQueries({ queryKey: ["samples"] });
      toast.success("Probe erstellt");
      reset();
      onOpenChange(false);
      navigate(`/proben/${sample.id}`);
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Erstellen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Probe aus Charge {mixtureBatchNumber} erzeugen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Probenbezeichnung *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Projekt (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Projekt</SelectItem>
                {(projects as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_number} · {p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={`Aus Herstellungscharge ${mixtureBatchNumber}`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Die Probe wird automatisch mit der Charge, der Rezeptur und allen
            verwendeten Rohstoffchargen verknüpft.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
            Probe erzeugen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
