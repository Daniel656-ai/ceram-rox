import { useMemo, useRef, useState } from "react";
import type { MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";
import type { TargetCandidate } from "@/lib/measurementImport";
import {
  analysisLabel, detectImporter, fileImporters, importerById, mapImportedResults,
  allResults, type FileMappedRow, type ImportedMeasurement,
} from "@/lib/instrumentImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, FileUp, Info } from "lucide-react";
import type { ImportMetadataEntry, UnassignedMeasurementValue } from "@/lib/measurementClassification";
import { toast } from "sonner";
import CurveViewer, { type CurveSelection } from "@/components/curves/CurveViewer";
import CurveEvaluationPanel, { type CurveEvaluationProvenance } from "@/components/curves/CurveEvaluationPanel";
import { api } from "@/lib/api";

/**
 * Zuordnungskontext für die dauerhafte Speicherung der Rohdaten.
 * Fehlt er (z. B. reine Vorschau im Designer), bleiben Kurve und Auswertung
 * rein lokal – es wird nichts gespeichert.
 */
export interface CurvePersistContext {
  orderMeasurementId: string;
  sampleId?: string | null;
  serviceId?: string | null;
  instanceKey?: string | null;
  instanceLabel?: string | null;
  caseInstanceId?: string | null;
  sourceFileId?: string | null;
  userId?: string | null;
}

export interface FileImportMeta {
  importerId: string;
  importerLabel: string;
  fileName: string;
  parserVersion: string;
  analyses: string[];
  count: number;
  unmapped: string[];
  /** Echte Messwerte ohne Zielfeld – bleiben vollständig erhalten. */
  unassignedValues: UnassignedMeasurementValue[];
  /** Technische Metadaten der Messdatei (Gerät, Datum, Probe …). */
  metadata: ImportMetadataEntry[];
}

interface Props {
  profile: MeasurementImportProfile | null;
  targets: TargetCandidate[];
  currentValues?: Record<string, unknown>;
  /** Zulässige Importer für dieses Formularfeld (leer = alle). */
  allowedImporters?: string[] | null;
  /** Zuordnung für die dauerhafte Rohdatenspeicherung (optional). */
  curveContext?: CurvePersistContext | null;
  /** Vom Messfall vorgegebene Standardachsen. */
  curveDefaults?: { xKey?: string; yKeys?: string[]; y2Key?: string | null } | null;
  /** Vom Messfall erlaubte Auswertungen (leer = alle). */
  allowedEvaluations?: string[] | null;
  /**
   * Auswertung direkt beim Import zulassen. Im Messablauf bewusst aus:
   * Der Messtechniker legt nur die Signalzuordnung fest, die fachliche
   * Auswertung erfolgt später im Auftrag durch den Auftragsersteller.
   */
  enableEvaluation?: boolean;
  onApply: (values: Record<string, number | string>, meta: FileImportMeta) => void;
}

const confBadge = (c: FileMappedRow["confidence"]) =>
  c === "high" ? <Badge variant="secondary">sicher</Badge>
    : c === "medium" ? <Badge variant="outline">wahrscheinlich</Badge>
      : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />unsicher</Badge>;

export default function MeasurementFileImportPanel({
  profile, targets, currentValues, allowedImporters, curveContext, curveDefaults,
  allowedEvaluations, enableEvaluation = false, onApply,
}: Props) {

  const inputRef = useRef<HTMLInputElement>(null);
  const [measurement, setMeasurement] = useState<ImportedMeasurement | null>(null);
  const [importerLabel, setImporterLabel] = useState<string>("");
  const [importerId, setImporterId] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<CurveSelection | null>(null);
  /** Id des bereits gespeicherten Rohdatensatzes (nur mit Kontext). */
  const [datasetId, setDatasetId] = useState<string | null>(null);

  const pool = allowedImporters?.length
    ? fileImporters.filter((i) => allowedImporters.includes(i.id))
    : fileImporters;
  const accept = [...new Set(pool.flatMap((i) => i.extensions))].join(",");

  const rows: FileMappedRow[] = useMemo(() => {
    if (!measurement) return [];
    const base = mapImportedResults(allResults(measurement), profile, targets, currentValues);
    return base.map((r) => {
      const o = overrides[r.normalizedName];
      if (o === undefined) return r;
      return { ...r, targetFieldKey: o === "__none__" ? null : o, origin: "manual" as const };
    });
  }, [measurement, profile, targets, currentValues, overrides]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const importer = detectImporter({ name: file.name, buffer }, allowedImporters);
      if (!importer) {
        toast.error("Dateiformat wird von den freigegebenen Importern nicht unterstützt.");
        return;
      }
      const parsed = importer.parse({ name: file.name, buffer });
      setMeasurement(parsed);
      setImporterLabel(importer.label);
      setImporterId(importer.id);
      setOverrides({});
      const pre: Record<string, boolean> = {};
      for (const r of mapImportedResults(allResults(parsed), profile, targets, currentValues)) {
        pre[r.normalizedName] = !!r.targetFieldKey && r.confidence !== "low" && r.existingValue == null;
      }
      setSelected(pre);
      setSelection(null);
      setDatasetId(null);
      if (allResults(parsed).length === 0) toast.warning("Keine bekannten Messwerte in der Datei erkannt.");
    } catch (e) {
      toast.error(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  /** Aktuelle Signalzuordnung aus der Kanalauswahl (keine Diagrammdefinition). */
  const buildSignalMapping = (parsed: ImportedMeasurement): CurveSignalMapping => {
    const channels = parsed.dataset?.channels ?? [];
    const keys = [
      selection?.xKey,
      ...(selection?.yKeys ?? []),
      selection?.y2Key ?? null,
    ].filter(Boolean) as string[];
    const labels: Record<string, string> = {};
    const units: Record<string, string | null> = {};
    for (const k of keys) {
      const ch = channels.find((c) => c.key === k);
      if (!ch) continue;
      labels[k] = ch.label;
      units[k] = ch.unit;
    }
    return {
      x_key: selection?.xKey ?? null,
      y_keys: selection?.yKeys ?? [],
      y2_key: selection?.y2Key ?? null,
      labels,
      units,
      assigned_by: curveContext?.userId ?? null,
      assigned_at: new Date().toISOString(),
    };
  };

  /** Speichert die Rohdaten einmalig und liefert die Datensatz-Id. */
  const ensureDataset = async (parsed: ImportedMeasurement): Promise<string | null> => {
    if (!curveContext?.orderMeasurementId || !parsed.dataset) return null;
    const mapping = buildSignalMapping(parsed);
    if (datasetId) {
      await api.measurementRawData.updateSignalMapping(datasetId, mapping);
      return datasetId;
    }
    const saved = await api.measurementRawData.save({
      order_measurement_id: curveContext.orderMeasurementId,
      sample_id: curveContext.sampleId ?? null,
      service_id: curveContext.serviceId ?? null,
      instance_key: curveContext.instanceKey ?? null,
      instance_label: curveContext.instanceLabel ?? null,
      case_instance_id: curveContext.caseInstanceId ?? null,
      source_file_id: curveContext.sourceFileId ?? null,
      source_file_name: parsed.sourceFileName,
      importer_id: importerId,
      parser_version: parsed.parserVersion,
      measurement_type: parsed.measurementType ?? null,
      instrument: parsed.headerMap?.["INSTRUMENT"] ?? null,
      metadata: { header: parsed.headerMap ?? {}, sample: parsed.sampleInformation },
      signal_mapping: mapping,
      created_by: curveContext.userId ?? null,
      dataset: parsed.dataset,
    });
    setDatasetId(saved.id);
    return saved.id;
  };


  /** Übernahme einer Kurvenauswertung als offizielles Messergebnis. */
  const adoptOfficial = async (p: CurveEvaluationProvenance) => {
    if (!measurement) return;
    if (!curveContext?.orderMeasurementId) {
      toast.error("Ohne Messungskontext kann kein offizielles Ergebnis gespeichert werden.");
      return;
    }
    const dsId = await ensureDataset(measurement);
    const result: any = await api.measurementResults.create({
      order_measurement_id: curveContext.orderMeasurementId,
      result_name: p.resultLabel,
      display_label: p.resultLabel,
      unit: p.unit ?? undefined,
      value: p.value,
      temperature_range_from: p.xUnit === "°C" ? p.from : undefined,
      temperature_range_to: p.xUnit === "°C" ? p.to : undefined,
      temperature_unit: p.xUnit === "°C" ? "°C" : undefined,
      remarks: `${p.methodLabel} · ${p.yChannel} · Bereich ${p.from}–${p.to}${p.xUnit ? ` ${p.xUnit}` : ""} · ${p.formula}`,
      is_official: true,
      instance_key: curveContext.instanceKey ?? undefined,
      instance_label: curveContext.instanceLabel ?? undefined,
    });
    if (dsId) {
      const evaluation = await api.measurementRawData.createEvaluation({
        dataset_id: dsId,
        measurement_result_id: result?.id ?? null,
        method: p.method,
        method_label: p.methodLabel,
        x_channel: p.xChannel,
        x_unit: p.xUnit,
        y_channel: p.yChannel,
        y_unit: p.yUnit,
        x_from: p.from,
        x_to: p.to,
        value: p.value,
        unit: p.unit,
        formula: p.formula,
        details: p.details,
        result_label: p.resultLabel,
        created_by: curveContext.userId ?? null,
      } as any);
      void evaluation;
    }
    toast.success("Auswertung als offizielles Ergebnis übernommen.");
  };

  const apply = () => {
    const values: Record<string, number | string> = {};
    const unmapped: string[] = [];
    const unassignedValues: UnassignedMeasurementValue[] = [];
    for (const r of rows) {
      if (!r.targetFieldKey) {
        unmapped.push(r.sourceName);
        // Erkannter Messwert ohne Feld: speichern statt verwerfen.
        unassignedValues.push({
          parameter: r.sourceName,
          normalized: r.normalizedName,
          raw: r.raw,
          value: r.value ?? r.raw ?? null,
          unit: r.unit ?? null,
          source: measurement?.sourceFileName ?? null,
        });
        continue;
      }
      if (!selected[r.normalizedName]) continue;
      if (r.value == null) continue;
      values[r.targetFieldKey] = r.value;
    }
    const info = measurement?.sampleInformation;
    const metadata: ImportMetadataEntry[] = [
      measurement?.sourceFileName ? { label: "Quelldatei", value: measurement.sourceFileName, kind: "file" as const } : null,
      importerLabel ? { label: "Gerät / Importer", value: importerLabel, kind: "instrument" as const } : null,
      measurement?.parserVersion ? { label: "Parserversion", value: measurement.parserVersion, kind: "software" as const } : null,
      info?.analysisDate ? { label: "Messdatum", value: info.analysisDate, kind: "date" as const } : null,
      info?.sampleName ? { label: "Probe laut Gerät", value: info.sampleName, kind: "comment" as const } : null,
    ].filter(Boolean) as ImportMetadataEntry[];
    if (Object.keys(values).length === 0 && unassignedValues.length === 0) {
      toast.error("Keine Werte ausgewählt.");
      return;
    }
    if (curveContext?.orderMeasurementId && measurement?.dataset?.rows.length) {
      void ensureDataset(measurement).catch((e) =>
        toast.error(`Rohdaten konnten nicht gespeichert werden: ${(e as Error).message}`));
    }
    onApply(values, {
      importerId,
      importerLabel,
      fileName: measurement?.sourceFileName ?? "",
      parserVersion: measurement?.parserVersion ?? "",
      analyses: (measurement?.analyses ?? []).map((a) => analysisLabel(a.type)),
      count: Object.keys(values).length,
      unmapped,
      unassignedValues,
      metadata,
    });
  };

  const selectedCount = rows.filter((r) => r.targetFieldKey && selected[r.normalizedName]).length;

  return (
    <div className="space-y-3">
      <div className="rounded border border-dashed p-4 text-center space-y-2">
        <FileUp className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Originale Messdatei auswählen – der passende Importer wird automatisch erkannt.
        </p>
        <p className="text-[11px] text-muted-foreground">
          Verfügbar: {pool.map((i) => `${i.label} (${i.extensions.join(", ")})`).join(" · ")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          Messdatei auswählen
        </Button>
      </div>

      {measurement && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{importerLabel} erkannt</Badge>
            <Badge variant="outline">{measurement.sourceFileName}</Badge>
            {measurement.analyses.length > 0
              ? measurement.analyses.map((a) => (
                  <Badge key={a.type} variant="outline">✓ {analysisLabel(a.type)}</Badge>
                ))
              : <Badge variant="destructive">Keine Auswertung erkannt</Badge>}
            <span className="text-muted-foreground">Parser {measurement.parserVersion}</span>
          </div>

          {(measurement.sampleInformation.sampleName || measurement.sampleInformation.sampleMass != null) && (
            <p className="text-[11px] text-muted-foreground">
              Probe laut Gerät: {measurement.sampleInformation.sampleName ?? "—"}
              {measurement.sampleInformation.sampleMass != null
                ? ` · Einwaage ${measurement.sampleInformation.sampleMass} ${measurement.sampleInformation.sampleMassUnit ?? ""}`
                : ""}
              {measurement.sampleInformation.analysisDate ? ` · ${measurement.sampleInformation.analysisDate}` : ""}
            </p>
          )}

          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="text-left p-2">Auswertung</th>
                  <th className="text-left p-2">Kennwert</th>
                  <th className="text-left p-2">Wert</th>
                  <th className="text-left p-2">Zielfeld</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const conflict = r.targetFieldKey && r.existingValue != null;
                  return (
                    <tr key={r.normalizedName} className="border-t align-top">
                      <td className="p-2">
                        <Checkbox
                          checked={!!selected[r.normalizedName]}
                          disabled={!r.targetFieldKey}
                          onCheckedChange={(v) =>
                            setSelected((p) => ({ ...p, [r.normalizedName]: v === true }))}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{analysisLabel(r.analysis)}</td>
                      <td className="p-2 font-medium">{r.sourceName}</td>
                      <td className="p-2 font-mono">
                        {r.value ?? r.raw}{r.unit ? ` ${r.unit}` : ""}
                      </td>
                      <td className="p-2">
                        <Select
                          value={r.targetFieldKey ?? "__none__"}
                          onValueChange={(v) => {
                            setOverrides((p) => ({ ...p, [r.normalizedName]: v }));
                            setSelected((p) => ({ ...p, [r.normalizedName]: v !== "__none__" }));
                          }}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            <SelectItem value="__none__">— nicht übernehmen —</SelectItem>
                            {targets.map((t) => (
                              <SelectItem key={t.field_key} value={t.field_key}>
                                {t.display_name}{t.unit ? ` [${t.unit}]` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 space-y-1">
                        {confBadge(r.confidence)}
                        {!r.targetFieldKey && (
                          <p className="text-amber-600">⚠ nicht zugeordnet – Messwert bleibt erhalten</p>
                        )}
                        {conflict && (
                          <p className="text-amber-600">
                            Feld enthält bereits {String(r.existingValue)} – Übernahme nur nach Auswahl
                          </p>
                        )}
                        {r.unitMismatch && (
                          <p className="text-amber-600">Einheit {r.unit} ≠ {r.targetUnit}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {measurement.dataset && measurement.dataset.rows.length > 0 && (
            <div className="rounded border p-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Rohdaten &amp; Signalzuordnung</Badge>
                <span className="text-xs text-muted-foreground">
                  {measurement.dataset.channels.length} Kanäle · {measurement.dataset.rows.length} Messpunkte
                  {measurement.measurementType ? ` · Messdatentyp ${measurement.measurementType}` : ""}
                </span>
                {!curveContext?.orderMeasurementId && (
                  <span className="text-[11px] text-amber-600">
                    Vorschau – ohne Messungskontext werden keine Rohdaten gespeichert.
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rohdaten prüfen und festlegen, welches Signal auf welcher Achse liegt. Diese
                Zuordnung wird mit den Rohdaten gespeichert. Ein fertiges Diagramm oder eine
                Auswertung ist hier nicht erforderlich – das erfolgt später im Auftrag.
              </p>
              <CurveViewer
                dataset={measurement.dataset}
                defaults={curveDefaults ?? undefined}
                onSelectionChange={setSelection}
              />
              {enableEvaluation && (
                <CurveEvaluationPanel
                  dataset={measurement.dataset}
                  selection={selection}
                  allowedEvaluations={allowedEvaluations ?? null}
                  onAdoptOfficial={curveContext?.orderMeasurementId ? adoptOfficial : undefined}
                />
              )}
            </div>
          )}


          {measurement.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-600 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />{w}
            </p>
          ))}

          <div className="flex justify-end">
            <Button type="button" onClick={apply} disabled={selectedCount === 0 && !measurement.dataset}>
              {selectedCount > 0 ? `${selectedCount} Wert(e) übernehmen` : "Messdaten übernehmen"}
            </Button>
          </div>
        </div>
      )}

      {!measurement && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Unterstützte Geräte: {fileImporters.map((i) => i.label).join(", ")}
            {importerById("gasadsorption") ? " – u. a. .SMP, .REP, .TXT, .CSV, .XLS/.XLSX" : ""}
          </Label>
        </div>
      )}
    </div>
  );
}
