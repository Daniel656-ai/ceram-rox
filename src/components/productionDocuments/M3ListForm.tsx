/**
 * m³-Liste als natives ROX-Formular.
 *
 * Es gibt genau EINE Darstellung – der gemeinsame `FormLayoutRenderer`, der
 * auch im Formulardesigner, im Auftrag und in ROX Desktop verwendet wird.
 * Es existiert bewusst keine separate Desktop-Umsetzung: sämtliche Daten
 * laufen über die vorhandene API-Schicht (`src/lib/api`), die Backend-Adresse
 * bleibt unverändert.
 */
import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, FileDown, Printer, Save } from "lucide-react";
import { downloadM3Pdf, printM3List } from "@/lib/m3List/m3PrintActions";
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
import { findM3Template, m3DisplayFields } from "@/lib/m3List/template";
import { readM3Constants } from "@/lib/m3List/constants";
import { deriveM3Values, stripDerivedValues } from "@/lib/m3List/derive";
import { splitLayoutAtField } from "@/lib/m3List/layoutSplit";
import { BENCH_TEMPLATES } from "@/lib/m3List/calculations";
import { M3_LAB_SELECTION_KEY } from "@/lib/m3List/derive";
import { M3_ROWS_KEY } from "@/lib/m3List/template";
import { normalizeSamplingKey, selectableSamplingCodes, toggleSamplingCode, benchExtraTestPieces } from "@/lib/samplingCodeMap";
import { canUseTestMarking, resolveTestMarkingRows, toggleTestMarkingRow, buildTestNotice } from "@/lib/m3List/testMarking";
import { Input } from "@/components/ui/input";
import { buildNoxHandover, mapNoxHandoverToParameters } from "@/lib/m3List/noxHandover";
import { planM3Samples } from "@/lib/m3List/sampleNumber";
import { Checkbox } from "@/components/ui/checkbox";
import M3RowDetails from "./M3RowDetails";
import { canonicalM3, M3_TOLERANCES, validateM3Inputs } from "@/lib/m3List/workingValues";
import { planM3RowServices } from "@/lib/m3List/rowServices";
import type { ProductionDocumentRequest } from "@/lib/api/productionDocuments";
import type { LayoutNode } from "@/lib/api/formDefinitionLayout";

export default function M3ListForm({ requestId }: { requestId: string }) {
  return <M3DocumentEditor key={requestId} requestId={requestId} />;
}

function M3DocumentEditor({ requestId }: { requestId: string }) {
  const qc = useQueryClient();
  const { role, user, customRoleNames } = useAuth();
  const [stored, setStoredState] = useState<Record<string, unknown> | null>(null);
  const storedRef = useRef<Record<string, unknown> | null>(null);
  const baseline = useRef<ProductionDocumentRequest | null>(null);
  const savingRef = useRef(false);
  const setStored = (update: SetStateAction<Record<string, unknown> | null>) => {
    const next = typeof update === "function" ? update(storedRef.current) : update;
    storedRef.current = next;
    setStoredState(next);
  };
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const { data: request, isLoading, isFetchedAfterMount, error: requestError } = useQuery({
    queryKey: ["production-document-request", requestId],
    queryFn: () => api.productionDocuments.get(requestId),
    refetchOnMount: "always",
  });

  const { data: release, isLoading: releaseLoading, error: releaseError } = useProductionReleaseRevision(request?.based_on_release_id ?? null);

  /** Die Vorlagenstruktur muss auch ohne verfügbare Konstanten sichtbar sein. */
  const { data: templateId, error: templateError, isLoading: templateLoading } = useQuery({
    queryKey: ["m3-form-template"],
    queryFn: async () => {
      const id = await findM3Template();
      if (!id) throw new Error("Die bestehende m³-Vorlage wurde nicht gefunden. Es wurden keine Vorlagendaten angelegt.");
      return id;
    },
    enabled: !!request && !request.form_definition_id,
    refetchOnMount: "always",
  });
  const formId = request?.form_definition_id ?? templateId;

  const { data: form, error: formError } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => formId ? api.formDefinitions.get(formId) : Promise.reject(new Error("Formular fehlt")),
    enabled: !!formId,
  });

  const { data: fields = [], isLoading: fieldsLoading, error: fieldsError } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => formId ? api.formFields.listForForm(formId) : Promise.reject(new Error("Formular fehlt")),
    enabled: !!formId,
  });

  const { data: globalFields = [] } = useQuery({
    queryKey: ["global-fields", "m3-constants"],
    queryFn: () => api.globalFields.list(),
  });

  // Der Querschnitt wird als Text „Breite × Höhe“ angezeigt – auch in bereits
  // bestehenden m³-Vorlagen (nur Darstellung, keine Änderung der Vorlage).
  const typedFields = useMemo(
    () =>
      m3DisplayFields(fields as FormField[]).map(field => ({ ...field, metadata: {
        ...(field.metadata ?? {}),
        ...(["number", "decimal", "percent"].includes(field.field_type) && !field.readonly ? { numeric_text_input: true } : {}),
        ...(field.field_key === M3_ROWS_KEY ? { row_identity_key: "__m3_row_id" } : {}),
      } })),
    [fields]
  );

  const constantsState = useMemo(() => readM3Constants(globalFields as never[]), [globalFields]);

  useEffect(() => {
    if (!request || !isFetchedAfterMount || !release || releaseLoading || storedRef.current !== null) return;
    baseline.current = request;
    const initial = stripDerivedValues(deriveM3Values({ release: release as Record<string, unknown>,
      orderNumber: request.measurement_orders?.order_number ?? null, stored: request.form_values ?? {}, constants: constantsState.constants }).values);
    setStored(initial);
  }, [request, isFetchedAfterMount, release, releaseLoading, constantsState.constants]);

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

  // In den Dienstleistungseinstellungen gepflegte Kürzel (aktive Dienstleistungen).
  const { data: activeServices = [] } = useQuery({
    queryKey: ["services", "active"],
    queryFn: () => api.measurementServices.listActive(),
  });
  const dynamicCodes = (activeServices as { sampling_code?: string | null }[]).map((s) => s.sampling_code ?? null);

  const toggleCode = (code: string, checked: boolean) => {
    setStored((prev) => ({ ...(prev ?? {}), [M3_LAB_SELECTION_KEY]: toggleSamplingCode(selectedCodes, code, checked) }));
  };
  const setStoredKey = (key: string, v: unknown) => setStored((prev) => ({ ...(prev ?? {}), [key]: v }));
  const mayMarkTest = canUseTestMarking(customRoleNames ?? []);
  const derivedRows = (Array.isArray(derived.values[M3_ROWS_KEY]) ? derived.values[M3_ROWS_KEY] : []) as Record<string, unknown>[];
  const testMarking = resolveTestMarkingRows(stored ?? {}, derivedRows);
  const testIndices = testMarking.rowIndices;
  const testNotice = buildTestNotice(testIndices);
  // The legacy count field is text only in this view; calculation and save use derived.values.
  const displayValues = { ...derived.values, [M3_ROWS_KEY]: derivedRows.map((r) => ({ ...r, element_count: r.element_number ?? "—" })) };
  const setTestRow = (i: number, checked: boolean) =>
    setStored((prev) => toggleTestMarkingRow(prev ?? {}, M3_ROWS_KEY, i, checked, () => crypto.randomUUID()));

  const layout = useMemo<FormLayoutTree>(() => {
    const normalized = normalizeLayout(form?.layout);
    const hidden = new Set(typedFields.filter(f => ["tolerance_variant", ...M3_TOLERANCES.map(t => t.key)].includes(f.field_key)).map(f => f.id));
    const filter = (nodes: LayoutNode[]): LayoutNode[] => nodes.filter(n => n.type !== "field" || !hidden.has(n.field_id)).map(n =>
      "children" in n ? { ...n, children: filter(n.children) } as LayoutNode : n);
    const base = normalized.nodes.length ? normalized : autoLayout(typedFields);
    return { ...base, nodes: filter(base.nodes) };
  }, [form?.layout, typedFields]);

  /**
   * Der Block „Gesamte Charge“ steht in der Bildschirmansicht direkt oberhalb
   * der m³-Tabelle: Der Layoutbaum wird am Repeater-Feld geteilt, der Teil
   * davor wird separat darüber gerendert. Reine Darstellung – das
   * gespeicherte Layout bleibt unverändert.
   */
  const repeaterFieldId = useMemo(
    () => typedFields.find((f) => f.field_key === M3_ROWS_KEY)?.id ?? null,
    [typedFields]
  );
  const layoutSplit = useMemo(
    () => (repeaterFieldId ? splitLayoutAtField(layout, repeaterFieldId) : null),
    [layout, repeaterFieldId]
  );

  const { data: permissions, isLoading: permissionsLoading, error: permissionsError } = useQuery({
    queryKey: ["form-field-permissions", formId, role, typedFields.length],
    queryFn: () =>
      formId ? api.formFieldPermissions.getEffectiveMap(formId, role ?? "", typedFields.map((f) => f.id)) : Promise.reject(new Error("Formular fehlt")),
    enabled: !!formId && !!role && typedFields.length > 0,
  });

  const loadError = requestError || releaseError || fieldsError || templateError || formError || permissionsError;
  if (loadError) return <p className="text-sm text-destructive">m³-Liste konnte nicht geladen werden: {loadError instanceof Error ? loadError.message : "Ladefehler"}</p>;
  if (!request?.based_on_release_id && !isLoading) return <p className="text-sm text-destructive">Dieser m³-Liste ist keine Produktionsfreigabe-Revision zugeordnet.</p>;
  if (isLoading || !isFetchedAfterMount || !request || stored === null || releaseLoading || templateLoading || fieldsLoading || permissionsLoading || !form) return <p className="text-sm text-muted-foreground">m³-Liste wird geladen …</p>;

  const currentDerived = () => deriveM3Values({ release: release as Record<string, unknown>, orderNumber: request.measurement_orders?.order_number ?? null,
    stored: storedRef.current ?? {}, constants: constantsState.constants });

  const persist = async (): Promise<ProductionDocumentRequest> => {
    if (savingRef.current || !baseline.current) throw new Error("Ein Speichervorgang läuft bereits. Bitte kurz warten.");
    savingRef.current = true;
    setSaving(true);
    const localAtStart = storedRef.current;
    try {
      const values = stripDerivedValues(currentDerived().values);
      const original = stripDerivedValues(deriveM3Values({ release: release as Record<string, unknown>, orderNumber: request.measurement_orders?.order_number ?? null,
        stored: baseline.current.form_values, constants: constantsState.constants }).values);
      validateM3Inputs(values, original);
      const saved = await api.productionDocuments.saveM3(requestId, baseline.current, { form_definition_id: formId ?? null, form_values: values });
      baseline.current = saved;
      if (storedRef.current === localAtStart) setStored(saved.form_values);
      qc.setQueryData(["production-document-request", requestId], saved);
      await qc.invalidateQueries({ queryKey: ["production-document-requests"] });
      return saved;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const save = async () => {
    try { await persist(); toast.success("m³-Liste gespeichert."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten."); }
  };
  const savedSnapshot = async () => {
    const saved = await persist();
    if (canonicalM3(saved.form_values) !== canonicalM3(stripDerivedValues(currentDerived().values)))
      throw new Error("Während des Speicherns wurden weitere Eingaben geändert. Bitte erneut speichern und den Vorgang wiederholen.");
    const result = deriveM3Values({ release: release as Record<string, unknown>, orderNumber: request.measurement_orders?.order_number ?? null,
      stored: saved.form_values, constants: constantsState.constants });
    return result;
  };

  /**
   * „Proben aus m³-Liste ergänzen“ für einen bestehenden Auftrag: legt fehlende Proben nach demselben Plan an wie
   * „Beprobungsauftrag erstellen“ (Probennummer = Artikelpräfix + Elementnummer, TEST-Markierung beachtet) und ordnet
   * sie dem Auftrag zu. Am Auftrag bereits vorhandene Proben werden nicht doppelt angelegt; eine Nummer, die woanders
   * vergeben ist, bricht ab (es wird dann nichts angelegt). Aufgaben legt diese Funktion nicht an – dafür gibt es die
   * Nachrüstung für Administratoren (Proben-Nachprüfung).
   */
  const ensureSamples = async (orderId: string): Promise<{ created: number; existing: number }> => {
    if (!user?.id) throw new Error("Anmeldung erforderlich.");
    const snapshot = await savedSnapshot();
    const rel = (release ?? {}) as Record<string, unknown>;
    const rows = snapshot.values[M3_ROWS_KEY] as Record<string, unknown>[];
    const plan = planM3Samples(rel.article_number ?? snapshot.values.article_number, rows, resolveTestMarkingRows(snapshot.values, rows));
    if (!plan.length) throw new Error("Keine Proben erzeugt: In der m³-Liste gibt es keine Zeile mit Elementnummer.");
    const linked = (await api.orderSamples.list(orderId)) as { samples?: { sample_number?: string | null } | null }[];
    const have = new Set(linked.map((l) => l.samples?.sample_number).filter(Boolean) as string[]);
    const todo = plan.filter((p) => !have.has(p.sampleNumber));
    const taken = await api.samples.findExistingNumbers(todo.map((p) => p.sampleNumber));
    if (taken.length) {
      throw new Error(`Probennummer bereits vergeben: ${taken.join(", ")}. Es wurden keine Proben angelegt.`);
    }
    const articleNo = String(rel.article_number ?? derived.values.article_number ?? "").trim();
    const ids: string[] = [];
    for (const p of todo) {
      const s = (await api.samples.create(
        {
          sample_name: `${articleNo} · Element ${p.elementNumber}`,
          description: `m³-Liste Zeile ${p.rowIndex + 1}`,
          created_by: user.id,
          project_id: (rel.project_id as string | null) ?? null,
          order_id: orderId,
          status: "neu",
          is_hazardous: false,
          hazard_categories: [],
          tags: ["m3_beprobung"],
        },
        { explicitNumber: p.sampleNumber }
      )) as { id: string; sample_number: string };
      if (s.sample_number !== p.sampleNumber) {
        throw new Error(
          `Die Datenbank hat die Probennummer ${p.sampleNumber} durch ${s.sample_number} ersetzt – Datenbankanpassung fehlt.`
        );
      }
      ids.push(s.id);
    }
    if (ids.length) await api.orderSamples.add(orderId, ids, user.id);
    await qc.invalidateQueries({ queryKey: ["samples"] });
    await qc.invalidateQueries({ queryKey: ["orders"] });
    return { created: ids.length, existing: plan.length - ids.length };
  };

  const addSamplesToExistingOrder = async () => {
    if (!user?.id || !request.order_id) return;
    setCreatingOrder(true);
    try {
      const r = await ensureSamples(request.order_id);
      toast.success(`Proben ergänzt: ${r.created} neu, ${r.existing} bereits vorhanden.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Proben konnten nicht angelegt werden.");
    } finally {
      setCreatingOrder(false);
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
      if (!release) {
        toast.error("Beprobungsauftrag nicht erstellt: Die Fertigungsfreigabe ist noch nicht geladen. Bitte kurz warten und erneut versuchen.");
        return;
      }
      const rel = release as Record<string, unknown>;
      // Probenplan und Duplikatprüfung VOR jeder Schreiboperation, damit bei
      // Konflikten weder Auftrag noch Proben teilweise entstehen.
      const snapshot = await savedSnapshot();
      const rows = snapshot.values[M3_ROWS_KEY] as Record<string, unknown>[];
      const samplePlan = planM3Samples(rel.article_number ?? snapshot.values.article_number, rows, resolveTestMarkingRows(snapshot.values, rows));
      if (!samplePlan.length) throw new Error("Keine m³-Zeile mit gültiger Elementnummer vorhanden.");
      const standard = String(snapshot.values.lab_tests ?? "").split(",").map(c => c.trim()).filter(Boolean);
      const servicePlan = await planM3RowServices(samplePlan, rows, standard, codes => api.measurementServices.resolveSamplingCodes(codes));
      const existing = await api.samples.findExistingNumbers(samplePlan.map((p) => p.sampleNumber));
      if (existing.length) {
        throw new Error(
          `Probennummer bereits vergeben: ${existing.join(", ")}. Es wurde kein Auftrag und keine Probe angelegt.`
        );
      }
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
      const linkedDocument = await api.productionDocuments.get(requestId);
      if (!linkedDocument || linkedDocument.order_id !== created.id) throw new Error("Die Auftragszuordnung konnte nicht bestätigt werden. Bitte den angelegten Auftrag prüfen.");
      baseline.current = linkedDocument;
      qc.setQueryData(["production-document-request", requestId], linkedDocument);
      await api.productionDocuments.linkReleaseToOrder(request.based_on_release_id, created.id);

      // Maßgeblich ist ausschließlich die in der m³-Liste gesetzte
      // Beprobungsauswahl (Benutzerauswahl, sonst der automatische Vorschlag) –
      // nicht erneut die Automatik. „Bench“ ergibt dabei BENCH NOx + BENCH SOx.
      const noxHandover = buildNoxHandover(snapshot.values);
      const articleNo = String(rel.article_number ?? derived.values.article_number ?? "").trim();
      const sampleIds: string[] = [];
      for (const p of samplePlan) {
        const s = (await api.samples.create(
          {
            sample_name: `${articleNo} · Element ${p.elementNumber}`,
            description: `m³-Liste Zeile ${p.rowIndex + 1}`,
            created_by: user.id,
            project_id: (rel.project_id as string | null) ?? null,
            order_id: created.id,
            status: "neu",
            is_hazardous: false,
            hazard_categories: [],
            tags: ["m3_beprobung"],
          },
          { explicitNumber: p.sampleNumber }
        )) as { id: string; sample_number: string };
        if (s.sample_number !== p.sampleNumber) {
          throw new Error(
            `Die Datenbank hat die Probennummer ${p.sampleNumber} durch ${s.sample_number} ersetzt – Datenbankanpassung fehlt.`
          );
        }
        sampleIds.push(s.id);
      }
      await api.orderSamples.add(created.id, sampleIds, user.id);
      // Wie in der regulären Auftragserstellung: je Probe und Dienstleistung eine Aufgabe.
      for (const [index, sampleId] of sampleIds.entries()) for (const m of servicePlan[index].services) {
        const createdMeasurement = (await api.measurements.add({
          order_id: created.id,
          service_id: m.id,
          sample_id: sampleId,
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
        description: `Proben: ${samplePlan.map(p => p.sampleNumber).join(", ")} · Messungen: ${servicePlan.reduce((n, p) => n + p.services.length, 0)}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beprobungsauftrag konnte nicht erstellt werden.");
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <fieldset disabled={creatingOrder} className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{String(derived.values.release_label ?? "–")}</Badge>
        <span className="text-muted-foreground">
          Fest hinterlegte Revision – eine spätere Revision verändert diese m³-Liste nicht.
        </span>
      </div>

      {/* Beprobungsauftrag, Beprobung und freie Toleranzen platzsparend nebeneinander. */}
      <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-md border p-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Beprobungsauftrag</div>
          <div className="text-xs text-muted-foreground">
            {request.order_id
              ? `Vorhanden: ${String(derived.values.order_number ?? request.order_id.slice(0, 8))} – Grundlage der Kundendokumentation.`
              : "Noch keiner. Der Laborauftrag zur Beprobung wird aus dieser m³-Liste erzeugt und der Produktionsfreigabe zugeordnet."}
          </div>
        </div>
        {!request.order_id ? (
          <Button variant="outline" onClick={createSamplingOrder} disabled={creatingOrder || saving}>
            Beprobungsauftrag erstellen
          </Button>
        ) : (
          <Button variant="outline" onClick={addSamplesToExistingOrder} disabled={creatingOrder || saving}>
            Proben aus m³-Liste ergänzen
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
          {selectableSamplingCodes(selectedCodes, dynamicCodes).map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedCodes.some((c) => normalizeSamplingKey(c) === normalizeSamplingKey(code))}
                onCheckedChange={(v) => toggleCode(code, v === true)}
              />
              <span>{code === "Bench" ? "Bench (alt: NOx + SOx)" : code}</span>
            </label>
          ))}
        </div>
        {benchExtraTestPieces(selectedCodes) > 0 && (
          <div className="text-xs text-muted-foreground">
            Bench gewählt: insgesamt 1 zusätzliches Teststück (in der Gesamtmenge enthalten).
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="font-medium">Toleranzen [mm]</div>
        <div className="grid gap-2">
          {M3_TOLERANCES.map(({ key, label }) => {
            const field = typedFields.find(f => f.field_key === key);
            const permission = field ? permissions?.get(field.id) : undefined;
            if (permission?.visibility === "hidden") return null;
            return <label key={key} className="space-y-1 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <Input type="text" inputMode="decimal" disabled={permission?.visibility === "read"} value={String(stored[key] ?? "")} onChange={e => setStoredKey(key, e.target.value)} />
            </label>;
          })}
        </div>
      </div>
      </div>


      {!!typedFields.length && layoutSplit?.found && layoutSplit.before.nodes.length > 0 && (
        <div className="m3-list-display">
          <FormLayoutRenderer
            layout={layoutSplit.before}
            fields={typedFields}
            permissions={permissions}
            values={displayValues}
            onChange={(key, v) => setStoredKey(key, v)}
          repeaterDetails={({ field, index, entry, readonly, onPatch }) => field.field_key === M3_ROWS_KEY
            ? <M3RowDetails row={entry} index={index} standard={selectedCodes} dynamicCodes={dynamicCodes} readonly={readonly} onPatch={onPatch} /> : null}
          />
        </div>
      )}

      <div className={`m3-charge-block rounded-md border-2 p-3 space-y-2 ${testIndices.length ? "m3-charge-active" : "bg-muted/30"}`}>
        <div className="text-base font-bold">Gesamte Charge</div>
        {derivedRows.length === 0 ? (
          <div className="text-xs text-muted-foreground">Noch keine m³-Zeilen.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {derivedRows.map((r, i) => {
              const marked = testIndices.includes(i);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-sm">
                  <span>m³-Zeile {i + 1}</span>
                  <span
                    className={
                      marked
                        ? "tabular-nums font-semibold rounded px-1 m3-charge-active"
                        : "tabular-nums"
                    }
                  >
                    {String(r.element_number ?? "—")}
                  </span>
                  {mayMarkTest && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={marked}
                        onCheckedChange={(v) => setTestRow(i, v === true)}
                      />
                      Gesamte Charge mit TEST stempeln
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {derivedRows.length > 0 && (
          <div className="text-sm tabular-nums">
            Reguläre Elementanzahl: {String(derived.values.regular_element_total ?? "—")} Stk · Bench-Zusatz:{" "}
            {String(derived.values.bench_extra_pieces ?? 0)} Stk
          </div>
        )}
        {(testMarking.status === "legacy_index" || testMarking.status === "missing" || testMarking.status === "ambiguous") && (
          <div className="text-xs text-destructive">
            {testMarking.status === "legacy_index"
              ? "Eine ältere TEST-Kennzeichnung war nur über die Zeilenposition gespeichert und wird nicht automatisch zugeordnet. Bitte die Zeile erneut kennzeichnen."
              : testMarking.status === "ambiguous"
                ? "Die TEST-Kennzeichnung ist nicht eindeutig (Zeile wurde dupliziert). Bitte die Zeile erneut kennzeichnen."
                : "Die gekennzeichneten m³-Zeilen sind nicht mehr vorhanden. Bitte prüfen."}
          </div>
        )}
        {testNotice && (
          <div className="m3-charge-active rounded-md border-2 p-2 text-sm font-bold">
            {testNotice}
          </div>
        )}
        {!mayMarkTest && (
          <div className="text-xs text-muted-foreground">
            TEST-Kennzeichnung nur für Administrator, Messdienstleister, Teamleiter und PMO.
          </div>
        )}
      </div>

      {!!typedFields.length && (
        <div className="m3-list-display">
        <FormLayoutRenderer
          layout={layoutSplit?.found ? layoutSplit.at : layout}
          fields={typedFields}
          permissions={permissions}
          values={displayValues}
          onChange={(key, v) => setStoredKey(key, v)}
          repeaterDetails={({ field, index, entry, readonly, onPatch }) => field.field_key === M3_ROWS_KEY
            ? <M3RowDetails row={entry} index={index} standard={selectedCodes} dynamicCodes={dynamicCodes} readonly={readonly} onPatch={onPatch} /> : null}
        />
        </div>
      )}

      <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">Kopiervorlagen Bench (manuell)</div>
        <div>{BENCH_TEMPLATES.withoutSox}</div>
        <div>{BENCH_TEMPLATES.withSox}</div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={printing || saving}
          onClick={async () => {
            setPrinting(true);
            try {
              const snapshot = await savedSnapshot();
              const rows = snapshot.values[M3_ROWS_KEY] as Record<string, unknown>[];
              await printM3List(snapshot.values, { notices: snapshot.notices, testRowIndices: resolveTestMarkingRows(snapshot.values, rows).rowIndices });
            } catch (e) {
              toast.error(e instanceof Error ? `Drucken fehlgeschlagen: ${e.message}` : "Drucken fehlgeschlagen.");
            } finally {
              setPrinting(false);
            }
          }}
        >
          <Printer className="h-4 w-4 mr-2" /> PDF drucken
        </Button>
        <Button
          variant="outline"
          disabled={saving || printing}
          onClick={async () => {
            try {
              const snapshot = await savedSnapshot();
              const rows = snapshot.values[M3_ROWS_KEY] as Record<string, unknown>[];
              downloadM3Pdf(snapshot.values, { notices: snapshot.notices, testRowIndices: resolveTestMarkingRows(snapshot.values, rows).rowIndices });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "PDF-Download fehlgeschlagen.");
            }
          }}
        >
          <FileDown className="h-4 w-4 mr-2" /> PDF herunterladen
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> m³-Liste speichern
        </Button>
      </div>
    </fieldset>
  );
}
