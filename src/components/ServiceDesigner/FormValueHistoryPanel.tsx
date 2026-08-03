import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";

const show = (v: unknown) => {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/**
 * Phase 4: Änderungshistorie von Formularwerten eines Auftrags
 * (Benutzer, Zeit, alter Wert, neuer Wert).
 */
export default function FormValueHistoryPanel({
  orderId,
  fieldKey,
  limit,
}: {
  orderId: string;
  fieldKey?: string;
  limit?: number;
}) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["form-value-history", orderId, fieldKey ?? null, limit ?? 200],
    queryFn: () => api.formValueHistory.listForOrder(orderId, { fieldKey, limit }),
    enabled: !!orderId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-basic"],
    queryFn: () => api.users.list(),
  });
  const userName = (id: string | null) => {
    if (!id) return "System";
    const u = (users as any[]).find((x) => x.id === id || x.user_id === id);
    return u?.full_name || u?.display_name || u?.email || "Unbekannt";
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <History className="h-4 w-4" /> Änderungshistorie
        <Badge variant="outline">{entries.length}</Badge>
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Zeitpunkt</TableHead>
            <TableHead className="w-40">Benutzer</TableHead>
            <TableHead>Feld</TableHead>
            <TableHead>Alter Wert</TableHead>
            <TableHead>Neuer Wert</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={5} className="text-xs text-muted-foreground">Lade…</TableCell></TableRow>
          )}
          {!isLoading && entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                Keine Änderungen protokolliert.
              </TableCell>
            </TableRow>
          )}
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-xs">{new Date(e.changed_at).toLocaleString("de-AT")}</TableCell>
              <TableCell className="text-xs">{userName(e.changed_by)}</TableCell>
              <TableCell className="text-xs">
                {e.field_label || e.field_key}
                <span className="block font-mono text-[10px] text-muted-foreground">{e.field_key}</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{show(e.old_value)}</TableCell>
              <TableCell className="text-xs font-medium">{show(e.new_value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
