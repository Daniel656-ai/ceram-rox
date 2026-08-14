import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useOrderAuditLog } from "@/hooks/useOrders";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkflowRuntimePanel } from "@/components/workflow/WorkflowRuntimePanel";
import { ORDER_PRIORITY_LABELS } from "@/lib/types";
import { ListChecks, History, ArrowRight } from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  order_created: "Auftrag erstellt",
  order_updated: "Auftrag geändert",
  order_completed: "Auftrag abgeschlossen",
  measurement_created: "Aufgabe angelegt",
  measurement_started: "Aufgabe gestartet",
  measurement_completed: "Aufgabe erledigt",
  measurement_status_changed: "Status der Aufgabe geändert",
  measurement_assigned: "Aufgabe zugewiesen",
  sample_added: "Probe hinzugefügt",
  replacement_sample_booked: "Ersatzprobe gebucht",
  result_official: "Ergebnis als offiziell markiert",
};

const serviceStatus = (tasks: any[]) => {
  if (tasks.length === 0) return "open";
  if (tasks.every((t) => t.status === "completed")) return "completed";
  if (tasks.some((t) => t.status === "in_progress")) return "in_progress";
  return "open";
};

/**
 * Tab „Workflow“: operative Abwicklung – beauftragte Dienstleistungen,
 * zugehörige Aufgaben mit Status und der nicht bearbeitbare Änderungsverlauf.
 * Ergebnisse und Probendetails bleiben bewusst den anderen Tabs vorbehalten.
 */
export default function OrderWorkflowTab({
  order,
  isRequesterView,
  processSlot,
}: {
  order: any;
  isRequesterView: boolean;
  processSlot?: React.ReactNode;
}) {

  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: auditLogs = [] } = useOrderAuditLog(order.id);

  const { data: events = [] } = useQuery({
    queryKey: ["order-activity", order.id],
    queryFn: () => api.activityLog.listForOrder(order.id) as Promise<any[]>,
    enabled: !!order.id,
  });

  const userName = (id?: string | null) => {
    if (!id) return "–";
    const u = (users as any[]).find((x) => x.user_id === id);
    return u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "–" : "–";
  };

  const measurements: any[] = order.order_measurements || [];

  const groups = useMemo(() => {
    const m = new Map<string, { serviceId: string; name: string; tasks: any[] }>();
    for (const t of measurements) {
      const key = t.service_id || "unbekannt";
      if (!m.has(key)) {
        m.set(key, {
          serviceId: key,
          name: t.measurement_services?.service_name || "Unbekannte Dienstleistung",
          tasks: [],
        });
      }
      m.get(key)!.tasks.push(t);
    }
    return Array.from(m.values());
  }, [measurements]);

  const timeline = useMemo(() => {
    const fromEvents = (events as any[]).map((e) => ({
      id: `e-${e.id}`,
      at: e.created_at,
      user: e.actor_user_id,
      text: EVENT_LABELS[e.event_type] || e.event_type,
    }));
    const fromAudit = (auditLogs as any[]).map((l) => ({
      id: `a-${l.id}`,
      at: l.changed_at,
      user: l.changed_by,
      text: `${l.field_name === "priority" ? "Priorität" : l.field_name}: ${
        ORDER_PRIORITY_LABELS[l.old_value as keyof typeof ORDER_PRIORITY_LABELS] || l.old_value || "–"
      } → ${
        ORDER_PRIORITY_LABELS[l.new_value as keyof typeof ORDER_PRIORITY_LABELS] || l.new_value || "–"
      }`,
    }));
    return [...fromEvents, ...fromAudit].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [events, auditLogs]);

  const canOpenTask = (t: any) =>
    !isRequesterView && (role === "master" || t.assigned_to === user?.id);

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Dienstleistungen & Aufgaben ({groups.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Dienstleistungen beauftragt.</p>
          )}
          {groups.map((g) => (
            <div key={g.serviceId} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{g.name}</span>
                <StatusBadge status={serviceStatus(g.tasks)} />
                <Badge variant="outline" className="text-xs">
                  {g.tasks.length} Aufgabe{g.tasks.length === 1 ? "" : "n"}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aufg.-Nr.</TableHead>
                    <TableHead>Probe</TableHead>
                    <TableHead>Messdienstleister</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Abschluss</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.measurement_number}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.samples?.sample_number || "–"}
                      </TableCell>
                      <TableCell className="text-sm">{userName(t.assigned_to)}</TableCell>
                      <TableCell className="text-xs">
                        {t.planned_start_date
                          ? new Date(t.planned_start_date).toLocaleDateString("de-AT")
                          : "–"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.status === "completed"
                          ? new Date(t.updated_at).toLocaleDateString("de-AT")
                          : t.planned_end_date
                            ? new Date(t.planned_end_date).toLocaleDateString("de-AT")
                            : "–"}
                      </TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-right">
                        {canOpenTask(t) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/aufgaben/${t.id}`)}
                          >
                            Bearbeiten <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      {processSlot}

      {!isRequesterView && <WorkflowRuntimePanel order={order} />}

      {!isRequesterView && role !== "durchfuehrer" && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Arbeitszeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTimeEntries projectId={order.project_id} orderId={order.id} />
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Änderungsverlauf ({timeline.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Keine Einträge vorhanden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum &amp; Uhrzeit</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Änderung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(e.at).toLocaleString("de-AT")}
                    </TableCell>
                    <TableCell className="text-sm">{userName(e.user)}</TableCell>
                    <TableCell className="text-sm">{e.text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
