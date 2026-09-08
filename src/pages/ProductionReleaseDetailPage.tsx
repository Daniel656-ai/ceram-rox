import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, Trash2, FileDown, Plus, AlertTriangle, History, ShieldCheck } from "lucide-react";
import {
  RELEASE_FIELDS, RELEASE_FIELD_GROUPS, RELEASE_STATUS_LABEL, RELEASE_STATUS_COLOR,
  RELEASE_STATUS_FLOW, TEST_SECTIONS, TEST_PARAMETERS, TEST_SECTION_LABEL,
  TEST_PARAMETER_LABEL, coerceFieldValue, isReviewRequired,
} from "@/lib/productionRelease/fields";
import {
  useProductionRelease, useReleaseTestParameters, useProductionReleasePermissions,
  useSaveRelease, useDeleteRelease, useCustomers, useReleaseChanges, useReleaseRevisions,
  useReleaseSpecSets, useCompleteRelease,
} from "@/hooks/useProductionReleases";
import { describeSaveError } from "@/lib/productionRelease/specSets";
import { ReviewChangesDialog } from "@/components/productionRelease/ReviewChangesDialog";
import { SpecSetsEditor } from "@/components/productionRelease/SpecSetsEditor";
import { releaseTypeLabel } from "@/lib/productionRelease/releaseTypes";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";

const NONE = "__none__";

export default function ProductionReleaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perms = useProductionReleasePermissions();
  const { data: release, isLoading } = useProductionRelease(id);
  const { data: storedTests = [] } = useReleaseTestParameters(id);
  const { data: specSets = [] } = useReleaseSpecSets(id);
  const { data: customers = [] } = useCustomers();
  const save = useSaveRelease();
  const del = useDeleteRelease();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<ProductionReleaseTestParameter[]>([]);
  const [customerId, setCustomerId] = useState<string>(NONE);
  const [projectId, setProjectId] = useState<string>(NONE);
  const [reviewOpen, setReviewOpen] = useState(false);

  const rootId = (release?.root_release_id as string | undefined) ?? release?.id;
  const { data: changes = [] } = useReleaseChanges(id);
  const { data: revisions = [] } = useReleaseRevisions(rootId);
  const completeRel = useCompleteRelease();
  const pendingChanges = changes.filter((c) => c.status === "pending");
  const appliedChanges = changes.filter((c) => c.status !== "pending" && c.status !== "dismissed");
  const openSpecValues = specSets.flatMap((s) => s.values).filter((v) => v.needs_review && !v.confirmed_at).length;
  /** Revision importiert, aber noch nicht als gültiger Stand freigegeben */
  const awaitingRelease = !!release && release.is_current === false && !release.superseded_at;
  const canReleaseNow = awaitingRelease && !pendingChanges.length && !openSpecValues;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-lookup-release"],
    queryFn: () => api.projects.list(),
  });

  useEffect(() => {
    if (!release) return;
    const next: Record<string, string> = {};
    for (const f of RELEASE_FIELDS) {
      const v = release[f.key];
      next[f.key] = v === null || v === undefined ? "" : String(v);
    }
    setValues(next);
    setCustomerId(release.customer_id ?? NONE);
    setProjectId(release.project_id ?? NONE);
  }, [release]);

  useEffect(() => { setTests(storedTests); }, [storedTests]);

  const readOnly = !perms.canEdit;
  const sourceMap = (release?.field_sources ?? {}) as Record<string, { source?: string }>;

  const nextStatuses = useMemo(
    () => RELEASE_STATUS_FLOW[release?.status ?? "entwurf"] ?? [],
    [release?.status]
  );

  const handleSave = async () => {
    if (!id || !release) return;
    const out: Record<string, unknown> = {};
    const sources: Record<string, unknown> = { ...(release.field_sources ?? {}) };
    const now = new Date().toISOString();
    for (const f of RELEASE_FIELDS) {
      const coerced = coerceFieldValue(f.key, values[f.key]);
      out[f.key] = coerced === "" ? null : coerced;
      const before = release[f.key];
      const changed = String(before ?? "") !== String(coerced ?? "");
      if (changed) {
        const prev = sourceMap[f.key]?.source;
        sources[f.key] = {
          source: prev === "pdf" || prev === "edited" ? "edited" : "manual",
          at: now,
          by: user?.id ?? null,
        };
      }
    }
    out.customer_id = customerId === NONE ? null : customerId;
    out.project_id = projectId === NONE ? null : projectId;
    out.field_sources = sources;
    out.updated_by = user?.id ?? null;
    try {
      await save.mutateAsync({
        id,
        values: out,
        testParameters: tests.filter((t) => (t.value_text ?? "").trim() !== ""),
      });
      toast.success("Fertigungsfreigabe gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  };

  const setStatus = async (status: string) => {
    if (!id) return;
    if (status === "abgeschlossen") {
      // Abschließen = Prüfung erledigt + Status abgeschlossen + Revision aktuell (atomar im Backend)
      try {
        const res = await completeRel.mutateAsync(id);
        toast.success(
          res.promoted
            ? `Revision ${Number(res.revision_number) || 0} abgeschlossen – sie ist jetzt der aktuelle Stand.`
            : "Fertigungsfreigabe abgeschlossen – Prüfung erledigt."
        );
      } catch (e) {
        toast.error(`Abschluss nicht möglich. ${describeSaveError(e)}`, { duration: 12000 });
      }
      return;
    }
    const extra: Record<string, unknown> = { status };
    if (status === "freigegeben") {
      extra.released_at = new Date().toISOString();
      extra.released_by = user?.id ?? null;
    }
    await save.mutateAsync({ id, values: extra });
    toast.success(`Status: ${RELEASE_STATUS_LABEL[status] ?? status}`);
  };
  const canComplete = !pendingChanges.length && !openSpecValues;

  const addTestRow = () =>
    setTests((p) => [...p, { section: "nox_bench", parameter_key: "flowrate", value_text: "", unit: "" }]);

  if (!perms.canView) {
    return <div className="p-6 text-muted-foreground">Keine Berechtigung für Fertigungsfreigaben.</div>;
  }
  if (isLoading || !release) {
    return <div className="p-6 text-muted-foreground">Wird geladen …</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {!!pendingChanges.length && (
        <Alert className="border-amber-500/60 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Prüfung erforderlich</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              ROX konnte bei dieser Revision nicht alle Änderungen eindeutig erkennen.{" "}
              {pendingChanges.length} Angabe(n) benötigen Ihre Prüfung.
            </span>
            <Button size="sm" onClick={() => setReviewOpen(true)}>Änderungen prüfen</Button>
          </AlertDescription>
        </Alert>
      )}

      {awaitingRelease && (
        <Alert className={canReleaseNow ? "border-primary/60" : "border-amber-500/60 bg-amber-50 dark:bg-amber-900/20"}>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Revision noch nicht abgeschlossen</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {canReleaseNow
                ? "Alle Prüfpunkte sind erledigt. Mit „Abschließen“ wird diese Revision zum aktuellen gültigen Stand und die Prüfung als erledigt markiert; die bisherige Revision bleibt als Historie erhalten."
                : `Der bisherige Stand bleibt gültig, bis diese Revision abgeschlossen wird. Offen: ${pendingChanges.length} Prüfpunkt(e)${openSpecValues ? `, ${openSpecValues} unsichere Vorgabe(n)` : ""}.`}
            </span>
            {perms.canApprove && (
              <Button size="sm" onClick={() => setStatus("abgeschlossen")} disabled={!canReleaseNow || completeRel.isPending}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {completeRel.isPending ? "Wird abgeschlossen …" : "Abschließen"}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fertigungsfreigaben")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {values.project_name || "Fertigungsfreigabe"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className={RELEASE_STATUS_COLOR[release.status]}>
                {RELEASE_STATUS_LABEL[release.status] ?? release.status}
              </Badge>
              {!!release.release_number && (
                <span className="font-mono">{String(release.release_number)}</span>
              )}
              <Badge variant="secondary">{releaseTypeLabel(release.release_type as string | null)}</Badge>
              <Badge variant="outline">Rev. {Number(release.revision_number) || 0}</Badge>
              <Badge
                variant="outline"
                className={
                  awaitingRelease
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : release.is_current === false ? "text-muted-foreground" : ""
                }
              >
                {awaitingRelease
                  ? "Revision – Freigabe ausstehend"
                  : release.is_current === false ? "historische Revision" : "aktuelle Revision"}
              </Badge>
              {isReviewRequired(release) && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {release.status === "in_pruefung" ? "Prüfung erforderlich – Prüfung läuft" : "Prüfung erforderlich"}
                </Badge>
              )}
              {release.import_status === "reviewed" && <Badge variant="outline">geprüft</Badge>}
              <span>{release.source_type === "pdf" ? "aus PDF importiert" : "manuell erfasst"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {release.source_document_path && (
            <Button
              variant="outline"
              onClick={async () => {
                const url = await api.productionReleases.documentUrl(release.source_document_path as string);
                if (url) window.open(url, "_blank");
              }}
            >
              <FileDown className="h-4 w-4 mr-2" /> Quelldokument
            </Button>
          )}
          {perms.canApprove &&
            nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === "abgeschlossen" ? "default" : "outline"}
                disabled={s === "abgeschlossen" && (!canComplete || completeRel.isPending)}
                title={
                  s === "abgeschlossen" && !canComplete
                    ? "Erst alle Prüfpunkte und unsicheren Vorgaben erledigen."
                    : undefined
                }
                onClick={() => setStatus(s)}
              >
                {s === "abgeschlossen" ? "Abschließen" : RELEASE_STATUS_LABEL[s]}
              </Button>
            ))}
          {perms.canDelete && (
            <Button
              variant="outline"
              onClick={async () => {
                await del.mutateAsync(release.id);
                navigate("/fertigungsfreigaben");
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Löschen
            </Button>
          )}
          {!readOnly && (
            <Button onClick={handleSave} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" /> Speichern
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">Daten</TabsTrigger>
          <TabsTrigger value="tests">Prüf- & Messvorgaben</TabsTrigger>
          <TabsTrigger value="revisions">
            Revisionen{revisions.length > 1 ? ` (${revisions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="links">Verknüpfungen</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="space-y-6 pt-4">
          {RELEASE_FIELD_GROUPS.map((g) => (
            <Card key={g.key}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{g.labelDe}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {RELEASE_FIELDS.filter((f) => f.group === g.key).map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "md:col-span-2 lg:col-span-3" : ""}>
                    <Label className="flex items-center gap-2">
                      {f.labelDe}{f.unit ? ` (${f.unit})` : ""}
                      {sourceMap[f.key]?.source === "pdf" && (
                        <Badge variant="secondary" className="text-[10px]">PDF</Badge>
                      )}
                      {sourceMap[f.key]?.source === "edited" && (
                        <Badge variant="secondary" className="text-[10px]">geändert</Badge>
                      )}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        className="mt-1"
                        rows={3}
                        disabled={readOnly}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        className="mt-1"
                        type={f.type === "date" ? "date" : "text"}
                        disabled={readOnly}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tests" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Vorgaben – {releaseTypeLabel(release.release_type as string | null)} (Rev. {Number(release.revision_number) || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SpecSetsEditor
                releaseType={(release.release_type as string | null) ?? ""}
                sets={specSets}
                readOnly
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Prüf- und Messvorgaben (Beiblatt)</CardTitle>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={addTestRow}>
                  <Plus className="h-4 w-4 mr-2" /> Zeile
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">Prüfung</TableHead>
                    <TableHead className="w-56">Parameter</TableHead>
                    <TableHead>Wert</TableHead>
                    <TableHead className="w-28">Einheit</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tests.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                        Keine Prüfvorgaben erfasst.
                      </TableCell>
                    </TableRow>
                  )}
                  {tests.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select
                          value={t.section}
                          disabled={readOnly}
                          onValueChange={(v) => setTests((p) => p.map((x, j) => (j === i ? { ...x, section: v } : x)))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TEST_SECTIONS.map((s) => (
                              <SelectItem key={s.key} value={s.key}>{s.labelDe}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.parameter_key}
                          disabled={readOnly}
                          onValueChange={(v) =>
                            setTests((p) => p.map((x, j) => (j === i ? { ...x, parameter_key: v } : x)))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TEST_PARAMETERS.map((s) => (
                              <SelectItem key={s.key} value={s.key}>{s.labelDe}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={readOnly}
                          value={t.value_text ?? ""}
                          onChange={(e) =>
                            setTests((p) => p.map((x, j) => (j === i ? { ...x, value_text: e.target.value } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={readOnly}
                          value={t.unit ?? ""}
                          onChange={(e) =>
                            setTests((p) => p.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTests((p) => p.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!!tests.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  Werte werden strukturiert je Prüfung ({TEST_SECTION_LABEL.nox_bench}, …) und
                  Parameter ({TEST_PARAMETER_LABEL.flowrate}, …) gespeichert.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisions" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Revisionshistorie</CardTitle>
              {!!pendingChanges.length && (
                <Button size="sm" onClick={() => setReviewOpen(true)}>
                  <AlertTriangle className="h-4 w-4 mr-2" /> Änderungen prüfen
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Revision</TableHead>
                    <TableHead>Änderungsdatum</TableHead>
                    <TableHead>Original-PDF</TableHead>
                    <TableHead>Prüfstatus</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((rev) => (
                    <TableRow key={rev.id} className={rev.id === release.id ? "bg-muted/40" : ""}>
                      <TableCell className="font-medium">
                        Rev. {Number(rev.revision_number) || 0}
                        {rev.is_current !== false && (
                          <Badge variant="outline" className="ml-2">aktuell</Badge>
                        )}
                        {rev.is_current === false && !rev.superseded_at && (
                          <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            Freigabe ausstehend
                          </Badge>
                        )}
                        {rev.is_current === false && !!rev.superseded_at && (
                          <Badge variant="outline" className="ml-2 text-muted-foreground">Historie</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rev.revision_date
                          ? new Date(String(rev.revision_date)).toLocaleDateString("de-AT")
                          : new Date(rev.created_at).toLocaleDateString("de-AT")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rev.source_document_name ? (
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={async () => {
                              const url = await api.productionReleases.documentUrl(
                                rev.source_document_path as string
                              );
                              if (url) window.open(url, "_blank");
                              else toast.error("Originaldokument nicht verfügbar.");
                            }}
                          >
                            {String(rev.source_document_name)}
                          </Button>
                        ) : "–"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rev.import_status === "review_required"
                          ? "Prüfung erforderlich"
                          : rev.import_status === "reviewed"
                            ? "geprüft"
                            : rev.import_status === "imported"
                              ? "importiert"
                              : "–"}
                      </TableCell>
                      <TableCell>
                        {rev.id !== release.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/fertigungsfreigaben/${rev.id}`)}
                          >
                            <History className="h-4 w-4 mr-2" /> Öffnen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!revisions.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Keine Revisionen erfasst.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Änderungsprotokoll dieser Revision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feld</TableHead>
                    <TableHead>Alt</TableHead>
                    <TableHead>Neu</TableHead>
                    <TableHead>Erkennung</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!changes.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Keine erkannten Änderungen – diese Fertigungsfreigabe wurde nicht als
                        Revision importiert.
                      </TableCell>
                    </TableRow>
                  )}
                  {changes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.field_label || c.field_key}</TableCell>
                      <TableCell className="text-sm text-muted-foreground line-through">
                        {c.old_value || "–"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {c.resolved_value ?? c.new_value ?? "–"}
                      </TableCell>
                      <TableCell className="text-xs">{c.detection}</TableCell>
                      <TableCell className="text-xs">
                        {c.status === "auto_applied" && "automatisch übernommen"}
                        {c.status === "pending" && "Prüfung erforderlich"}
                        {c.status === "accepted" && "geprüft & übernommen"}
                        {c.status === "corrected" && "korrigiert"}
                        {c.status === "dismissed" && "als unverändert markiert"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!!appliedChanges.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  Das Protokoll enthält ausschließlich tatsächlich erkannte Änderungen.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Stabile Referenzen</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Kunde (Kundenstamm)</Label>
                <Select value={customerId} disabled={readOnly} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nicht zugeordnet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nicht zugeordnet</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Erkannter Name: {values.customer_name || "–"}. Solange kein Kundenstammsatz
                  existiert, bleibt der Name erhalten und kann später zugeordnet werden.
                </p>
              </div>
              <div>
                <Label>Projekt</Label>
                <Select value={projectId} disabled={readOnly} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nicht zugeordnet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nicht zugeordnet</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.project_number ? `${p.project_number} – ` : ""}{p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Erfassungsformular</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {release.form_definition_id ? (
                <p>
                  Dieser Fertigungsfreigabe ist ein Formular aus dem Formulardesigner zugeordnet.
                  Anpassungen erfolgen dort:{" "}
                  <Link className="underline" to="/admin/messdienstleistungen">Formulardesigner öffnen</Link>.
                </p>
              ) : (
                <p>
                  Es ist noch kein Formular hinterlegt. Die Erfassung erfolgt bis dahin über die
                  Standardfelder oben. Die Zuordnung erfolgt in der Übersicht über „Formular zuordnen“.
                </p>
              )}
              <Separator />
              <p>
                Herkunft der Daten: {release.source_type === "pdf" ? "PDF-Import" : "manuelle Eingabe"}
                {release.source_document_name ? ` (${release.source_document_name})` : ""}.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {id && (
        <ReviewChangesDialog
          releaseId={id}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
