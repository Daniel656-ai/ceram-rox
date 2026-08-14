import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock } from "lucide-react";

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

interface Props {
  samples: any[];
  orders: any[];
  sampleLinks: any[];
  etaMap: Map<string, Date>;
  statusBadge: (status: string) => JSX.Element;
}

export function ProjectSamplesTab({ samples, orders, sampleLinks, etaMap, statusBadge }: Props) {
  /** Probe → Aufträge / Dienstleistungen / Ersatzprobenbeziehung */
  const info = useMemo(() => {
    const map = new Map<string, {
      orders: { id: string; number: string }[];
      services: Set<string>;
      replacedBy: string | null;
      replacementFor: string | null;
    }>();
    const ensure = (id: string) => {
      let e = map.get(id);
      if (!e) { e = { orders: [], services: new Set(), replacedBy: null, replacementFor: null }; map.set(id, e); }
      return e;
    };

    const linkById = new Map<string, any>((sampleLinks || []).map((l: any) => [l.id, l]));
    for (const l of sampleLinks || []) {
      const e = ensure(l.sample_id);
      const num = l.measurement_orders?.order_number;
      if (num && !e.orders.some((o) => o.id === l.order_id)) {
        e.orders.push({ id: l.order_id, number: num });
      }
      if (l.replaced_by_order_sample_id) {
        const rep = linkById.get(l.replaced_by_order_sample_id);
        if (rep?.samples?.sample_number) e.replacedBy = rep.samples.sample_number;
      }
      if (l.is_replacement && l.replaces_order_sample_id) {
        const orig = linkById.get(l.replaces_order_sample_id);
        if (orig?.samples?.sample_number) e.replacementFor = orig.samples.sample_number;
      }
    }

    for (const o of orders || []) {
      for (const m of o.order_measurements || []) {
        const sid = m.sample_id || o.sample_id;
        if (!sid) continue;
        const e = ensure(sid);
        if (!e.orders.some((x) => x.id === o.id)) e.orders.push({ id: o.id, number: o.order_number });
        if (m.measurement_services?.service_name) e.services.add(m.measurement_services.service_name);
      }
    }
    return map;
  }, [orders, sampleLinks]);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Seriennummer</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lagerort</TableHead>
              <TableHead>Aufträge</TableHead>
              <TableHead>Gebuchte Dienstleistungen</TableHead>
              <TableHead>Ersatzprobe</TableHead>
              <TableHead>Gefahr</TableHead>
              <TableHead>ETA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Keine Proben</TableCell></TableRow>
            ) : (
              samples.map((s: any) => {
                const eta = etaMap.get(s.id);
                const e = info.get(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link to={`/proben/${s.id}`} className="text-primary hover:underline">{s.sample_number}</Link>
                    </TableCell>
                    <TableCell>{s.sample_name}</TableCell>
                    <TableCell>
                      {statusBadge(s.status)}
                      {s.status === "entsorgt" && s.disposal_method && (
                        <span className="ml-2 text-xs text-muted-foreground">{s.disposal_method}</span>
                      )}
                    </TableCell>
                    <TableCell>{formatLocation(s.storage_locations)}</TableCell>
                    <TableCell className="space-x-1">
                      {e?.orders.length ? e.orders.map((o) => (
                        <Link key={o.id} to={`/orders/${o.id}`} className="text-primary hover:underline text-sm">
                          {o.number}
                        </Link>
                      )) : "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e && e.services.size > 0 ? Array.from(e.services).join(", ") : "–"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e?.replacedBy && <Badge variant="outline">ersetzt durch {e.replacedBy}</Badge>}
                      {e?.replacementFor && <Badge variant="outline">Ersatz für {e.replacementFor}</Badge>}
                      {!e?.replacedBy && !e?.replacementFor && "–"}
                    </TableCell>
                    <TableCell>{s.is_hazardous && <AlertTriangle className="h-4 w-4 text-destructive" />}</TableCell>
                    <TableCell>
                      {eta ? (
                        <Badge variant="outline" className="gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {eta.toLocaleDateString("de-DE")}
                        </Badge>
                      ) : "–"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
