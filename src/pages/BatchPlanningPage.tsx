import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTemplates, useApplyTemplate } from "@/hooks/useTemplates";
import { useProjects } from "@/hooks/useProjects";
import { useSamples } from "@/hooks/useSamples";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Zap, CheckCircle2 } from "lucide-react";

export default function BatchPlanningPage() {
  const { user } = useAuth();
  const { data: templates = [] } = useTemplates();
  const { data: projects = [] } = useProjects();
  const { data: allSamples = [] } = useSamples();
  const applyTemplate = useApplyTemplate();

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [orderType, setOrderType] = useState("customer");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [result, setResult] = useState<string[] | null>(null);

  const projectSamples = useMemo(() =>
    (allSamples as any[]).filter(s => s.project_id === selectedProjectId),
    [allSamples, selectedProjectId]
  );

  const selectedTemplate = (templates as any[]).find(t => t.id === selectedTemplateId);
  const templateItemCount = selectedTemplate?.measurement_template_items?.length || 0;
  const totalMeasurements = templateItemCount * selectedSampleIds.length;

  const toggleSample = (id: string) => {
    setSelectedSampleIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllSamples = () => {
    setSelectedSampleIds(projectSamples.map(s => s.id));
  };

  const handleApply = async () => {
    if (!selectedTemplateId || !selectedProjectId || selectedSampleIds.length === 0) {
      toast.error("Bitte Template, Projekt und mindestens eine Probe auswählen");
      return;
    }
    try {
      const orderIds = await applyTemplate.mutateAsync({
        templateId: selectedTemplateId,
        projectId: selectedProjectId,
        sampleIds: selectedSampleIds,
        createdBy: user!.id,
        orderType,
        priority,
        dueDate: dueDate || undefined,
      });
      setResult(orderIds);
      toast.success(`${orderIds.length} Auftrag/Aufträge mit ${totalMeasurements} Messungen erstellt`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Batch-Planung abgeschlossen!</h2>
            <p className="text-muted-foreground mb-4">
              {result.length} Auftrag/Aufträge mit insgesamt {totalMeasurements} Messungen wurden erstellt.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { setResult(null); setSelectedSampleIds([]); }}>
                Weitere Batch-Planung
              </Button>
              <Button onClick={() => window.location.href = "/auftraege"}>
                Zu den Aufträgen
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
        <h1 className="text-2xl font-bold text-foreground">Batch-Messplanung</h1>
        <p className="text-muted-foreground">Template auf mehrere Proben anwenden – Messungen werden automatisch erstellt</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Configuration */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Template & Konfiguration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template *</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Template wählen" /></SelectTrigger>
                  <SelectContent>
                    {(templates as any[]).map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({(t.measurement_template_items || []).length} Messungen)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedTemplate.measurement_template_items || []).map((item: any) => (
                      <Badge key={item.id} variant="outline" className="text-xs">
                        {item.measurement_services?.service_name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Projekt *</Label>
                <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedSampleIds([]); }}>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Auftragstyp</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Kunde</SelectItem>
                      <SelectItem value="production">Produktion</SelectItem>
                      <SelectItem value="rnd">F&E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="wichtig">Wichtig</SelectItem>
                      <SelectItem value="hoechste">Höchste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fällig</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Sample selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">2. Proben auswählen</CardTitle>
                {projectSamples.length > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAllSamples}>
                    Alle auswählen ({projectSamples.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedProjectId ? (
                <p className="text-sm text-muted-foreground">Bitte zuerst ein Projekt wählen</p>
              ) : projectSamples.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Proben in diesem Projekt</p>
              ) : (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {projectSamples.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                      <Checkbox
                        checked={selectedSampleIds.includes(s.id)}
                        onCheckedChange={() => toggleSample(s.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{s.sample_number}</span>
                        <span className="text-sm text-muted-foreground ml-2">{s.sample_name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary & Execute */}
      {selectedTemplateId && selectedSampleIds.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {selectedSampleIds.length} Probe(n) × {templateItemCount} Messung(en) = <strong>{totalMeasurements} Messungen</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Es werden {selectedSampleIds.length} Auftrag/Aufträge erstellt, jeweils mit {templateItemCount} Messungen.
                </p>
              </div>
              <Button size="lg" onClick={handleApply} disabled={applyTemplate.isPending}>
                <Zap className="h-4 w-4 mr-2" />
                {applyTemplate.isPending ? "Erstelle…" : "Batch ausführen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
