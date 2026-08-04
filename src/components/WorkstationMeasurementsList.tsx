import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useWorkstationMeasurements } from "@/hooks/useWorkstations";
import { orderDetailPath } from "@/lib/orderNavigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";

interface Props {
  workstationId: string;
  userMap: Map<string, { user_id: string; name: string; roleLabel: string }>;
}

const STATUS_ORDER = ["open", "in_progress", "completed"];
const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
};

export function WorkstationMeasurementsList({ workstationId, userMap }: Props) {
  const navigate = useNavigate();
  const { data: measurements, isLoading } = useWorkstationMeasurements(workstationId);

  const columns = useMemo<DataTableColumn<any>[]>(
    () => [
      {
        key: "measurement_number",
        header: "Aufg.-Nr.",
        type: "text",
        className: "font-mono text-xs",
      },
      {
        key: "service_name",
        header: "Aufgabe",
        type: "text",
        accessor: (m) => (m.measurement_services as any)?.service_name ?? "",
        className: "font-medium text-primary",
        cell: (m) => {
          const service = m.measurement_services as any;
          return (
            <>
              {service?.service_name ?? "–"}
              {service?.category && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {service.category === "labor" ? "Labor" : "Technikum"}
                </Badge>
              )}
            </>
          );
        },
      },
      {
        key: "ranking",
        header: "Priorität",
        type: "number",
        accessor: (m) => m.ranking ?? (m.measurement_orders as any)?.ranking ?? 999,
        cell: (m) => <PriorityBadge ranking={m.ranking ?? (m.measurement_orders as any)?.ranking} />,
      },
      {
        key: "project",
        header: "Projekt",
        type: "text",
        accessor: (m) => {
          const project = (m.measurement_orders as any)?.projects;
          return project
            ? `${project.project_number}${project.project_name ? ` – ${project.project_name}` : ""}`
            : "";
        },
      },
      {
        key: "assignee",
        header: "Zugewiesen an",
        type: "text",
        accessor: (m) => (m.assigned_to ? userMap.get(m.assigned_to)?.name ?? "" : ""),
        cell: (m) => {
          const assignee = m.assigned_to ? userMap.get(m.assigned_to) : null;
          return assignee ? (
            <span>
              {assignee.name}{" "}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {assignee.roleLabel}
              </Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">–</span>
          );
        },
      },
      { key: "due_date", header: "Fällig", type: "date" },
      {
        key: "status",
        header: "Status",
        type: "status",
        statusOrder: STATUS_ORDER,
        statusLabels: STATUS_LABELS,
        cell: (m) => <StatusBadge status={m.status} />,
      },
    ],
    [userMap],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;
  if (!measurements?.length) return null;

  return (
    <div className="mb-6 space-y-3">
      <h4 className="text-sm font-semibold">Zugewiesene Aufgaben</h4>
      <DataTable<any>
        tableId={`workstation.measurements`}
        columns={columns}
        rows={measurements ?? []}
        rowKey={(m) => m.id}
        emptyMessage="Keine Aufgaben mit diesem Filter."
        searchPlaceholder="Aufgabe, Projekt, Person …"
        defaultPageSize={10}
        onRowClick={(m) => {
          const order = m.measurement_orders as any;
          if (order?.id) navigate(orderDetailPath(order.id));
        }}
      />
    </div>
  );
}
