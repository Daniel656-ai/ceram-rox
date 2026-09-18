/**
 * m³-Liste als natives ROX-Formular.
 *
 * Es gibt genau EINE Darstellung – der gemeinsame `FormLayoutRenderer`, der
 * auch im Formulardesigner, im Auftrag und in ROX Desktop verwendet wird.
 * Es existiert bewusst keine separate Desktop-Umsetzung: sämtliche Daten
 * laufen über die vorhandene API-Schicht (`src/lib/api`), die Backend-Adresse
 * bleibt unverändert.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { autoLayout } from "@/components/OrderKindDynamicForm";
import { normalizeLayout, type FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import type { FormField } from "@/lib/api/formFields";
import { useProductionReleaseRevision } from "@/hooks/useProductionDocuments";
import { ensureM3Template } from "@/lib/m3List/template";
import { ensureM3Constants, readM3Constants } from "@/lib/m3List/constants";
import { deriveM3Values, stripDerivedValues } from "@/lib/m3List/derive";
import { BENCH_TEMPLATES } from "@/lib/m3List/calculations";
import { M3_LAB_SELECTION_KEY } from "@/lib/m3List/derive";
import { SAMPLING_CODE_MAP, normalizeSamplingKey } from "@/lib/samplingCodeMap";
import { buildNoxHandover, mapNoxHandoverToParameters } from "@/lib/m3List/noxHandover";
import { Checkbox } from "@/components/ui/checkbox";

export default function M3ListForm({ requestId }: { requestId: string }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const [stored, setStored] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["production-document-request", requestId],
    queryFn: () => api.productionDocuments.get(requestId),
  });

  const { data: release } = useProductionReleaseRevision(request?.based_on_release_id ?? null);

  /** Die Vorlagenstruktur muss auch ohne verfügbare Konstanten sichtbar sein. */
  const { data: formId, error: templateError, isLoading: templateLoading } = useQuery({
    queryKey: ["m3-form-template"],
    queryFn: ensureM3Template,
    refetchOnMount: "always",
  });

  /** Fehlende Konstanten betreffen ausschließlich die Berechnungen. */
  const { error: constantsSetupError } = useQuery({
    queryKey: ["m3-constants-setup"],
    queryFn: ensureM3Constants,
    retry: false,
  });

  const { data: form } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => api.formDefinitions.get(formId!),
    enabled: !!formId,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => api.formFields.listForForm(formId!),
    enabled: !!formId,
  });

  const { data: globalFields = [] } = useQuery({
    queryKey: ["global-fields", "m3-constants"],
    queryFn: () => api.globalFields.list(),
  });

  const typedFields = fields as FormField[];

  useEffect(() => {
    if (request && stored === null) {
      setStored((request.form_values ?? {}) as Record<string, unknown>);
    }
  }, [request, stored]);

  const constantsState = useMemo(() => readM3Constants(globalFields as never[]), [globalFields]);

  const derived = useMemo(
    () =>
      deriveM3Values({
        release: (release ?? null) as Record<string, unknown> | null,
        orderNumber: (request as { measurement_orders?: { order_number?: string } } | null)?.measurement_orders?.order_number ?? null,
        stored: stored ?? {},
        constants: constantsState.constants,
      }),
    [release, request, stored, constantsState.constants]
  );

  /** Aktuelle Auswahl: gespeicherte Auswahl, sonst der automatische Vorschlag. */
  const selectedCodes = useMemo(
    () =>
      String(derived.values.lab_tests ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    [derived.values.lab_tests]
  );

  const toggleCode = (code: string, checked: boolean) => {
    const next = checked
      ? [...selectedCodes, code]
      : selectedCodes.filter((c) => c.toLowerCase() !== code.toLowerCase());
    // Reihenfolge der zentralen Zuordnung beibehalten.
    const ordered = SAMPLING_CODE_MAP.map((m) => m.code).filter((c) =>
      next.some((n) => n.toLowerCase() === c.toLowerCase())
    );
    const unknown = next.filter(
      (n) => !SAMPLING_CODE_MAP.some((m) => m.code.toLowerCase() === n.toLowerCase())
    );
    setStored((prev) => ({ ...(prev ?? {}), [M3_LAB_SELECTION_KEY]: [...ordered, ...unknown] }));
  };

  const layout = useMemo<FormLayoutTree>(() => {
    const normalized = normalizeLayout(form?.layout);
    return normalized.nodes.length ? normalized : autoLayout(typedFields);
  }, [form?.layout, typedFields]);

  const { data: permissions } = useQuery({
    queryKey: ["form-field-permissions", formId, role, typedFields.length],
    queryFn: () =>
      api.formFieldPermissions.getEffectiveMap(formId!, role ?? "", typedFields.map((f) => f.id)),
    enabled: !!formId && !!role && typedFields.length > 0,
  });

  if (isLoading || !request) return <p className="text-sm text-muted-foreground">m³-Liste wird geladen …</p>;
  if (!request.based_on_release_id) {
    return (
      <p className="text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Dieser m³-Liste ist keine Fertigungsfreigabe-Revision zugeordnet.
      </p>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.productionDocuments.update(requestId, {
        form_definition_id: formId ?? null,
        form_values: stripDerivedValues(derived.values),
      });
      await qc.invalidateQueries({ queryKey: ["production-document-request", requestId] });
      await qc.invalidateQueries({ queryKey: ["production-document-requests"] });
      toast.success("m³-Liste gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Fachlicher Ablauf: Fertigungsfreigabe → m³-Liste → Beprobung → Laborauftrag.
   * Der Auftrag entsteht ausschließlich hier, aus genau dieser m³-Liste, und wird
   * anschließend über die bestehende Funktion `linkReleaseToOrder` der
   * Fertigungsfreigabe (allen Revisionen) zugeordnet. Eine freie Auswahl eines
   * fachfremden Auftrags ist damit ausgeschlossen.
   */
  const createSamplingOrder = async () => {
    if (!user?.id || !request.based_on_release_id) return;
    setCreatingOrder(true);
    try {
      const rel = (release ?? {}) as Record<string, unknown>;
      const created = (await api.orders.create({
        project_id: (rel.project_id as string | null) ?? null,
        order_type: "customer",
        order_kind: "labor",
        created_by: user.id,
        notes: `Beprobung zur Fertigungsfreigabe ${String(rel.release_number ?? "")} · Rev${
          Number(rel.revision_number) || 0
        } (aus m³-Liste)`,
      })) as { id: string; order_number?: string | null };
      await api.productionDocuments.update(requestId, { order_id: created.id });
      await api.productionDocuments.linkReleaseToOrder(request.based_on_release_id, created.id);

      // Maßgeblich ist ausschließlich die in der m³-Liste gesetzte
      // Beprobungsauswahl (Benutzerauswahl, sonst der automatische Vorschlag) –
      // nicht erneut die Automatik. „Bench“ ergibt dabei BENCH NOx + BENCH SOx.
      const { matched, missing } = await api.measurementServices.resolveSamplingCodes(selectedCodes);
      const noxHandover = buildNoxHandover(derived.values);
      for (const m of matched) {
        const createdMeasurement = (await api.measurements.add({
          order_id: created.id,
          service_id: m.id,
        })) as { id: string };
        // NOx-Vorgaben stammen aus der Fertigungsfreigabe/Revision dieser
        // m³-Liste und werden in bereits vorhandene Felder der Dienstleistung
        // übernommen – ohne neue Felder und ohne erneute Eingabe.
        if (normalizeSamplingKey(m.code) === "nox" && noxHandover.length) {
          try {
            const fields = await api.serviceDataFields.listForService(m.id);
            const rows = mapNoxHandoverToParameters(
              fields as unknown as { field_key: string; display_name: string; unit?: string | null }[],
              noxHandover,
              createdMeasurement.id
            );
            if (rows.length) await api.measurementParameters.bulkInsert(rows);
          } catch {
            toast.warning("Die NOx-Vorgaben konnten nicht automatisch übernommen werden.");
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ["production-document-request", requestId] });
      await qc.invalidateQueries({ queryKey: ["production-document-requests"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Beprobungsauftrag ${created.order_number ?? ""} erstellt und zugeordnet.`, {
        description:
          `Übernommene Dienstleistungen: ${matched.length}` +
          (missing.length ? ` · Nicht zugeordnet: ${missing.join(", ")}` : ""),
      });
      if (missing.length) {
        toast.warning(
          missing.length === 1
            ? `Für das Beprobungskürzel ${missing[0]} ist noch keine Dienstleistung hinterlegt.`
            : `Für die Beprobungskürzel ${missing.join(", ")} ist noch keine Dienstleistung hinterlegt.`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beprobungsauftrag konnte nicht erstellt werden.");
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{String(derived.values.release_label ?? "–")}</Badge>
        <span className="text-muted-foreground">
          Fest hinterlegte Revision – eine spätere Revision verändert diese m³-Liste nicht.
        </span>
      </div>

      <div className="rounded-md border p-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Beprobungsauftrag</div>
          <div className="text-xs text-muted-foreground">
            {request.order_id
              ? `Vorhanden: ${String(derived.values.order_number ?? request.order_id.slice(0, 8))} – Grundlage der Kundendokumentation.`
              : "Noch keiner. Der Laborauftrag zur Beprobung wird aus dieser m³-Liste erzeugt und der Fertigungsfreigabe zugeordnet."}
          </div>
        </div>
        {!request.order_id && (
          <Button variant="outline" onClick={createSamplingOrder} disabled={creatingOrder}>
            Beprobungsauftrag erstellen
          </Button>
        )}
      </div>

      {templateLoading && <p className="text-sm text-muted-foreground">Formularstruktur wird geprüft …</p>}

      {templateError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>m³-Formularstruktur konnte nicht ergänzt werden</AlertTitle>
          <AlertDescription>
            {templateError instanceof Error ? templateError.message : "Unbekannter Fehler beim Ergänzen der m³-Vorlage."}
          </AlertDescription>
        </Alert>
      )}

      {constantsSetupError && constantsState.missing.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>m³-Konstanten konnten nicht geprüft werden</AlertTitle>
          <AlertDescription>
            Die Formularstruktur bleibt verfügbar; nur die Berechnungen sind momentan nicht ausführbar.
          </AlertDescription>
        </Alert>
      )}

      {constantsState.missing.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Fehlende Konstanten: {constantsState.missing.join(", ")}. Die Berechnungen sind bis zur Pflege
          in den globalen Konstanten nicht möglich – es wird bewusst kein Ersatzwert verwendet.
        </div>
      )}

      {derived.notices.map((n) => (
        <div
          key={n}
          className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {n}
        </div>
      ))}

      <div className="rounded-md border p-3 space-y-2">
        <div className="text-sm font-medium">Beprobung</div>
        <div className="text-xs text-muted-foreground">
          Automatischer Vorschlag: {String(derived.values.lab_tests_auto ?? "–")}. Die Auswahl kann
          hier frei geändert werden – maßgeblich für den Beprobungsauftrag ist diese Auswahl.
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SAMPLING_CODE_MAP.map((m) => (
            <label key={m.code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedCodes.includes(m.code)}
                onCheckedChange={(v) => toggleCode(m.code, v === true)}
              />
              <span>{m.code}</span>
            </label>
          ))}
        </div>
      </div>

      {!!typedFields.length && (
        <FormLayoutRenderer
          layout={layout}
          fields={typedFields}
          permissions={permissions}
          values={derived.values as Record<string, never>}
          onChange={(key, v) => setStored((prev) => ({ ...(prev ?? {}), [key]: v }))}
        />
      )}

      <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">Kopiervorlagen Bench (manuell)</div>
        <div>{BENCH_TEMPLATES.withoutSox}</div>
        <div>{BENCH_TEMPLATES.withSox}</div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> m³-Liste speichern
        </Button>
      </div>
    </div>
  );
}
