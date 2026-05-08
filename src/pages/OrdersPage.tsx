import { useOrders, useDeleteOrder, useUpdateOrderRanking } from "@/hooks/useOrders";
import { useMyMeasurements } from "@/hooks/useMeasurements";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAnyProjectLead } from "@/hooks/useProjectMembers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function OrdersPage() {
  const { user, role } = useAuth();
  const { t, i18n } = useTranslation(["orders", "common", "measurements"]);
  const { data: orders = [], isLoading } = useOrders();
  const { data: myMeasurements = [], isLoading: isLoadingMine } = useMyMeasurements();
  const { data: isAnyProjectLead = false } = useIsAnyProjectLead();
  const deleteOrder = useDeleteOrder();
  const updateRanking = useUpdateOrderRanking();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (role === "durchfuehrer") {
    const filteredTasks = (myMeasurements as any[]).filter((m: any) => {
      const matchesSearch = !search ||
        m.measurement_number?.toLowerCase().includes(search.toLowerCase()) ||
        m.measurement_services?.service_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.measurement_orders?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        m.measurement_orders?.projects?.project_number?.toLowerCase().includes(search.toLowerCase()) ||
        m.measurement_orders?.projects?.project_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders:my_title")}</h1>
          <p className="text-muted-foreground">{t("measurements:no_measurements", "Meine Aufgaben")}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("orders:search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("common:status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:all_status")}</SelectItem>
              <SelectItem value="open">{t("common:status_open")}</SelectItem>
              <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
              <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aufgaben-Nr.</TableHead>
                  <TableHead>Dienstleistung</TableHead>
                  <TableHead>Arbeitsplatz</TableHead>
                  <TableHead>{t("orders:order_number")}</TableHead>
                  <TableHead>{t("orders:project_number")}</TableHead>
                  <TableHead>{t("common:status")}</TableHead>
                  <TableHead>{t("orders:due_date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingMine ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("measurements:no_measurements", "Keine Aufgaben")}</TableCell></TableRow>
                ) : filteredTasks.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">
                      <Link to={`/auftraege/${m.measurement_orders?.id}?measurement=${m.id}`} className="text-primary hover:underline">
                        {m.measurement_number}
                      </Link>
                    </TableCell>
                    <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                    <TableCell>{m.workstations?.name || "–"}</TableCell>
                    <TableCell className="font-mono">
                      {m.measurement_orders?.order_number || "–"}
                    </TableCell>
                    <TableCell>{m.measurement_orders?.projects?.project_number || "–"}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell>{m.due_date ? new Date(m.due_date).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE") : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibleOrders = orders;

  const filtered = visibleOrders.filter((o: any) => {
    const matchesSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.projects?.project_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.projects?.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canCreateOrder = role === "master" || role === "auftraggeber" || isAnyProjectLead;
  const canShowActions = role === "master" || role === "auftraggeber" || isAnyProjectLead;

  const canDelete = (o: any) => {
    if (role === "master") return true;
    if (o.created_by === user?.id && o.status === "open") return true;
    return false;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOrder.mutateAsync(id);
      toast.success(t("orders:deleted"));
    } catch (err: any) {
      toast.error(t("orders:delete_error"), { description: err.message });
    }
  };

  const handleRankingChange = async (orderId: string, value: string) => {
    try {
      const ranking = value === "none" ? null : parseInt(value);
      await updateRanking.mutateAsync({ id: orderId, ranking });
      toast.success("Priorisierung aktualisiert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {role === "master" ? t("orders:all_title") : t("orders:title")}
          </h1>
          <p className="text-muted-foreground">{t("orders:subtitle")}</p>
        </div>
        {canCreateOrder && (
          <div className="flex gap-2">
            <Link to="/auftraege/neu">
              <Button><Plus className="h-4 w-4 mr-2" />{t("orders:new_order")}</Button>
            </Link>
            {role === "master" && (
              <Link to="/auftraege/import">
                <Button variant="outline"><FileSpreadsheet className="h-4 w-4 mr-2" />{t("orders:excel_import")}</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("orders:search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common:status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders:all_status")}</SelectItem>
            <SelectItem value="open">{t("common:status_open")}</SelectItem>
            <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
            <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orders:order_number")}</TableHead>
                <TableHead>{t("orders:project_number")}</TableHead>
                <TableHead>{t("orders:project_name")}</TableHead>
                <TableHead>{t("orders:order_type")}</TableHead>
                <TableHead>{t("orders:priority")}</TableHead>
                <TableHead>{t("common:status")}</TableHead>
                <TableHead>{t("orders:due_date")}</TableHead>
                <TableHead>{t("common:created")}</TableHead>
                {canShowActions && <TableHead className="w-[60px]">{t("common:actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("orders:no_orders")}</TableCell></TableRow>
              ) : (
                filtered.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to={`/auftraege/${o.id}`} className="font-mono font-medium text-primary hover:underline">
                        {o.order_number || "–"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {o.projects?.project_number}
                    </TableCell>
                    <TableCell>{o.projects?.project_name || "–"}</TableCell>
                    <TableCell>{t(`common:order_type_${o.order_type}`)}</TableCell>
                    <TableCell>
                      {role === "master" ? (
                        <Select
                          value={o.ranking ? String(o.ranking) : "none"}
                          onValueChange={(val) => handleRankingChange(o.id, val)}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">–</SelectItem>
                            <SelectItem value="1">Prio 1</SelectItem>
                            <SelectItem value="2">Prio 2</SelectItem>
                            <SelectItem value="3">Prio 3</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        o.ranking ? (
                          <Badge variant={o.ranking === 1 ? "destructive" : o.ranking === 2 ? "default" : "secondary"}>
                            Prio {o.ranking}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.due_date ? new Date(o.due_date).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE") : "–"}</TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE")}</TableCell>
                    {canShowActions && (
                      <TableCell>
                        {canDelete(o) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("orders:delete_title")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("orders:delete_description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(o.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t("common:delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
