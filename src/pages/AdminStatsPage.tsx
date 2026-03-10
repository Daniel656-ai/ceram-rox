import { useOrders } from "@/hooks/useOrders";
import { useProjects } from "@/hooks/useProjects";
import { useAllServices } from "@/hooks/useMeasurements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ClipboardList, FolderOpen, Beaker, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const COLORS = ["hsl(200, 60%, 32%)", "hsl(16, 75%, 48%)", "hsl(152, 55%, 36%)", "hsl(38, 85%, 50%)", "hsl(270, 50%, 50%)"];

export default function AdminStatsPage() {
  const { t } = useTranslation(["admin", "common"]);
  const { data: orders = [] } = useOrders();
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useAllServices();

  const ordersByType = [
    { name: t("common:order_type_customer"), value: orders.filter(o => o.order_type === "customer").length },
    { name: t("common:order_type_production"), value: orders.filter(o => o.order_type === "production").length },
    { name: t("common:order_type_rnd"), value: orders.filter(o => o.order_type === "rnd").length },
  ];

  const ordersByStatus = [
    { name: t("common:status_open"), value: orders.filter(o => o.status === "open").length },
    { name: t("common:status_in_progress"), value: orders.filter(o => o.status === "in_progress").length },
    { name: t("common:status_completed"), value: orders.filter(o => o.status === "completed").length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin:stats_title")}</h1>
        <p className="text-muted-foreground">{t("admin:stats_subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:stats_projects")}</CardTitle><FolderOpen className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{projects.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:stats_orders")}</CardTitle><ClipboardList className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{orders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:stats_services")}</CardTitle><Beaker className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{services.filter(s => s.active).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:stats_open")}</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{orders.filter(o => o.status !== "completed").length}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin:stats_by_type")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ordersByType}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="value" fill="hsl(200, 60%, 32%)" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin:stats_by_status")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={ordersByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{ordersByStatus.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
