import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Plus, Search, FileUp, Settings2, FileText } from "lucide-react";
import {
  RELEASE_STATUS_LABEL, RELEASE_STATUS_COLOR, RELEASE_STATUSES,
} from "@/lib/productionRelease/fields";
import {
  useProductionReleases, useProductionReleasePermissions, useSaveRelease, useReleaseSettings,
} from "@/hooks/useProductionReleases";
import { ImportPdfDialog } from "@/components/productionRelease/ImportPdfDialog";

function fmtDate(v?: string | null) {
  if (!v) return "–";
  return new Date(v).toLocaleDateString("de-AT");
}

export default function ProductionReleasesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const perms = useProductionReleasePermissions();
  const { data: releases = [], isLoading } = useProductionReleases();
  const { data: settings } = useReleaseSettings();
  const save = useSaveRelease();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
    return releases.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.project_name, r.customer_name, r.article_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [releases, search, statusFilter]);

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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Artikelnummer</TableHead>
                <TableHead>Fertigstellung</TableHead>
                <TableHead>Liefertermin</TableHead>
                <TableHead className="text-right">Stückzahl</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Bearbeitet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="text-muted-foreground">Wird geladen …</TableCell></TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="font-medium">{r.project_name || "–"}</TableCell>
                  <TableCell>{r.customer_name || "–"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.article_number || "–"}</TableCell>
                  <TableCell>{fmtDate(r.completion_date)}</TableCell>
                  <TableCell>{fmtDate(r.delivery_date)}</TableCell>
                  <TableCell className="text-right">{r.piece_count ?? "–"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={RELEASE_STATUS_COLOR[r.status]}>
                      {RELEASE_STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
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
        onImported={async ({ values, testParameters, fileName, storagePath, rawText }) => {
          try {
            const now = new Date().toISOString();
            const fieldSources = Object.fromEntries(
              Object.keys(values).map((k) => [k, { source: "pdf", at: now, by: user?.id ?? null, document: fileName }])
            );
            const id = await save.mutateAsync({
              values: {
                ...values,
                status: "entwurf",
                source_type: "pdf",
                source_document_path: storagePath,
                source_document_name: fileName,
                field_sources: fieldSources,
                imported_at: now,
                imported_by: user?.id ?? null,
                created_by: user?.id ?? null,
                form_definition_id: settings?.default_form_definition_id ?? null,
              },
              testParameters: testParameters.map((t) => ({ ...t, source_type: "pdf" })),
            });
            await api.productionReleases.logImport({
              releaseId: id, fileName, storagePath, rawText,
              extracted: { values, testParameters }, importedBy: user?.id ?? null,
            });
            toast.success("Fertigungsfreigabe aus PDF erstellt.");
            navigate(`/fertigungsfreigaben/${id}`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
          }
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
