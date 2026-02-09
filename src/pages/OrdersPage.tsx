import { useOrders } from "@/hooks/useOrders";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_TYPE_LABELS } from "@/lib/types";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function OrdersPage() {
  const { role } = useAuth();
  const { data: orders = [], isLoading } = useOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = orders.filter((o: any) => {
    const matchesSearch = !search ||
      o.projects?.project_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.projects?.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {role === "master" ? "Alle Messaufträge" : role === "durchfuehrer" ? "Meine Aufträge" : "Messaufträge"}
          </h1>
          <p className="text-muted-foreground">Übersicht und Verwaltung Ihrer Messaufträge</p>
        </div>
        {(role === "auftraggeber" || role === "master") && (
          <Link to="/auftraege/neu">
            <Button><Plus className="h-4 w-4 mr-2" />Neuer Messauftrag</Button>
          </Link>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Projektnummer oder Name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
            <SelectItem value="completed">Abgeschlossen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt-Nr.</TableHead>
                <TableHead>Projektname</TableHead>
                <TableHead>Auftragstyp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fälligkeit</TableHead>
                <TableHead>Erstellt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Messaufträge gefunden</TableCell></TableRow>
              ) : (
                filtered.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => {}}>
                    <TableCell>
                      <Link to={`/auftraege/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.projects?.project_number}
                      </Link>
                    </TableCell>
                    <TableCell>{o.projects?.project_name || "–"}</TableCell>
                    <TableCell>{ORDER_TYPE_LABELS[o.order_type as keyof typeof ORDER_TYPE_LABELS]}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.due_date ? new Date(o.due_date).toLocaleDateString("de-DE") : "–"}</TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString("de-DE")}</TableCell>
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
