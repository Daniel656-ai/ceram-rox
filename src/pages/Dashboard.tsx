import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, FolderOpen } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { useProjects } from "@/hooks/useProjects";
import { useMyMeasurements } from "@/hooks/useMeasurements";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UtilizationSidebar } from "@/components/UtilizationSidebar";

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { t } = useTranslation(["common", "navigation", "orders"]);
  const { data: orders = [] } = useOrders();
  const { data: projects = [] } = useProjects();
  const { data: myMeasurements = [] } = useMyMeasurements();

  const greeting = profile?.first_name
    ? `${t("common:welcome", "Willkommen")}, ${profile.first_name}!`
    : `${t("common:welcome", "Willkommen")}!`;

  const roleLabel =
    role === "master" ? t("common:role_master") :
    role === "auftraggeber" ? t("common:role_auftraggeber") :
    role === "durchfuehrer" ? t("common:role_durchfuehrer") : "";

  const openOrders = orders.filter(o => o.status === "open").length;
  const inProgressOrders = orders.filter(o => o.status === "in_progress").length;
  const completedOrders = orders.filter(o => o.status === "completed").length;

  const inProgressMeasurements = myMeasurements.filter(m => m.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">
            {roleLabel}-Dashboard
          </p>
        </div>
        {(role === "auftraggeber" || role === "master") && (
          <Link to="/auftraege/neu">
            <Button>
              <ClipboardList className="h-4 w-4 mr-2" />
              {t("orders:new_order")}
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("navigation:projects")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_open")}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_in_progress")}</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{role === "durchfuehrer" ? inProgressMeasurements : inProgressOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_completed")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedOrders}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {role === "durchfuehrer" ? t("measurements:no_measurements", "Meine offenen Messungen") : t("orders:title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {role === "durchfuehrer" ? (
            myMeasurements.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("measurements:no_measurements")}</p>
            ) : (
              <div className="space-y-3">
                {myMeasurements.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="font-medium">{m.measurement_services?.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("common:project")}: {m.measurement_orders?.projects?.project_number}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )
          ) : (
            orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common:no_data")}</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((o: any) => (
                  <Link key={o.id} to={`/auftraege/${o.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">
                          {o.projects?.project_number} – {t(`common:order_type_${o.order_type}`, o.order_type)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {o.projects?.project_name || "–"}
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

      {(role === "master" || role === "durchfuehrer") && (
        <UtilizationSidebar />
      )}
    </div>
  );
}
