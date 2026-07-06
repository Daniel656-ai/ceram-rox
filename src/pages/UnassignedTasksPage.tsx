import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useUnassignedQualifiedMeasurements,
  useClaimMeasurement,
} from "@/hooks/useMeasurements";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Search, HandshakeIcon, Inbox } from "lucide-react";

/**
 * "Nicht zugewiesene Aufträge" – free-task pool for qualified technicians.
 *
 * Lists all measurement tasks with `assigned_to IS NULL` that the current user
 * is qualified for via the competence matrix (mdl_service_permissions).
 * A single "Auftrag übernehmen" click claims the task transactionally through
 * the `claim_measurement` RPC; racing users see a proper "already assigned"
 * error and the row disappears from all other pools.
 */
export default function UnassignedTasksPage() {
  const { role } = useAuth();
  const { i18n } = useTranslation();
  const { data: tasks = [], isLoading } = useUnassignedQualifiedMeasurements();
  const claim = useClaimMeasurement();
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return (tasks as any[]).filter(
      (m) =>
        m.measurement_number?.toLowerCase().includes(q) ||
        m.measurement_services?.service_name?.toLowerCase().includes(q) ||
        m.measurement_orders?.order_number?.toLowerCase().includes(q) ||
        m.measurement_orders?.projects?.project_number?.toLowerCase().includes(q) ||
        m.measurement_orders?.projects?.project_name?.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const handleClaim = async (id: string, label: string) => {
    setClaimingId(id);
    try {
      await claim.mutateAsync(id);
      toast.success(`Auftrag „${label}" übernommen`);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already assigned")) {
        toast.error("Bereits vergeben", {
          description: "Dieser Auftrag wurde soeben von einem anderen Mitarbeiter übernommen.",
        });
      } else if (msg.includes("not qualified")) {
        toast.error("Nicht berechtigt", {
          description: "Für diese Dienstleistung fehlt die Qualifikation.",
        });
      } else {
        toast.error("Übernahme fehlgeschlagen", { description: msg });
      }
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-6 w-6" /> Nicht zugewiesene Aufträge
        </h1>
        <p className="text-muted-foreground">
          {role === "master"
            ? "Alle offenen, noch nicht zugewiesenen Aufträge."
            : "Aufträge, für die du laut Kompetenzmatrix qualifiziert bist. Übernehme einen Auftrag, um ihn deiner Aufgabenliste hinzuzufügen."}
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="self-center">
          {filtered.length} {filtered.length === 1 ? "Auftrag" : "Aufträge"}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aufgaben-Nr.</TableHead>
                <TableHead>Dienstleistung</TableHead>
                <TableHead>Arbeitsplatz</TableHead>
                <TableHead>Auftrag</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Fällig</TableHead>
                <TableHead className="w-[180px] text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Wird geladen...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aktuell keine freien Aufträge für deine Qualifikationen.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">
                      {m.measurement_number}
                    </TableCell>
                    <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                    <TableCell>{m.workstations?.name || "–"}</TableCell>
                    <TableCell className="font-mono">
                      <Link
                        to={`/auftraege/${m.order_id}`}
                        className="text-primary hover:underline"
                      >
                        {m.measurement_orders?.order_number || "–"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {m.measurement_orders?.projects?.project_number ? (
                        <Link
                          to={`/projekte/${m.measurement_orders.project_id}`}
                          className="text-destructive underline underline-offset-2 hover:opacity-80"
                        >
                          {m.measurement_orders.projects.project_number}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge ranking={m.ranking ?? m.measurement_orders?.ranking} />
                    </TableCell>
                    <TableCell>
                      {m.due_date
                        ? new Date(m.due_date).toLocaleDateString(
                            i18n.language === "en" ? "en-GB" : "de-DE"
                          )
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={claimingId === m.id}
                        onClick={() =>
                          handleClaim(
                            m.id,
                            m.measurement_services?.service_name || m.measurement_number
                          )
                        }
                      >
                        <HandshakeIcon className="h-4 w-4 mr-2" />
                        {claimingId === m.id ? "Übernehme..." : "Auftrag übernehmen"}
                      </Button>
                    </TableCell>
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
