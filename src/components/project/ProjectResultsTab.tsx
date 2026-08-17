import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export interface ProjectResultRow {
  id: string;
  sampleNumber: string;
  sampleName: string;
  originalSampleNumber: string | null;
  orderId: string;
  orderNumber: string;
  serviceName: string;
  parameter: string;
  value: number | null;
  unit: string | null;
  measuredAt: string | null;
  releasedAt: string | null;
  assignedTo: string | null;
  status: string;
}

/** Baut die Zeilen der Ergebnistabelle – ausschließlich offizielle Ergebnisse. */
export function buildProjectResultRows(raw: any[], getUserName: (id: string) => string): ProjectResultRow[] {
  const rows: ProjectResultRow[] = [];
  for (const m of raw || []) {
    for (const r of m.measurement_results || []) {
      if (!r.is_official) continue;
      rows.push({
        id: r.id,
        sampleNumber: m.samples?.sample_number || "–",
        sampleName: m.samples?.sample_name || "",
        originalSampleNumber:
          m.original_sample?.sample_number && m.original_sample.sample_number !== m.samples?.sample_number
            ? m.original_sample.sample_number
            : null,
        orderId: m.measurement_orders?.id,
        orderNumber: m.measurement_orders?.order_number || "–",
        serviceName: m.measurement_services?.service_name || "–",
        parameter: (r.display_label || r.result_name) + (r.unit ? ` (${r.unit})` : ""),
        value: r.value,
        unit: r.unit,
        measuredAt: r.measured_at,
        releasedAt: m.updated_at,
        assignedTo: m.assigned_to ? getUserName(m.assigned_to) : null,
        status: m.status,
      });
    }
  }
  return rows;
}

const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("de-DE") : "–");

interface Props {
  rows: ProjectResultRow[];
}

export function ProjectResultsTab({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [sampleFilter, setSampleFilter] = useState("__all__");
  const [orderFilter, setOrderFilter] = useState("__all__");
  const [serviceFilter, setServiceFilter] = useState("__all__");
  const [paramFilter, setParamFilter] = useState("__all__");

  const opts = useMemo(() => ({
    samples: Array.from(new Set(rows.map((r) => r.sampleNumber))).sort(),
    orders: Array.from(new Set(rows.map((r) => r.orderNumber))).sort(),
    services: Array.from(new Set(rows.map((r) => r.serviceName))).sort(),
    params: Array.from(new Set(rows.map((r) => r.parameter))).sort(),
  }), [rows]);

  const filtered = rows.filter((r) => {
    if (sampleFilter !== "__all__" && r.sampleNumber !== sampleFilter) return false;
    if (orderFilter !== "__all__" && r.orderNumber !== orderFilter) return false;
    if (serviceFilter !== "__all__" && r.serviceName !== serviceFilter) return false;
    if (paramFilter !== "__all__" && r.parameter !== paramFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.sampleNumber} ${r.sampleName} ${r.orderNumber} ${r.serviceName} ${r.parameter}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Ergebnisse
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Es werden ausschließlich Werte angezeigt, die ausdrücklich als „offizielles Ergebnis"
          freigegeben wurden. Ein erledigter Auftrag allein erzeugt hier keinen Eintrag.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Select value={sampleFilter} onValueChange={setSampleFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Probe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Proben</SelectItem>
              {opts.samples.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={orderFilter} onValueChange={setOrderFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Auftrag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Aufträge</SelectItem>
              {opts.orders.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Dienstleistung" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Dienstleistungen</SelectItem>
              {opts.services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paramFilter} onValueChange={setParamFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Parameter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Parameter</SelectItem>
              {opts.params.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Probe</TableHead>
              <TableHead>Auftrag</TableHead>
              <TableHead>Dienstleistung</TableHead>
              <TableHead>Parameter</TableHead>
              <TableHead className="text-right">Offizielles Ergebnis</TableHead>
              <TableHead>Einheit</TableHead>
              <TableHead>Messdatum</TableHead>
              <TableHead>Freigabe</TableHead>
              <TableHead>Bearbeiter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Keine offiziellen Ergebnisse vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.sampleNumber}
                    {r.originalSampleNumber && (
                      <Badge variant="outline" className="ml-2">Ersatz für {r.originalSampleNumber}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to={`/orders/${r.orderId}`} className="text-primary hover:underline">{r.orderNumber}</Link>
                  </TableCell>
                  <TableCell>{r.serviceName}</TableCell>
                  <TableCell>{r.parameter}</TableCell>
                  <TableCell className="text-right">{r.value != null ? r.value : "–"}</TableCell>
                  <TableCell>{r.unit || "–"}</TableCell>
                  <TableCell>{d(r.measuredAt)}</TableCell>
                  <TableCell>{d(r.releasedAt)}</TableCell>
                  <TableCell>{r.assignedTo || "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">{filtered.length} offizielle Ergebnisse</p>
      </CardContent>
    </Card>
  );
}
