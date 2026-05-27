import { useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle2, FlaskConical } from "lucide-react";

export default function BulkSamplePage() {
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();

  const [projectId, setProjectId] = useState("");
  const [prefix, setPrefix] = useState("Probe_");
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(10);
  const [description, setDescription] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const count = Math.max(0, endNum - startNum + 1);
  const padLength = Math.max(3, String(endNum).length);

  const previewNames = Array.from({ length: Math.min(count, 5) }, (_, i) =>
    `${prefix}${String(startNum + i).padStart(padLength, "0")}`
  );

  const handleCreate = async () => {
    if (!projectId || !prefix.trim() || count <= 0) {
      toast.error("Bitte Projekt, Präfix und gültigen Nummernbereich angeben");
      return;
    }
    if (count > 200) {
      toast.error("Maximal 200 Proben gleichzeitig");
      return;
    }

    setIsCreating(true);
    try {
      const group = groupName || `bulk_${Date.now()}`;
      const samples = Array.from({ length: count }, (_, i) => ({
        sample_name: `${prefix}${String(startNum + i).padStart(padLength, "0")}`,
        sample_number: "WILL_BE_OVERWRITTEN",
        project_id: projectId,
        description: description || `Serienprobe ${prefix}`,
        created_by: user!.id,
        sample_group: group,
        hazard_categories: [],
      }));

      const total = await api.samples.bulkInsert(samples);

      setCreatedCount(total);
      toast.success(`${total} Proben erstellt`);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (createdCount !== null) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">{createdCount} Proben erstellt!</h2>
            <p className="text-muted-foreground mb-4">
              Die Proben wurden erfolgreich im Projekt angelegt.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setCreatedCount(null)}>
                Weitere Proben erstellen
              </Button>
              <Button onClick={() => window.location.href = "/proben"}>
                Zur Probenübersicht
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Serien-Probenerstellung</h1>
        <p className="text-muted-foreground">Erstelle mehrere Proben gleichzeitig mit fortlaufender Nummerierung</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Konfiguration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Projekt *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                <SelectContent>
                  {(projects as any[]).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number} – {p.project_name || "–"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Namenspräfix *</Label>
              <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="z.B. Probe_" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Startnummer</Label>
                <Input type="number" min={1} value={startNum} onChange={e => setStartNum(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Endnummer</Label>
                <Input type="number" min={startNum} value={endNum} onChange={e => setEndNum(parseInt(e.target.value) || startNum)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gruppenname</Label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Optional – für spätere Filterung" />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Gemeinsame Beschreibung für alle Proben" rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vorschau</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm font-medium">{count} Proben werden erstellt:</p>
              <div className="bg-muted rounded-md p-3 font-mono text-sm space-y-1">
                {previewNames.map(n => (
                  <div key={n} className="flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                    {n}
                  </div>
                ))}
                {count > 5 && (
                  <div className="text-muted-foreground">… und {count - 5} weitere</div>
                )}
              </div>
            </div>

            <Button className="w-full mt-6" size="lg" onClick={handleCreate} disabled={isCreating || count <= 0 || !projectId}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "Erstelle…" : `${count} Proben erstellen`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
