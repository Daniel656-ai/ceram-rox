import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Clock, Thermometer, Beaker } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProcessSections,
  useAddSection,
  useDeleteSection,
  useAddStep,
  useDeleteStep,
  useAddPlannedMeasurement,
  useDeletePlannedMeasurement,
} from "@/hooks/useMixtureProcess";
import { useRawMaterials } from "@/hooks/useMixtures";
import { StepTimePicker, StepTimeValue, defaultStepTime } from "@/components/StepTimePicker";
import { formatStepTime } from "@/lib/processTime";

interface Props {
  versionId: string;
  readOnly?: boolean;
}

export function ProcessEditor({ versionId, readOnly }: Props) {
  const { t } = useTranslation(["mixtures"]);
  const { data: sections = [] } = useProcessSections(versionId);
  const { data: rawMaterials = [] } = useRawMaterials();

  const addSection = useAddSection(versionId);
  const delSection = useDeleteSection(versionId);
  const addStep = useAddStep(versionId);
  const delStep = useDeleteStep(versionId);
  const addMeas = useAddPlannedMeasurement(versionId);
  const delMeas = useDeletePlannedMeasurement(versionId);

  const [secOpen, setSecOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [secDesc, setSecDesc] = useState("");
  const [secDuration, setSecDuration] = useState("");

  const handleAddSection = async () => {
    if (!secName.trim()) return;
    await addSection.mutateAsync({
      recipe_version_id: versionId,
      name: secName.trim(),
      description: secDesc.trim() || null,
      planned_duration_min: secDuration ? Number(secDuration) : null,
      target_temperature: null,
      sort_order: (sections as any[]).length,
    });
    setSecName(""); setSecDesc(""); setSecDuration("");
    setSecOpen(false);
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Dialog open={secOpen} onOpenChange={setSecOpen}>
            <Button size="sm" onClick={() => setSecOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Prozessabschnitt hinzufügen
            </Button>
            <DialogContent>
              <DialogHeader><DialogTitle>Prozessabschnitt</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="z.B. Vormischung" />
                </div>
                <div>
                  <Label>Beschreibung</Label>
                  <Textarea value={secDesc} onChange={(e) => setSecDesc(e.target.value)} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Geplante Dauer (min)</Label>
                    <Input type="number" value={secDuration} onChange={(e) => setSecDuration(e.target.value)} />
                  </div>
                  <div>
                    <Label>Soll-Temperatur (°C)</Label>
                    <Input type="number" step="0.1" value={secTemp} onChange={(e) => setSecTemp(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSecOpen(false)}>Abbrechen</Button>
                <Button onClick={handleAddSection}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {(sections as any[]).length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Noch keine Prozessabschnitte definiert.
        </Card>
      ) : (
        (sections as any[])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              index={idx}
              rawMaterials={rawMaterials as any[]}
              readOnly={readOnly}
              onDelete={() => delSection.mutate(section.id)}
              onAddStep={(s) => addStep.mutate(s)}
              onDelStep={(id) => delStep.mutate(id)}
              onAddMeas={(m) => addMeas.mutate(m)}
              onDelMeas={(id) => delMeas.mutate(id)}
            />
          ))
      )}
    </div>
  );
}

function SectionCard({
  section, index, rawMaterials, readOnly, onDelete, onAddStep, onDelStep, onAddMeas, onDelMeas,
}: any) {
  const [stepOpen, setStepOpen] = useState(false);
  const [stepMaterial, setStepMaterial] = useState("");
  const [stepQty, setStepQty] = useState("");
  const [stepUnit, setStepUnit] = useState("kg");
  const [stepInstr, setStepInstr] = useState("");
  const [stepTime, setStepTime] = useState<StepTimeValue>(defaultStepTime);

  const [measOpen, setMeasOpen] = useState(false);
  const [measName, setMeasName] = useState("");
  const [measUnit, setMeasUnit] = useState("");
  const [measTarget, setMeasTarget] = useState("");
  const [measTol, setMeasTol] = useState("");
  const [measTime, setMeasTime] = useState<StepTimeValue>(defaultStepTime);

  const submitStep = async () => {
    await onAddStep({
      section_id: section.id,
      raw_material_id: stepMaterial || null,
      planned_quantity: stepQty ? Number(stepQty) : null,
      unit: stepUnit || null,
      instruction: stepInstr.trim() || null,
      sort_order: (section.mixture_process_steps || []).length,
      ...stepTime,
    });
    setStepMaterial(""); setStepQty(""); setStepInstr(""); setStepTime(defaultStepTime);
    setStepOpen(false);
  };

  const submitMeas = async () => {
    if (!measName.trim()) return;
    await onAddMeas({
      section_id: section.id,
      parameter_name: measName.trim(),
      unit: measUnit || null,
      target_value: measTarget ? Number(measTarget) : null,
      tolerance: measTol ? Number(measTol) : null,
      sort_order: (section.mixture_planned_measurements || []).length,
      ...measTime,
    });
    setMeasName(""); setMeasUnit(""); setMeasTarget(""); setMeasTol(""); setMeasTime(defaultStepTime);
    setMeasOpen(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{index + 1}</Badge>
            <h3 className="font-semibold text-lg">{section.name}</h3>
          </div>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            {section.planned_duration_min != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {section.planned_duration_min} min
              </span>
            )}
            {section.target_temperature != null && (
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> {section.target_temperature} {section.target_unit || "°C"}
              </span>
            )}
          </div>
        </div>
        {!readOnly && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Zeitgesteuerte Zugaben & Schritte</h4>
          {!readOnly && (
            <Dialog open={stepOpen} onOpenChange={setStepOpen}>
              <Button variant="outline" size="sm" onClick={() => setStepOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Schritt
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Schritt / Zugabe</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Rohstoff (optional)</Label>
                    <Select value={stepMaterial} onValueChange={setStepMaterial}>
                      <SelectTrigger><SelectValue placeholder="Kein Rohstoff (nur Anweisung)" /></SelectTrigger>
                      <SelectContent>
                        {rawMaterials.map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.material_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Menge</Label>
                      <Input type="number" step="0.001" value={stepQty} onChange={(e) => setStepQty(e.target.value)} />
                    </div>
                    <div>
                      <Label>Einheit</Label>
                      <Input value={stepUnit} onChange={(e) => setStepUnit(e.target.value)} />
                    </div>
                  </div>
                  <StepTimePicker value={stepTime} onChange={setStepTime} />
                  <div>
                    <Label>Anweisung</Label>
                    <Textarea rows={2} value={stepInstr} onChange={(e) => setStepInstr(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStepOpen(false)}>Abbrechen</Button>
                  <Button onClick={submitStep}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {(section.mixture_process_steps || []).length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Keine Schritte</div>
        ) : (
          <ul className="space-y-1">
            {(section.mixture_process_steps || [])
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((step: any) => (
                <li key={step.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono">{formatStepTime(step)}</Badge>
                    {step.raw_materials ? (
                      <span>
                        <strong>{step.raw_materials.material_name}</strong>
                        {step.planned_quantity != null && (
                          <span className="ml-2 text-muted-foreground">
                            {step.planned_quantity} {step.unit}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="italic">{step.instruction || "—"}</span>
                    )}
                    {step.raw_materials && step.instruction && (
                      <span className="text-xs text-muted-foreground">· {step.instruction}</span>
                    )}
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelStep(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Beaker className="h-3 w-3" /> Geplante Messungen
          </h4>
          {!readOnly && (
            <Dialog open={measOpen} onOpenChange={setMeasOpen}>
              <Button variant="outline" size="sm" onClick={() => setMeasOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Messung
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Geplante Messung</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Parameter *</Label>
                    <Input value={measName} onChange={(e) => setMeasName(e.target.value)} placeholder="z.B. Temperatur, pH-Wert" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Einheit</Label>
                      <Input value={measUnit} onChange={(e) => setMeasUnit(e.target.value)} placeholder="°C, pH, %" />
                    </div>
                    <div>
                      <Label>Sollwert</Label>
                      <Input type="number" step="0.01" value={measTarget} onChange={(e) => setMeasTarget(e.target.value)} />
                    </div>
                    <div>
                      <Label>Toleranz (±)</Label>
                      <Input type="number" step="0.01" value={measTol} onChange={(e) => setMeasTol(e.target.value)} />
                    </div>
                  </div>
                  <StepTimePicker value={measTime} onChange={setMeasTime} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMeasOpen(false)}>Abbrechen</Button>
                  <Button onClick={submitMeas}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {(section.mixture_planned_measurements || []).length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Keine Messpunkte geplant</div>
        ) : (
          <ul className="space-y-1">
            {(section.mixture_planned_measurements || []).map((m: any) => (
              <li key={m.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono">{formatStepTime(m)}</Badge>
                  <strong>{m.parameter_name}</strong>
                  {m.target_value != null && (
                    <span className="text-muted-foreground">
                      Soll: {m.target_value}{m.tolerance != null && ` ± ${m.tolerance}`} {m.unit}
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelMeas(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
