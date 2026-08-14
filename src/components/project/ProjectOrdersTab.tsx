import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList } from "lucide-react";

const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};
const STATUS_LABEL: Record<string, string> = {
  open: "offen",
  in_progress: "in Bearbeitung",
  completed: "erledigt",
};

interface Props {
  orders: any[];
  sampleLinks: any[];
}

export function ProjectOrdersTab({ orders, sampleLinks }: Props) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return (orders || []).map((o: any) => {
      const ms = o.order_measurements || [];
      const completed = ms.filter((m: any) => m.status === "completed").length;
      const linkedSamples = new Set<string>(
        (sampleLinks || []).filter((l: any) => l.order_id === o.id).map((l: any) => l.sample_id)
      );
      for (const m of ms) if (m.sample_id) linkedSamples.add(m.sample_id);
      if (o.sample_id) linkedSamples.add(o.sample_id);
      const services = Array.from(
        new Set(ms.map((m: any) => m.measurement_services?.service_name).filter(Boolean))
      ) as string[];
      return {
        id: o.id,
        orderNumber: o.order_number,
        title: o.notes || o.customer_name || o.reference_number || "–",
        status: o.status,
        sampleCount: linkedSamples.size,
        services,
        progress: ms.length > 0 ? Math.round((completed / ms.length) * 100) : 0,
        createdAt: o.created_at,
        completedAt: o.status === "completed" ? o.updated_at : null,
      };
    });
  }, [orders, sampleLinks]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${r.orderNumber} ${r.title} ${r.services.join(" ")}`.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Aufträge
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Alle diesem Projekt zugeordneten Aufträge. Ein Klick öffnet die bestehende Auftragsansicht.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Suchen (Auftragsnummer, Bezeichnung, Dienstleistung)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftragsnummer</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Proben</TableHead>
              <TableHead>Dienstleistungen</TableHead>
              <TableHead className="w-32">Fortschritt</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead>Abschluss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Keine Aufträge in diesem Projekt.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link to={`/orders/${r.id}`} className="text-primary hover:underline">
                      {r.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLE[r.status] || ""}>
                      {STATUS_LABEL[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.sampleCount}</TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-sm">
                      {r.services.length > 0 ? `${r.services.length} – ${r.services.join(", ")}` : "–"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground w-9 text-right">{r.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{d(r.createdAt)}</TableCell>
                  <TableCell>{d(r.completedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
