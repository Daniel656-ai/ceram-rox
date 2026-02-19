import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useWorkstationMeasurements } from "@/hooks/useWorkstations";

interface Props {
  workstationId: string;
  userMap: Map<string, { user_id: string; name: string; roleLabel: string }>;
}

export function WorkstationMeasurementsList({ workstationId, userMap }: Props) {
  const navigate = useNavigate();
  const { data: measurements, isLoading } = useWorkstationMeasurements(workstationId);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = (measurements ?? []).filter(
    (m) => statusFilter === "all" || m.status === statusFilter
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (!measurements?.length) return null;

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Zugewiesene Messungen</h4>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Filter:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="open">Offen</SelectItem>
              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Messungen mit diesem Filter.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Messung</TableHead>
              <TableHead>Priorität</TableHead>
              <TableHead>Projekt</TableHead>
              <TableHead>Zugewiesen an</TableHead>
              <TableHead>Fällig</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const service = m.measurement_services as any;
              const order = m.measurement_orders as any;
              const project = order?.projects;
              const assignee = m.assigned_to ? userMap.get(m.assigned_to) : null;

              return (
                <TableRow
                  key={m.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/orders/${order?.id}`)}
                >
                  <TableCell className="font-medium text-primary">
                    {service?.service_name ?? "–"}
                    {service?.category && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {service.category === "labor" ? "Labor" : "Technikum"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell><PriorityBadge priority={m.priority} /></TableCell>
                  <TableCell>
                    {project
                      ? `${project.project_number}${project.project_name ? ` – ${project.project_name}` : ""}`
                      : "–"}
                  </TableCell>
                  <TableCell>
                    {assignee ? (
                      <span>
                        {assignee.name}{" "}
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {assignee.roleLabel}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell>{m.due_date ?? "–"}</TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
