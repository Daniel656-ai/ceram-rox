import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  buildBookedServices,
  BOOKED_SERVICE_STATUS_LABEL,
  type BookedServiceStatus,
} from "@/lib/projectServiceAggregation";
import { ProjectServicesTab } from "@/components/ProjectServicesTab";

const STATUS_STYLE: Record<BookedServiceStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  partially_completed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-destructive/10 text-destructive",
};

const d = (v: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");

interface Props {
  projectId: string;
  orders: any[];
  canEdit: boolean;
  canViewCosts: boolean;
}

export function ProjectBookedServicesTab({ projectId, orders, canEdit, canViewCosts }: Props) {
  const rows = useMemo(() => buildBookedServices(orders), [orders]);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("__all__");
  const [serviceFilter, setServiceFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

  const orderOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.orderNumber).filter(Boolean))).sort(),
    [rows]
  );
  const serviceOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.serviceName))).sort(),
    [rows]
  );

  const filtered = rows.filter((r) => {
    if (orderFilter !== "__all__" && r.orderNumber !== orderFilter) return false;
    if (serviceFilter !== "__all__" && r.serviceName !== serviceFilter) return false;
    if (statusFilter !== "__all__" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.orderNumber} ${r.serviceName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalHours = filtered.reduce((s, r) => s + r.hours, 0);
  const totalCost = filtered.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Gebuchte Dienstleistungen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Abgeleitet aus den Aufträgen dieses Projekts – Status, Stunden und Kosten stammen
            unverändert aus der Auftrags- und Workflowlogik.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Suchen (Auftrag, Dienstleistung)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Auftrag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Aufträge</SelectItem>
                {orderOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Dienstleistung" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Dienstleistungen</SelectItem>
                {serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Status</SelectItem>
                {Object.entries(BOOKED_SERVICE_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auftrag</TableHead>
                <TableHead>Dienstleistung</TableHead>
                <TableHead className="text-right">Proben</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Erledigt</TableHead>
                <TableHead className="text-right">Stunden</TableHead>
                {canViewCosts && <TableHead className="text-right">Kosten</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canViewCosts ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    Keine über Aufträge gebuchten Dienstleistungen vorhanden.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.key} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to={`/orders/${r.orderId}`} className="text-primary hover:underline">
                        {r.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/orders/${r.orderId}`} className="hover:underline">{r.serviceName}</Link>
                    </TableCell>
                    <TableCell className="text-right">{r.sampleCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLE[r.status]}>
                        {BOOKED_SERVICE_STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{d(r.startDate)}</TableCell>
                    <TableCell>{d(r.completedDate)}</TableCell>
                    <TableCell className="text-right">{r.hours.toFixed(1)} h</TableCell>
                    {canViewCosts && (
                      <TableCell className="text-right">{formatCurrency(r.cost)} €</TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filtered.length > 0 && (
            <div className="flex justify-end gap-6 text-sm font-semibold">
              <span>Summe Stunden: {totalHours.toFixed(1)} h</span>
              {canViewCosts && <span>Summe Kosten: {formatCurrency(totalCost)} €</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bestehende manuelle Planung bleibt unverändert erhalten. */}
      <ProjectServicesTab projectId={projectId} canEdit={canEdit} />
    </div>
  );
}
