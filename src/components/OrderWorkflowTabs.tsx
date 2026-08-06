import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useServices } from "@/hooks/useMeasurements";
import { useUpdateOrder } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { WorkflowRuntimePanel } from "@/components/workflow/WorkflowRuntimePanel";
import { PilotPlantProcessPanel } from "@/components/pilotplant/PilotPlantProcessPanel";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";

const WORKFLOW_STATUSES = [
  "entwurf","geplant","pp_in_progress","pp_completed","samples_created",
  "waiting_analysis","analysis_in_progress","results_complete","abgeschlossen",
] as const;

const MASSE_TYPES = ["DK","GK","KK","MK","PK"] as const;

export function OrderWorkflowTabs({ order }: { order: any }) {
  const { t } = useTranslation(["orders", "common"]);
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canEdit = role === "master" || hasPermission("orders.edit") || (order?.created_by === user?.id);
  const kind: string = order?.order_kind || "labor";
  const showPP = kind === "pilot_plant";

  return (
    <Card>
      <CardContent className="pt-4">
        <Tabs defaultValue={showPP ? "pilot_plant" : "samples"} className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            {showPP && <TabsTrigger value="pilot_plant">{t("orders:tabs.pilot_plant")}</TabsTrigger>}
            <TabsTrigger value="samples">{t("orders:tabs.samples")}</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="closure">{t("orders:tabs.closure")}</TabsTrigger>
          </TabsList>

          {showPP && (
            <TabsContent value="pilot_plant">
              <PilotPlantProcessPanel order={order} />
            </TabsContent>
          )}

          <TabsContent value="samples">
            <SamplesTab order={order} canEdit={canEdit} />
          </TabsContent>


          <TabsContent value="workflow">
            <WorkflowRuntimePanel order={order} />
          </TabsContent>

          <TabsContent value="closure">
            <ClosureTab order={order} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ------------------ Pilot Plant Tab ------------------ */
function PilotPlantTab({ order, canEdit }: { order: any; canEdit: boolean }) {
  const { t } = useTranslation(["orders"]);
  const upd = useUpdateOrder();
  const [f, setF] = useState({
    pp_experiment_number: order.pp_experiment_number || "",
    pp_v2o5_percent: order.pp_v2o5_percent ?? "",
    pp_experiment_date: order.pp_experiment_date || "",
    pp_previous_experiments: order.pp_previous_experiments || "",
    pp_experiment_kind: order.pp_experiment_kind || "",
    pp_masse_type: order.pp_masse_type || "__none__",
    pp_remarks: order.pp_remarks || "",
  });

  const save = async () => {
    try {
      await upd.mutateAsync({
        id: order.id,
        pp_experiment_number: f.pp_experiment_number || null,
        pp_v2o5_percent: f.pp_v2o5_percent === "" ? null : Number(f.pp_v2o5_percent),
        pp_experiment_date: f.pp_experiment_date || null,
        pp_previous_experiments: f.pp_previous_experiments || null,
        pp_experiment_kind: f.pp_experiment_kind || null,
        pp_masse_type: (f.pp_masse_type === "__none__" ? null : f.pp_masse_type) as any,
        pp_remarks: f.pp_remarks || null,
      });
      toast.success(t("orders:order_updated"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 pt-4">
      <div><Label>{t("orders:pp.experiment_number")}</Label>
        <Input value={f.pp_experiment_number} onChange={e => setF({ ...f, pp_experiment_number: e.target.value })} disabled={!canEdit} />
      </div>
      <div><Label>{t("orders:pp.v2o5_percent")}</Label>
        <Input type="number" step="0.01" value={f.pp_v2o5_percent as any} onChange={e => setF({ ...f, pp_v2o5_percent: e.target.value as any })} disabled={!canEdit} />
      </div>
      <div><Label>{t("orders:pp.experiment_date")}</Label>
        <Input type="date" value={f.pp_experiment_date} onChange={e => setF({ ...f, pp_experiment_date: e.target.value })} disabled={!canEdit} />
      </div>
      <div><Label>{t("orders:pp.masse_type")}</Label>
        <Select value={f.pp_masse_type} onValueChange={(v) => setF({ ...f, pp_masse_type: v })} disabled={!canEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">–</SelectItem>
            {MASSE_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>{t("orders:pp.experiment_kind")}</Label>
        <Input value={f.pp_experiment_kind} onChange={e => setF({ ...f, pp_experiment_kind: e.target.value })} disabled={!canEdit} />
      </div>
      <div><Label>{t("orders:pp.previous_experiments")}</Label>
        <Input value={f.pp_previous_experiments} onChange={e => setF({ ...f, pp_previous_experiments: e.target.value })} disabled={!canEdit} />
      </div>
      <div className="md:col-span-2"><Label>{t("orders:pp.remarks")}</Label>
        <Textarea rows={3} value={f.pp_remarks} onChange={e => setF({ ...f, pp_remarks: e.target.value })} disabled={!canEdit} />
      </div>
      {canEdit && (
        <div className="md:col-span-2">
          <Button size="sm" onClick={save} disabled={upd.isPending}>{t("orders:pp.save")}</Button>
        </div>
      )}
    </div>
  );
}

/* ------------------ Samples Tab ------------------ */
function SamplesTab({ order, canEdit }: { order: any; canEdit: boolean }) {
  const { t } = useTranslation(["orders", "common"]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const { data: samples = [] } = useQuery({
    queryKey: ["order-samples", order.id],
    queryFn: () => api.samples.listForOrder(order.id),
  });

  const addSample = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !user) throw new Error("Name fehlt");
      return api.samples.create({
        sample_name: name.trim(),
        description: desc || "",
        project_id: order.project_id,
        created_by: user.id,
        order_id: order.id,
      } as any);
    },
    onSuccess: () => {
      setName(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["order-samples", order.id] });
      qc.invalidateQueries({ queryKey: ["order", order.id] });
      toast.success("Probe erstellt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label>{t("orders:samples_tab.name_placeholder")}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="PP-001" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label>{t("common:description", { defaultValue: "Beschreibung" })}</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => addSample.mutate()} disabled={addSample.isPending || !name.trim()}>
            <Plus className="h-4 w-4 mr-1" /> {t("orders:samples_tab.add")}
          </Button>
        </div>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("orders:samples_tab.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>{t("common:description", { defaultValue: "Beschreibung" })}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.sample_number}</TableCell>
                <TableCell>{s.sample_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}


/* ------------------ Closure Tab ------------------ */
function ClosureTab({ order }: { order: any; canEdit?: boolean }) {
  const { t } = useTranslation(["orders"]);
  const isClosed = order?.workflow_status === "abgeschlossen";

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <Label className="mb-0">{t("orders:closure_tab.current_status")}:</Label>
        <WorkflowStatusBadge status={order.workflow_status} />
      </div>

      {isClosed ? (
        <div className="border rounded-md p-4 bg-green-500/5 border-green-500/40 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Auftrag automatisch abgeschlossen</p>
            <p className="text-sm text-muted-foreground">
              Alle Ergebnisse wurden erfasst und stehen zur Einsicht bereit. Der Auftrag ist
              schreibgeschützt. Korrekturen erfolgen ausschließlich über einen Korrekturauftrag
              oder eine Nachmessung.
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-md p-4 bg-muted/40 text-sm text-muted-foreground">
          Der Auftrag wird automatisch abgeschlossen, sobald alle Workflow-Schritte erfolgreich
          beendet und für jede Position ein Ergebnis oder eine Begründung erfasst wurde. Ein
          manueller Abschluss ist nicht mehr erforderlich.
        </div>
      )}
    </div>
  );
}
