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
import { ArrowLeft, Save, Trash2, FileDown, Plus } from "lucide-react";
import {
  RELEASE_FIELDS, RELEASE_FIELD_GROUPS, RELEASE_STATUS_LABEL, RELEASE_STATUS_COLOR,
  RELEASE_STATUS_FLOW, TEST_SECTIONS, TEST_PARAMETERS, TEST_SECTION_LABEL,
  TEST_PARAMETER_LABEL, coerceFieldValue,
} from "@/lib/productionRelease/fields";
import {
  useProductionRelease, useReleaseTestParameters, useProductionReleasePermissions,
  useSaveRelease, useDeleteRelease, useCustomers,
} from "@/hooks/useProductionReleases";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";

const NONE = "__none__";

export default function ProductionReleaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perms = useProductionReleasePermissions();
  const { data: release, isLoading } = useProductionRelease(id);
  const { data: storedTests = [] } = useReleaseTestParameters(id);
  const { data: customers = [] } = useCustomers();
  const save = useSaveRelease();
  const del = useDeleteRelease();

  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<ProductionReleaseTestParameter[]>([]);
  const [customerId, setCustomerId] = useState<string>(NONE);
  const [projectId, setProjectId] = useState<string>(NONE);

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
    const extra: Record<string, unknown> = { status };
    if (status === "freigegeben") {
      extra.released_at = new Date().toISOString();
      extra.released_by = user?.id ?? null;
    }
    await save.mutateAsync({ id, values: extra });
    toast.success(`Status: ${RELEASE_STATUS_LABEL[status] ?? status}`);
  };

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
              <Button key={s} variant="outline" onClick={() => setStatus(s)}>
                {RELEASE_STATUS_LABEL[s]}
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

        <TabsContent value="tests" className="pt-4">
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
    </div>
  );
}
