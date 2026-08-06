import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderKind } from "@/lib/api/orderKindFormTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Beaker, Factory, Layers, Trash2 } from "lucide-react";

const KINDS: { key: OrderKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "labor", label: "Labor", icon: Beaker },
  { key: "pilot_plant", label: "Pilot Plant", icon: Factory },
  
];

export default function OrderKindMappingTab() {
  const qc = useQueryClient();
  const { data: mappings = [] } = useQuery({
    queryKey: ["order-kind-form-templates"],
    queryFn: () => api.orderKindFormTemplates.list(),
  });
  const { data: forms = [] } = useQuery({
    queryKey: ["form-definitions-all"],
    queryFn: () => api.formDefinitions.list(),
  });

  const upsert = useMutation({
    mutationFn: (args: { kind: OrderKind; formId: string }) =>
      api.orderKindFormTemplates.upsert(args.kind, args.formId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-kind-form-templates"] });
      qc.invalidateQueries({ queryKey: ["order-kind-form-template"] });
      toast.success("Zuordnung gespeichert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (kind: OrderKind) => api.orderKindFormTemplates.remove(kind),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-kind-form-templates"] });
      qc.invalidateQueries({ queryKey: ["order-kind-form-template"] });
      toast.success("Zuordnung entfernt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const findMapping = (k: OrderKind) => (mappings as any[]).find(m => m.order_kind === k);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Auftragsart → Formular-Template</h2>
        <p className="text-sm text-muted-foreground">
          Ordne jeder Auftragsart genau ein Formular zu. Beim Anlegen eines Auftrags wird
          automatisch das hier hinterlegte Template geladen. Es sind keinerlei
          Code-Änderungen erforderlich, um Felder, Reihenfolge oder Validierungen zu ändern.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map(({ key, label, icon: Icon }) => {
          const mapping = findMapping(key);
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                  {mapping ? <Badge variant="secondary">verknüpft</Badge> : <Badge variant="outline">kein Template</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={mapping?.form_definition_id ?? "__none__"}
                  onValueChange={(v) => {
                    if (v === "__none__") return;
                    upsert.mutate({ kind: key, formId: v });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Formular auswählen…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">–</SelectItem>
                    {(forms as any[]).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove.mutate(key)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Zuordnung entfernen
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
