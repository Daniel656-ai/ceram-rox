import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";
import {
  parseMeasurementText, mapReadings, allSourceNames, outputValue,
  type MappedRow, type TargetCandidate, type DecimalSeparator,
} from "@/lib/measurementImport";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ClipboardPaste, Settings2, Plus, FileUp } from "lucide-react";
import ImportProfileEditorDialog from "./ImportProfileEditorDialog";
import MeasurementFileImportPanel from "./MeasurementFileImportPanel";
import { toast } from "sonner";
import {
  classifyReading,
  type ImportMetadataEntry,
  type UnassignedMeasurementValue,
} from "@/lib/measurementClassification";

/** Ergebnis einer Übernahme: Werte + erhaltene Messwerte ohne Feld + Importinformationen. */
export interface ImportApplyMeta {
  profileName: string;
  sampleLabel: string;
  count: number;
  source?: string;
  /** Echte Messwerte ohne Zielfeld – dürfen nie verloren gehen. */
  unassigned?: UnassignedMeasurementValue[];
  /** Technische Metadaten – nie Ergebniswerte. */
  metadata?: ImportMetadataEntry[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Vorausgewähltes Profil (aus der Feldkonfiguration). */
  defaultProfileId?: string | null;
  /** Zielfelder, in die geschrieben werden darf (Geschwisterfelder im selben Scope). */
  targets: TargetCandidate[];
  /** Aktuelle Werte der Zielfelder – für Konflikterkennung beim Dateiimport. */
  currentValues?: Record<string, unknown>;
  /** Zulässige Datei-Importer (leer = alle registrierten). */
  allowedImporters?: string[] | null;
  /** Übernahme der geprüften Werte. */
  onApply: (values: Record<string, number | string | null>, meta: ImportApplyMeta) => void;
  /** Darf der Anwender Profile anlegen/bearbeiten? */
  canManageProfiles?: boolean;
}


export default function MeasurementImportDialog({
  open, onOpenChange, defaultProfileId, targets, currentValues, allowedImporters,
  onApply, canManageProfiles = true,
}: Props) {
  const [profileId, setProfileId] = useState<string>(defaultProfileId ?? "");
  const [text, setText] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNew, setEditingNew] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["measurement-import-profiles"],
    queryFn: () => api.measurementImportProfiles.list(),
  });

  useEffect(() => {
    if (!open) return;
    setText(""); setSampleIdx(0); setOverrides({});
    setProfileId(defaultProfileId ?? "");
  }, [open, defaultProfileId]);

  const profile: MeasurementImportProfile | null = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId]
  );

  const parsed = useMemo(
    () => parseMeasurementText(text, {
      format: profile?.format ?? "auto",
      decimalSeparator: (profile?.decimal_separator ?? "auto") as DecimalSeparator,
      knownNames: allSourceNames(profile),
    }),
    [text, profile]
  );

  const sample = parsed.samples[Math.min(sampleIdx, Math.max(parsed.samples.length - 1, 0))];

  // Trennung: echte Mess-/Ergebnisparameter vs. technische Metadaten.
  const classified = useMemo(
    () => (sample?.readings ?? []).map((r) => ({ reading: r, cls: classifyReading(r) })),
    [sample]
  );

  const metadataRows: ImportMetadataEntry[] = useMemo(
    () =>
      classified
        .filter((c) => c.cls.category === "metadata")
        .map((c) => ({ label: c.cls.parameter, value: c.reading.raw, kind: c.cls.metadataKind ?? "other" })),
    [classified]
  );

  const measurementReadings = useMemo(
    () => classified.filter((c) => c.cls.category === "measurement"),
    [classified]
  );

  const rows: MappedRow[] = useMemo(() => {
    const base = mapReadings(
      measurementReadings.map((c) => ({ ...c.reading, sourceName: c.cls.parameter, unit: c.reading.unit ?? c.cls.unit })),
      profile,
      targets
    );
    return base.map((r, i) => {
      const o = overrides[i];
      if (o === undefined) return r;
      return { ...r, targetFieldKey: o === "__none__" ? null : o, origin: "manual" as const };
    });
  }, [measurementReadings, profile, targets, overrides]);

  const assigned = rows.filter((r) => r.targetFieldKey);
  const unassigned = rows.filter((r) => !r.targetFieldKey);
  const invalid = assigned.filter((r) => r.value == null && !r.belowDetection);

  const apply = () => {
    const values: Record<string, number | string | null> = {};
    for (const r of assigned) {
      const v = outputValue(r);
      if (v == null) continue;
      values[r.targetFieldKey as string] = v;
    }
    // Echte Messwerte ohne Zielfeld gehen nicht verloren – sie werden als
    // „nicht zugeordnet“ mitgeführt und können später zugeordnet werden.
    const keep: UnassignedMeasurementValue[] = unassigned.map((r) => ({
      parameter: r.sourceName,
      normalized: r.sourceName,
      raw: r.raw,
      value: outputValue(r),
      unit: r.unit ?? null,
    }));
    if (Object.keys(values).length === 0 && keep.length === 0) {
      toast.error("Keine übernehmbaren Messwerte gefunden.");
      return;
    }
    onApply(values, {
      profileName: profile?.name ?? "Ohne Profil",
      sampleLabel: sample?.label ?? "",
      count: Object.keys(values).length,
      unassigned: keep,
      metadata: metadataRows,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" /> Messdaten übernehmen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64">
                <Label className="text-xs">Importprofil</Label>
                <Select value={profileId || "__none__"} onValueChange={(v) => setProfileId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Profil wählen…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ohne Profil (nur Namensabgleich) —</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canManageProfiles && (
                <>
                  <Button variant="outline" size="sm" disabled={!profile}
                    onClick={() => { setEditingNew(false); setEditorOpen(true); }}>
                    <Settings2 className="h-3.5 w-3.5 mr-1" />Profil bearbeiten
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingNew(true); setEditorOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Neues Profil
                  </Button>
                </>
              )}
            </div>
            {profile?.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}

            <Tabs defaultValue="paste">
              <TabsList>
                <TabsTrigger value="paste" className="gap-1">
                  <ClipboardPaste className="h-3.5 w-3.5" />Einfügen
                </TabsTrigger>
                <TabsTrigger value="file" className="gap-1">
                  <FileUp className="h-3.5 w-3.5" />Messdatei
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="pt-3">
                <MeasurementFileImportPanel
                  profile={profile}
                  targets={targets}
                  currentValues={currentValues}
                  allowedImporters={allowedImporters}
                  onApply={(values, meta) => {
                    onApply(values, {
                      profileName: meta.importerLabel,
                      sampleLabel: meta.fileName,
                      count: meta.count,
                      source: `${meta.importerLabel} · ${meta.fileName} · Parser ${meta.parserVersion}`,
                    });
                    onOpenChange(false);
                  }}
                />
              </TabsContent>

              <TabsContent value="paste" className="pt-3 space-y-3">
            <div>

              <Label className="text-xs">Messdaten einfügen (Strg+V)</Label>
              <Textarea
                rows={7}
                value={text}
                onChange={(e) => { setText(e.target.value); setOverrides({}); setSampleIdx(0); }}
                placeholder={"SiO2\t54,2\nAl2O3\t38,1\nFe2O3\t1,05"}
                className="font-mono text-xs"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Unterstützt: Parameter/Wert-Listen, Tabellen mit Tabulator, Semikolon oder Leerzeichen –
                mit einer oder mehreren Proben. Deutsche und englische Zahlenformate werden erkannt.
              </p>
            </div>

            {parsed.samples.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Probe</Label>
                <Select value={String(sampleIdx)} onValueChange={(v) => { setSampleIdx(Number(v)); setOverrides({}); }}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {parsed.samples.map((s, i) => <SelectItem key={i} value={String(i)}>{s.label || `Probe ${i + 1}`}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  Mehrere Proben erkannt – es wird die gewählte Probe in diesen Formularabschnitt übernommen.
                </span>
              </div>
            )}

            {text.trim() !== "" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Format: {formatLabel(parsed.detectedFormat)}</Badge>
                  <Badge variant="secondary">{assigned.length} zugeordnet</Badge>
                  {unassigned.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />{unassigned.length} nicht zugeordnet (werden gespeichert)
                    </Badge>
                  )}
                  {metadataRows.length > 0 && <Badge variant="outline">{metadataRows.length} Metadaten</Badge>}
                  {invalid.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />{invalid.length} nicht lesbar
                    </Badge>
                  )}
                </div>

                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Datenname</th>
                        <th className="text-left p-2">Wert</th>
                        <th className="text-left p-2">Einheit</th>
                        <th className="text-left p-2">Kategorie</th>
                        <th className="text-left p-2">Zuordnung</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{r.sourceName}</td>
                          <td className="p-2 font-mono">{r.value ?? (r.belowDetection ? r.raw : r.raw)}</td>
                          <td className="p-2 text-muted-foreground">{r.unit ?? r.targetUnit ?? "—"}</td>
                          <td className="p-2"><Badge variant="secondary">Messwert</Badge></td>
                          <td className="p-2">
                            <Select
                              value={r.targetFieldKey ?? "__none__"}
                              onValueChange={(v) => setOverrides((p) => ({ ...p, [i]: v }))}
                            >
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-72">
                                <SelectItem value="__none__">— kein Feld (nicht zugeordnet speichern) —</SelectItem>
                                {targets.map((t) => (
                                  <SelectItem key={t.field_key} value={t.field_key}>
                                    {t.display_name}{t.unit ? ` [${t.unit}]` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            {!r.targetFieldKey ? <span className="text-amber-600">⚠ nicht zugeordnet – bleibt erhalten</span>
                              : r.value == null && !r.belowDetection ? <span className="text-destructive">nicht lesbar</span>
                              : r.unitMismatch ? <span className="text-amber-600">Einheit {r.unit} ≠ {r.targetUnit}</span>
                              : r.origin === "profile" ? <span className="text-muted-foreground">✓ Profil</span>
                              : r.origin === "auto" ? <span className="text-muted-foreground">✓ Namensabgleich</span>
                              : <span className="text-muted-foreground">✓ manuell</span>}
                          </td>
                        </tr>
                      ))}
                      {metadataRows.map((m, i) => (
                        <tr key={`meta-${i}`} className="border-t bg-muted/20">
                          <td className="p-2">{m.label}</td>
                          <td className="p-2 font-mono text-muted-foreground">{m.value}</td>
                          <td className="p-2 text-muted-foreground">—</td>
                          <td className="p-2"><Badge variant="outline">Metadaten</Badge></td>
                          <td className="p-2 text-muted-foreground">–</td>
                          <td className="p-2 text-muted-foreground">Importinformation</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {metadataRows.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Metadaten werden ausschließlich als Importinformation gespeichert und niemals als Ergebniswert übernommen.
                  </p>
                )}

                {parsed.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600">{w}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={apply} disabled={assigned.length === 0 && unassigned.length === 0}>
                {assigned.length} Wert(e) übernehmen
                {unassigned.length > 0 ? ` (+${unassigned.length} nicht zugeordnet)` : ""}
              </Button>
            </div>
              </TabsContent>
            </Tabs>
          </div>

        </DialogContent>
      </Dialog>

      <ImportProfileEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editingNew ? null : profile}
        targets={targets}
        onSaved={(p) => setProfileId(p.id)}
      />
    </>
  );
}

function formatLabel(f: string) {
  switch (f) {
    case "key_value": return "Parameter / Wert";
    case "table_params_in_rows": return "Tabelle (Parameter in Zeilen)";
    case "table_params_in_columns": return "Tabelle (Parameter in Spalten)";
    default: return "unbekannt";
  }
}
