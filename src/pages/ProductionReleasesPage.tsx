import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, RotateCcw, Search, FileUp, Settings2, FileText } from "lucide-react";
import {
  RELEASE_STATUS_LABEL, RELEASE_STATUS_COLOR, RELEASE_STATUSES, isReviewRequired,
} from "@/lib/productionRelease/fields";
import {
  useProductionReleases, useProductionReleasePermissions, useSaveRelease, useReleaseSettings,
} from "@/hooks/useProductionReleases";
import { ImportPdfDialog } from "@/components/productionRelease/ImportPdfDialog";
import { SortableHead } from "@/components/list/SortableHead";
import { useListSort } from "@/lib/list/listSorting";

function fmtDate(v?: string | null) {
  if (!v) return "–";
  return new Date(v).toLocaleDateString("de-AT");
}

type ReleaseSortKey =
  | "release" | "project_name" | "customer_name" | "article_number"
  | "completion_date" | "delivery_date" | "piece_count" | "status" | "created_at" | "updated_at";

const RELEASE_SORT_TYPE: Record<ReleaseSortKey, "text" | "number" | "date"> = {
  release: "text",
  project_name: "text",
  customer_name: "text",
  article_number: "text",
  completion_date: "date",
  delivery_date: "date",
  piece_count: "number",
  status: "text",
  created_at: "date",
  updated_at: "date",
};

export default function ProductionReleasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perms = useProductionReleasePermissions();
  const { data: releases = [], isLoading } = useProductionReleases();
  const { data: settings } = useReleaseSettings();
  const save = useSaveRelease();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const sort = useListSort<ReleaseSortKey>({
    initialKey: "updated_at",
    initialDir: "desc",
    storageKey: "productionReleases.listPrefs",
  });
  const [importOpen, setImportOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [noFormOpen, setNoFormOpen] = useState(false);
  const [formId, setFormId] = useState<string>("__none__");

  const { data: forms = [] } = useQuery({
    queryKey: ["form-definitions", "global"],
    queryFn: () => api.formDefinitions.list({ scope: "global" }),
    enabled: perms.canConfigure,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = releases.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.project_name, r.customer_name, r.article_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // Sortierung wie in der Rohstoffliste (gemeinsame Logik).
    return sort.sortRows(
      rows,
      (r: any, key) => {
        if (key === "release") return `${r.release_number ?? ""} ${String(r.revision_number ?? 0).padStart(4, "0")}`;
        if (key === "status") return RELEASE_STATUS_LABEL[r.status] ?? r.status;
        return r[key];
      },
      (key) => RELEASE_SORT_TYPE[key]
    );
  }, [releases, search, statusFilter, sort]);

  const createRelease = async (
    extra?: { values: Record<string, unknown>; testParameters?: never[] }
  ) => {
    try {
      const id = await save.mutateAsync({
        values: {
          status: "entwurf",
          source_type: "manual",
          created_by: user?.id ?? null,
          form_definition_id: settings?.default_form_definition_id ?? null,
          ...(extra?.values ?? {}),
        },
      });
      navigate(`/fertigungsfreigaben/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anlegen fehlgeschlagen");
    }
  };

  const onCreateClick = () => {
    if (!settings?.default_form_definition_id) {
      setNoFormOpen(true);
      return;
    }
    createRelease();
  };

  if (!perms.canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Für Fertigungsfreigaben fehlt die Berechtigung.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fertigungsfreigaben</h1>
          <p className="text-sm text-muted-foreground">
            Zentrale Erfassung, Prüfung und Freigabe von Fertigungsfreigaben.
          </p>
        </div>
        <div className="flex gap-2">
          {perms.canConfigure && (
            <Button
              variant="outline"
              onClick={() => { setFormId(settings?.default_form_definition_id ?? "__none__"); setConfigOpen(true); }}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Formular zuordnen
            </Button>
          )}
          {perms.canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4 mr-2" /> PDF importieren
            </Button>
          )}
          {perms.canCreate && (
            <Button onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-2" /> Fertigungsfreigabe anlegen
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Übersicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Projekt, Kunde oder Artikelnummer suchen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {RELEASE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{RELEASE_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!search && statusFilter === "all"}
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Filter zurücksetzen
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {([
                  ["release", "Freigabe / Rev.", ""],
                  ["project_name", "Projekt", ""],
                  ["customer_name", "Kunde", ""],
                  ["article_number", "Artikelnummer", ""],
                  ["completion_date", "Fertigstellung", ""],
                  ["delivery_date", "Liefertermin", ""],
                  ["piece_count", "Stückzahl", "text-right"],
                  ["status", "Status", ""],
                  ["created_at", "Erstellt", ""],
                  ["updated_at", "Bearbeitet", ""],
                ] as Array<[ReleaseSortKey, string, string]>).map(([key, label, cls]) => (
                  <SortableHead
                    key={key}
                    columnKey={key}
                    sortKey={sort.sortKey}
                    sortDir={sort.sortDir}
                    onToggle={sort.toggleSort}
                    className={cls}
                  >
                    {label}
                  </SortableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={10} className="text-muted-foreground">Wird geladen …</TableCell></TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Noch keine Fertigungsfreigaben vorhanden.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/fertigungsfreigaben/${r.id}`)}
                >
                  <TableCell className="text-xs">
                    <div className="font-mono">{(r.release_number as string) || "–"}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline">Rev. {Number(r.revision_number) || 0}</Badge>
                      {r.is_current === false && !r.superseded_at && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Freigabe ausstehend
                        </Badge>
                      )}
                      {r.is_current === false && !!r.superseded_at && (
                        <Badge variant="outline" className="text-muted-foreground">historisch</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{r.project_name || "–"}</TableCell>
                  <TableCell>{r.customer_name || "–"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.article_number || "–"}</TableCell>
                  <TableCell>{fmtDate(r.completion_date)}</TableCell>
                  <TableCell>{fmtDate(r.delivery_date)}</TableCell>
                  <TableCell className="text-right">{r.piece_count ?? "–"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={RELEASE_STATUS_COLOR[r.status]}>
                        {RELEASE_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      {isReviewRequired(r) && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Prüfung erforderlich
                        </Badge>
                      )}
                      {r.import_status === "reviewed" && (
                        <Badge variant="outline" className="text-muted-foreground">geprüft</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(r.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </CardContent>
      </Card>

      <ImportPdfDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={({ releaseId, isRevision, revisionNumber, pendingCount }) => {
          // Erst NACH erfolgreicher Speicherung: bestehende Listen-Query
          // invalidieren, damit die neue/aktualisierte Freigabe sofort
          // erscheint – ohne Browser-Reload und ohne zweite Datenquelle.
          queryClient.invalidateQueries({ queryKey: ["production-releases"] });
          queryClient.invalidateQueries({ queryKey: ["production-release", releaseId] });
          queryClient.invalidateQueries({ queryKey: ["production-release-revisions"] });
          toast.success(
            isRevision
              ? `Revision ${revisionNumber} angelegt – der bisherige Stand bleibt gültig, bis Sie die Revision freigeben.${pendingCount ? ` ${pendingCount} Angabe(n) benötigen zuvor eine Prüfung.` : ""}`
              : `Fertigungsfreigabe aus PDF erstellt.${pendingCount ? ` ${pendingCount} Angabe(n) benötigen eine Prüfung.` : ""}`,
            { duration: 8000 }
          );
          navigate(`/fertigungsfreigaben/${releaseId}`);
        }}
      />

      {/* Formularzuordnung */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formular für Fertigungsfreigaben</DialogTitle>
            <DialogDescription>
              Das Erfassungsformular stammt aus dem bestehenden Formulardesigner und kann dort
              jederzeit angepasst werden.
            </DialogDescription>
          </DialogHeader>
          <Select value={formId} onValueChange={setFormId}>
            <SelectTrigger><SelectValue placeholder="Formular wählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Kein Formular</SelectItem>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Abbrechen</Button>
            <Button
              onClick={async () => {
                await api.productionReleases.setDefaultForm(
                  formId === "__none__" ? null : formId, user?.id ?? null
                );
                toast.success("Formularzuordnung gespeichert.");
                setConfigOpen(false);
                window.location.reload();
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kein Formular hinterlegt */}
      <Dialog open={noFormOpen} onOpenChange={setNoFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Noch kein Formular hinterlegt</DialogTitle>
            <DialogDescription>
              Für Fertigungsfreigaben ist bisher kein Formular aus dem Formulardesigner zugeordnet.
              Sie können jetzt eines zuordnen oder die Freigabe zunächst mit den Standardfeldern anlegen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {perms.canConfigure && (
              <Button variant="outline" onClick={() => { setNoFormOpen(false); setConfigOpen(true); }}>
                <Settings2 className="h-4 w-4 mr-2" /> Formular zuordnen
              </Button>
            )}
            <Button onClick={() => { setNoFormOpen(false); createRelease(); }}>
              <FileText className="h-4 w-4 mr-2" /> Ohne Formular anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
