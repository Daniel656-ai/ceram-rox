import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, FolderOpen, Beaker, Users } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { useProjects } from "@/hooks/useProjects";
import { useMyMeasurements } from "@/hooks/useMeasurements";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ORDER_TYPE_LABELS } from "@/lib/types";

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { data: orders = [] } = useOrders();
  const { data: projects = [] } = useProjects();
  const { data: myMeasurements = [] } = useMyMeasurements();

  const greeting = profile?.first_name
    ? `Willkommen, ${profile.first_name}!`
    : "Willkommen!";

  const roleLabel =
    role === "master" ? "Administrator" :
    role === "auftraggeber" ? "Auftraggeber" :
    role === "durchfuehrer" ? "Messdienstleister" : "";

  const openOrders = orders.filter(o => o.status === "open").length;
  const inProgressOrders = orders.filter(o => o.status === "in_progress").length;
  const completedOrders = orders.filter(o => o.status === "completed").length;

  const openMeasurements = myMeasurements.filter(m => m.status === "open").length;
  const inProgressMeasurements = myMeasurements.filter(m => m.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">
            {roleLabel}-Dashboard – Überblick über Ihre Aktivitäten
          </p>
        </div>
        {(role === "auftraggeber" || role === "master") && (
          <Link to="/auftraege/neu">
            <Button>
              <ClipboardList className="h-4 w-4 mr-2" />
              Neuer Messauftrag
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projekte</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offene Aufträge</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Bearbeitung</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{role === "durchfuehrer" ? inProgressMeasurements : inProgressOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Abgeschlossen</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {role === "durchfuehrer" ? "Meine offenen Messungen" : "Aktuelle Messaufträge"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {role === "durchfuehrer" ? (
            myMeasurements.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine offenen Messungen zugewiesen.</p>
            ) : (
              <div className="space-y-3">
                {myMeasurements.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="font-medium">{m.measurement_services?.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Projekt: {m.measurement_orders?.projects?.project_number}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )
          ) : (
            orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Messaufträge vorhanden. Erstellen Sie Ihren ersten Auftrag!
              </p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((o: any) => (
                  <Link key={o.id} to={`/auftraege/${o.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">
                          {o.projects?.project_number} – {ORDER_TYPE_LABELS[o.order_type as keyof typeof ORDER_TYPE_LABELS]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {o.projects?.project_name || "Ohne Projektname"}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
