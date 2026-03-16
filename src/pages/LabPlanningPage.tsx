import { useState, useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GripVertical, ArrowRight, Clock, User } from "lucide-react";

const STATUS_COLUMNS = [
  { key: "open", label: "Offen", color: "bg-yellow-500/10 border-yellow-500/30" },
  { key: "in_progress", label: "In Arbeit", color: "bg-blue-500/10 border-blue-500/30" },
  { key: "completed", label: "Abgeschlossen", color: "bg-green-500/10 border-green-500/30" },
] as const;

function useLabMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lab-planning-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_measurements")
        .select(`
          id, measurement_number, status, assigned_to, due_date, priority,
          planned_start_date, planned_end_date, workstation_id,
          measurement_services(service_name, category, standard_duration_hours),
          measurement_orders(order_number, projects(project_number, project_name), samples(sample_number, sample_name)),
          workstations(name)
        `)
        .order("priority", { ascending: false })
        .order("due_date");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export default function LabPlanningPage() {
  const { data: measurements = [], isLoading } = useLabMeasurements();
  const { data: users = [] } = useUsers();
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [filterAssigned, setFilterAssigned] = useState<string>("all");

  const getUserName = (userId: string | null) => {
    if (!userId) return "–";
    const u = (users as any[]).find(u => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() : "–";
  };

  const filteredMeasurements = useMemo(() => {
    if (filterAssigned === "all") return measurements as any[];
    if (filterAssigned === "unassigned") return (measurements as any[]).filter(m => !m.assigned_to);
    return (measurements as any[]).filter(m => m.assigned_to === filterAssigned);
  }, [measurements, filterAssigned]);

  const columns = STATUS_COLUMNS.map(col => ({
    ...col,
    items: filteredMeasurements.filter(m => m.status === col.key),
  }));

  const handleDrop = async (measurementId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("order_measurements")
        .update({ status: newStatus as any })
        .eq("id", measurementId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["lab-planning-measurements"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      toast.success("Status aktualisiert");
    } catch (e: any) {
      toast.error(e.message);
    }
    setDraggedId(null);
  };

  const priorityColor = (p: number) => {
    if (p >= 2) return "text-red-600 bg-red-50";
    if (p >= 1) return "text-orange-600 bg-orange-50";
    return "text-muted-foreground bg-muted";
  };

  const priorityLabel = (p: number) => {
    if (p >= 2) return "Höchste";
    if (p >= 1) return "Wichtig";
    return "Normal";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laborplanung</h1>
          <p className="text-muted-foreground">Drag & Drop Messungsplanung</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterAssigned} onValueChange={setFilterAssigned}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Messungen</SelectItem>
              <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
              {(users as any[]).filter(u => u.is_active).map(u => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.first_name} {u.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laden…</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 min-h-[60vh]">
          {columns.map(col => (
            <div
              key={col.key}
              className={`rounded-lg border-2 p-3 ${col.color} transition-colors ${draggedId ? "border-dashed" : ""}`}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary"); }}
              onDragLeave={e => { e.currentTarget.classList.remove("ring-2", "ring-primary"); }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove("ring-2", "ring-primary");
                if (draggedId) handleDrop(draggedId, col.key);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <Badge variant="secondary">{col.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {col.items.map((m: any) => (
                  <Card
                    key={m.id}
                    className={`cursor-grab active:cursor-grabbing transition-shadow ${draggedId === m.id ? "opacity-50" : "hover:shadow-md"}`}
                    draggable
                    onDragStart={() => setDraggedId(m.id)}
                    onDragEnd={() => setDraggedId(null)}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs font-medium">{m.measurement_number}</span>
                        </div>
                        <Badge className={`text-[10px] ${priorityColor(m.priority)}`} variant="outline">
                          {priorityLabel(m.priority)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {m.measurement_services?.service_name || "–"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.measurement_orders?.order_number} · {m.measurement_orders?.projects?.project_number}
                      </p>
                      {m.measurement_orders?.samples && (
                        <p className="text-xs text-muted-foreground truncate">
                          Probe: {m.measurement_orders.samples.sample_name || m.measurement_orders.samples.sample_number}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getUserName(m.assigned_to)}
                        </span>
                        {m.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(m.due_date).toLocaleDateString("de-AT")}
                          </span>
                        )}
                      </div>
                      {m.workstations?.name && (
                        <Badge variant="outline" className="text-[10px]">{m.workstations.name}</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {col.items.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground opacity-60">
                    Keine Messungen
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
