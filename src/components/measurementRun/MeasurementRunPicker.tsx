import { TaskOrderIdentity } from "@/components/orders/TaskOrderIdentity";
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { formatSampleDescription, normalizeSearchText } from "@/lib/orders/orderSamples";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ChevronDown, ChevronRight, HandshakeIcon, Pencil, PlayCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQualifiedServiceIds } from "@/hooks/useMeasurements";
import { canOpenExternalApp, externalAppForService } from "@/lib/externalApps";
import { ExternalAppButton } from "@/components/ExternalAppButton";

/**
 * Gruppenschlüssel des Messarbeitsplatzes – dynamisch aus vorhandenen Daten:
 * 1. Arbeitsplatz der Messung, 2. Standard-Arbeitsplatz der Dienstleistung,
 * 3. Fallback: Dienstleistung. Keine fest codierte Verfahrensliste.
 */
function runGroupOf(m: any): { key: string; label: string; isWorkstation: boolean } {
  const ws = m.workstations ?? m.measurement_services?.workstations;
  if (ws?.id) return { key: `ws:${ws.id}`, label: ws.name || "Arbeitsplatz", isWorkstation: true };
  const name = m.measurement_services?.service_name || "Ohne Dienstleistung";
  return { key: `svc:${m.service_id ?? name}`, label: name, isWorkstation: false };
}

type Item = any & { __free: boolean; __blocked?: string | null };

/**
 * Temporäre Zusammenstellung eines Messdurchlaufs aus eigenen zugewiesenen
 * UND freien, laut Kompetenzmatrix qualifizierten Aufgaben. Die Auswahl lebt
 * nur im Seitenzustand – Auswählen ändert keine Zuweisung. Beim Start werden
 * freie Aufgaben über die bestehende Übernahme (claim_measurement) übernommen;
 * nicht übernehmbare werden gemeldet und nicht in den Durchlauf aufgenommen.
 * `otherTasks` (fremd zugewiesen / ohne Qualifikation) sind nur sichtbar.
 */
export default function MeasurementRunPicker({
  tasks,
  freeTasks = [],
  otherTasks = [],
  claim,
  searchQuery = "",
}: {
  tasks: any[];
  freeTasks?: any[];
  otherTasks?: any[];
  claim?: (id: string) => Promise<unknown>;
  searchQuery?: string;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(["orders", "common"]);
  const { role } = useAuth();
  const { data: qualifiedServiceIds } = useQualifiedServiceIds();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [searchOpenOverrides, setSearchOpenOverrides] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const normalizedSearch = normalizeSearchText(searchQuery);
  const hasActiveSearch = normalizedSearch.length > 0;

  // Bei geändertem Suchbegriff manuelle Such-Overrides zurücksetzen, damit Treffergruppen automatisch aufklappen.
  useEffect(() => {
    setSearchOpenOverrides({});
  }, [normalizedSearch]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; isWorkstation: boolean; items: Item[] }>();
    const seen = new Set<string>();
    const add = (m: any, free: boolean, blocked: string | null = null) => {
      if (m.status === "completed" || seen.has(m.id)) return;
      seen.add(m.id);
      const g = runGroupOf(m);
      if (!map.has(g.key)) map.set(g.key, { label: g.label, isWorkstation: g.isWorkstation, items: [] });
      map.get(g.key)!.items.push({ ...m, __free: free, __blocked: blocked });
    };
    for (const m of tasks) add(m, false);
    if (claim) for (const m of freeTasks) add(m, true);
    for (const m of otherTasks)
      add(m, false, m.assigned_to ? `Zugewiesen: ${m.__assigneeName || "anderer Mitarbeiter"}` : "Keine Qualifikation");
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "de"));
  }, [tasks, freeTasks, otherTasks, claim]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (items: Item[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = items.every((m) => next.has(m.id));
      for (const m of items) {
        if (all) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });

  const start = async () => {
    // Reihenfolge wie angezeigt.
    const chosen = groups.flatMap(([, g]) => g.items).filter((m) => selected.has(m.id) && !m.__blocked);
    if (chosen.length === 0 || openingId) return;
    setStarting(true);
    const ok: string[] = [];
    const failed: string[] = [];
    try {
      for (const m of chosen) {
        if (!m.__free) {
          ok.push(m.id);
          continue;
        }
        try {
          await claim!(m.id);
          ok.push(m.id);
        } catch (err: any) {
          const msg = String(err?.message || "");
          const label = `${m.samples?.sample_number || m.measurement_number} (${m.measurement_orders ? orderIdentity(m.measurement_orders).number || "–" : "–"})`;
          const reason = msg.includes("already assigned")
            ? "inzwischen von einem anderen Mitarbeiter übernommen"
            : msg.includes("already completed")
              ? "bereits abgeschlossen"
              : msg.includes("not qualified")
                ? "keine Qualifikation"
                : msg || "Übernahme fehlgeschlagen";
          failed.push(`${label}: ${reason}`);
        }
      }
    } finally {
      setStarting(false);
    }
    if (failed.length > 0) {
      toast.warning(
        `${failed.length} ${failed.length === 1 ? "Probe ist" : "Proben sind"} nicht mehr verfügbar und ${failed.length === 1 ? "wurde" : "wurden"} nicht in den Messdurchlauf aufgenommen`,
        { description: failed.join("\n"), duration: 10000 },
      );
    }
    if (ok.length === 0) return;
    setSelected(new Set());
    navigate(`/aufgaben/${ok[0]}?run=${ok.join(",")}`);
  };

  const handleClaimAndEdit = async (m: Item) => {
    if (!claim || openingId || starting) return;
    setOpeningId(m.id);
    try {
      await claim(m.id);
      navigate(`/aufgaben/${m.id}`);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already assigned")) {
        toast.error("Bereits vergeben", {
          description: "Dieser Auftrag wurde soeben von einem anderen Mitarbeiter übernommen.",
        });
      } else if (msg.includes("already completed")) {
        toast.error("Bereits abgeschlossen", {
          description: "Diese Aufgabe ist bereits abgeschlossen.",
        });
      } else if (msg.includes("not qualified")) {
        toast.error("Nicht berechtigt", {
          description: "Für diese Dienstleistung fehlt die Qualifikation.",
        });
      } else {
        toast.error("Übernahme fehlgeschlagen", { description: msg || "Übernahme fehlgeschlagen" });
      }
    } finally {
      setOpeningId(null);
    }
  };

  const dateLocale = i18n.language === "en" ? "en-GB" : "de-AT";

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Messdurchlauf nach Arbeitsplatz</CardTitle>
        <Button size="sm" onClick={start} disabled={selected.size === 0 || starting || openingId !== null}>
          <PlayCircle className="h-4 w-4 mr-2" />
          {starting
            ? "Übernehme Aufgaben…"
            : `Messdurchlauf starten (${selected.size} ${selected.size === 1 ? "Probe" : "Proben"} ausgewählt)`}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Wähle beliebig viele Proben – auch aus verschiedenen Aufträgen. „Verfügbar" markierte Aufgaben werden beim
          Start automatisch übernommen. Die Auswahl selbst ist nur eine vorübergehende Arbeitszusammenstellung.
        </p>
        {groups.map(([key, g]) => {
          const isOpen = hasActiveSearch ? (searchOpenOverrides[key] ?? g.items.length > 0) : (open[key] ?? false);
          const selectable = g.items.filter((m) => !m.__blocked);
          const allSel = selectable.length > 0 && selectable.every((m) => selected.has(m.id));
          const someSel = selectable.some((m) => selected.has(m.id));
          const freeCount = g.items.filter((m) => m.__free).length;
          // Externe Fach-App (Extruder/Staucher): nur wenn die Gruppe eindeutig
          // einer konfigurierten Leistung entspricht und Master/Qualifikation vorliegt.
          const groupServiceNames = new Set(g.items.map((m) => m.measurement_services?.service_name).filter(Boolean));
          const groupServiceId = g.items.find((m) => m.service_id)?.service_id ?? null;
          const groupApp = groupServiceNames.size === 1
            ? externalAppForService([...groupServiceNames][0] as string)
            : null;
          const showGroupApp =
            !!groupApp && canOpenExternalApp(role, qualifiedServiceIds ?? null, groupServiceId);
          return (
            <div key={key} className="border rounded-md">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                <Checkbox
                  checked={allSel ? true : someSel ? "indeterminate" : false}
                  disabled={selectable.length === 0}
                  onCheckedChange={() => toggleGroup(selectable)}
                  aria-label={`Alle in ${g.label} auswählen`}
                />
                <button
                  type="button"
                  className="flex items-center gap-1 flex-1 text-left text-sm font-medium"
                  onClick={() =>
                    hasActiveSearch
                      ? setSearchOpenOverrides((p) => ({ ...p, [key]: !isOpen }))
                      : setOpen((p) => ({ ...p, [key]: !isOpen }))
                  }
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {g.label}
                  {!g.isWorkstation && (
                    <span className="text-xs font-normal text-muted-foreground">(kein Arbeitsplatz hinterlegt)</span>
                  )}
                </button>
                {freeCount > 0 && <Badge variant="secondary">{freeCount} verfügbar</Badge>}
                <Badge variant="outline">{g.items.length}</Badge>
                {showGroupApp && groupApp && (
                  <ExternalAppButton
                    app={groupApp}
                    url={groupApp.startUrl}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full caption-bottom text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="h-8 w-10 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_select", "Auswahl")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_sample_number", "Probennummer")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_sample_name", "Probenname")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_sample_description", "Probenbeschreibung")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_order_experiment", "Auftrag / Versuch")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_project", "Projekt")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_priority", "Priorität")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_due_date", "Fälligkeit")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap">{t("orders:myTasks.col_status", "Status")}</TableHead>
                        <TableHead className="h-8 px-2 text-xs whitespace-nowrap text-right">{t("orders:myTasks.col_action", "Aktion")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((m) => {
                        const rawDescription = m.samples?.description ?? null;
                        const description = formatSampleDescription(rawDescription);
                        const sampleNumber = m.samples?.sample_number?.trim() || "–";
                        const sampleName = m.samples?.sample_name?.trim() || "–";
                        const serviceName = m.measurement_services?.service_name || "–";
                        return (
                          <TableRow key={m.id} className={m.__blocked ? "opacity-60" : undefined}>
                            <TableCell className="px-2 py-2">
                              <Checkbox
                                checked={selected.has(m.id)}
                                disabled={!!m.__blocked}
                                onCheckedChange={() => !m.__blocked && toggle(m.id)}
                                aria-label={`Probe ${sampleNumber !== "–" ? sampleNumber : m.measurement_number} auswählen`}
                              />
                            </TableCell>
                            <TableCell className="px-2 py-2 font-mono whitespace-nowrap">{sampleNumber}</TableCell>
                            <TableCell className="px-2 py-2 min-w-[110px] max-w-[170px] whitespace-normal">
                              <div className="font-medium break-words leading-snug">{sampleName}</div>
                              <div className="text-[11px] text-muted-foreground break-words leading-snug">{serviceName}</div>
                            </TableCell>
                            <TableCell className="px-2 py-2 min-w-[120px] max-w-[210px] whitespace-normal">
                              {description ? (
                                <div
                                  className="line-clamp-2 break-words text-xs leading-snug text-foreground"
                                  title={rawDescription ?? description}
                                >
                                  {description}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap">
                              <TaskOrderIdentity order={m.measurement_orders} compact />
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                              {m.measurement_orders?.projects?.project_number || "–"}
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap">
                              <PriorityBadge ranking={m.ranking ?? m.measurement_orders?.ranking} />
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                              {m.due_date ? new Date(m.due_date).toLocaleDateString(dateLocale) : "–"}
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge status={m.status} />
                                <Badge
                                  variant={m.__free ? "secondary" : "outline"}
                                  className="max-w-36 justify-center truncate text-[11px]"
                                  title={m.__blocked || undefined}
                                >
                                  {m.__blocked
                                    ? m.__blocked
                                    : m.__free
                                      ? t("orders:myTasks.available", "Verfügbar")
                                      : t("orders:myTasks.assigned_to_me", "Mir zugewiesen")}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-2 whitespace-nowrap text-right">
                              {m.__blocked ? (
                                <span className="text-xs text-muted-foreground">–</span>
                              ) : m.__free && claim ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs"
                                  disabled={starting || openingId !== null}
                                  onClick={() => handleClaimAndEdit(m)}
                                >
                                  <HandshakeIcon className="h-3.5 w-3.5 mr-1.5" />
                                  {openingId === m.id
                                    ? t("orders:myTasks.claiming", "Übernehme…")
                                    : t("orders:myTasks.claim_and_edit", "Übernehmen & bearbeiten")}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 text-xs"
                                  disabled={starting || openingId !== null}
                                  onClick={() => navigate(`/aufgaben/${m.id}`)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                  {t("orders:myTasks.edit", "Bearbeiten")}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
