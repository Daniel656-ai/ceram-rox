import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, FlaskConical, Beaker } from "lucide-react";
import { toast } from "sonner";
import DynamicParameterForm from "@/components/DynamicParameterForm";
import ResultParameterEntry from "@/components/ResultParameterEntry";

interface MeasurementDataEntryProps {
  measurement: any;
  sampleInfo?: { sample_number?: string; sample_name?: string };
  projectInfo?: { project_number?: string; project_name?: string };
}

export default function MeasurementDataEntry({ measurement, sampleInfo, projectInfo }: MeasurementDataEntryProps) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "master" || (role === "durchfuehrer" && measurement.assigned_to === user?.id);

  const [isOpen, setIsOpen] = useState(false);

  // Parameter editing (legacy manual)
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [paramForm, setParamForm] = useState({ parameter_name: "", parameter_value: "", unit: "" });
  const [addingParam, setAddingParam] = useState(false);

  const parameters = measurement.measurement_parameters || [];
  const results = measurement.measurement_results || [];
  const serviceId = measurement.service_id;

  // --- Parameter CRUD (legacy manual) ---
  const handleSaveParam = async () => {
    try {
      if (editingParamId) {
        const { error } = await api.from("measurement_parameters")
          .update({ parameter_name: paramForm.parameter_name, parameter_value: paramForm.parameter_value || null, unit: paramForm.unit || null })
          .eq("id", editingParamId);
        if (error) throw error;
        toast.success("Parameter aktualisiert");
      } else {
        const { error } = await api.from("measurement_parameters")
          .insert({ order_measurement_id: measurement.id, parameter_name: paramForm.parameter_name, parameter_value: paramForm.parameter_value || null, unit: paramForm.unit || null });
        if (error) throw error;
        toast.success("Parameter hinzugefügt");
      }
      setEditingParamId(null);
      setAddingParam(false);
      setParamForm({ parameter_name: "", parameter_value: "", unit: "" });
      qc.invalidateQueries({ queryKey: ["order"] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleDeleteParam = async (paramId: string) => {
    try {
      const { error } = await api.from("measurement_parameters").delete().eq("id", paramId);
      if (error) throw error;
      toast.success("Parameter gelöscht");
      qc.invalidateQueries({ queryKey: ["order"] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs font-normal">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <FlaskConical className="h-3 w-3" />
          Messdaten & Ergebnisse ({parameters.length} Param. / {results.length} Erg.)
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2 pl-4 pr-2">
        {/* Metadaten */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {sampleInfo?.sample_number && <div><span className="font-medium">Probe:</span> {sampleInfo.sample_number} – {sampleInfo.sample_name}</div>}
          {projectInfo?.project_number && <div><span className="font-medium">Projekt:</span> {projectInfo.project_number} {projectInfo.project_name ? `– ${projectInfo.project_name}` : ""}</div>}
          <div><span className="font-medium">Messung:</span> {measurement.measurement_number} – {measurement.measurement_services?.service_name}</div>
        </div>

        {/* Dynamic Parameter Form (from template - input params) */}
        <DynamicParameterForm
          measurementId={measurement.id}
          serviceId={serviceId}
          existingParams={parameters}
          canEdit={canEdit}
        />

        {/* Structured Result Entry (from template - output params) */}
        <ResultParameterEntry
          measurementId={measurement.id}
          serviceId={serviceId}
          existingResults={results}
          canEdit={canEdit}
        />

        {/* Legacy manual parameters (for params not from template) */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Beaker className="h-3.5 w-3.5" /> Zusätzliche Parameter
              </CardTitle>
              {canEdit && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                  setAddingParam(true);
                  setEditingParamId(null);
                  setParamForm({ parameter_name: "", parameter_value: "", unit: "" });
                }}>
                  <Plus className="h-3 w-3 mr-1" /> Hinzufügen
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Parameter</TableHead>
                  <TableHead className="text-xs">Wert</TableHead>
                  <TableHead className="text-xs">Einheit</TableHead>
                  {canEdit && <TableHead className="text-xs w-20">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parameters.map((p: any) => (
                  editingParamId === p.id ? (
                    <TableRow key={p.id}>
                      <TableCell><Input className="h-7 text-xs" value={paramForm.parameter_name} onChange={e => setParamForm(f => ({ ...f, parameter_name: e.target.value }))} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" value={paramForm.parameter_value} onChange={e => setParamForm(f => ({ ...f, parameter_value: e.target.value }))} /></TableCell>
                      <TableCell><Input className="h-7 text-xs w-20" value={paramForm.unit} onChange={e => setParamForm(f => ({ ...f, unit: e.target.value }))} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveParam}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingParamId(null)}><span className="text-xs">✕</span></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.parameter_name}</TableCell>
                      <TableCell className="text-xs">{p.parameter_value || "–"}</TableCell>
                      <TableCell className="text-xs">{p.unit || "–"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                              setEditingParamId(p.id);
                              setParamForm({ parameter_name: p.parameter_name, parameter_value: p.parameter_value || "", unit: p.unit || "" });
                            }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteParam(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                ))}
                {addingParam && (
                  <TableRow>
                    <TableCell><Input className="h-7 text-xs" placeholder="Parametername" value={paramForm.parameter_name} onChange={e => setParamForm(f => ({ ...f, parameter_name: e.target.value }))} /></TableCell>
                    <TableCell><Input className="h-7 text-xs" placeholder="Wert" value={paramForm.parameter_value} onChange={e => setParamForm(f => ({ ...f, parameter_value: e.target.value }))} /></TableCell>
                    <TableCell><Input className="h-7 text-xs w-20" placeholder="Einheit" value={paramForm.unit} onChange={e => setParamForm(f => ({ ...f, unit: e.target.value }))} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveParam} disabled={!paramForm.parameter_name.trim()}><Save className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAddingParam(false)}><span className="text-xs">✕</span></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {parameters.length === 0 && !addingParam && (
                  <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-xs text-muted-foreground py-3">Keine zusätzlichen Parameter</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
