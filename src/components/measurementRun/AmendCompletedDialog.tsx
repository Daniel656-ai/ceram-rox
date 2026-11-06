import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAmendCompletedMeasurement } from "@/hooks/useResultCorrections";
import {
  buildAmendmentChanges,
  validateAmendment,
  resultIdentityKey,
  type ExistingResult,
  type ResultEdit,
  type ResultRemoval,
  type FileChange,
} from "@/lib/amendment/payload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FilePlus2, FileSymlink, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface PendingFile {
  kind: "upload" | "document";
  file: File;
  old_id?: string | null;
  old_name?: string | null;
  field_key?: string;
  entry_index?: number | null;
}

/**
 * Nachträgliche Korrektur einer abgeschlossenen Dienstleistung
 * (Freigabevorlage v4, Entscheidung G1). Die Dienstleistung bleibt
 * abgeschlossen; jede Korrektur ist begründungspflichtig und wird
 * vollständig historisiert (serverseitig über `amend_completed_measurement`).
 */
export default function AmendCompletedDialog({
  open,
  onOpenChange,
  measurementId,
  serviceId,
  addableFields,
  fileFields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  measurementId: string;
  serviceId?: string;
  /** Bekannte Felddefinitionen für das Ergänzen fehlender Ergebnisse (ohne Messblock-Einträge). */
  addableFields: Array<{ key: string; label: string; unit: string | null }>;
  /** Datei-/Bildfelder der Dienstleistung für das Ergänzen von Dateien. */
  fileFields: Array<{ key: string; label: string }>;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const amend = useAmendCompletedMeasurement();

  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ["amend-results", measurementId],
    queryFn: () => api.measurementResults.list(measurementId),
    enabled: open && !!measurementId,
  });
  const { data: uploads = [] } = useQuery({
    queryKey: ["amend-uploads", measurementId],
    queryFn: () => api.orderUploads.listForMeasurement(measurementId),
    enabled: open && !!measurementId,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["amend-documents", measurementId],
    queryFn: () => api.documents.listForMeasurement(measurementId),
    enabled: open && !!measurementId,
  });

  const existing: ExistingResult[] = useMemo(
    () =>
      (results as any[]).map((r) => ({
        id: r.id,
        result_name: r.result_name,
        instance_key: r.instance_key ?? null,
        display_label: r.display_label ?? null,
        unit: r.unit ?? null,
        value: r.value ?? null,
        text_value: r.text_value ?? null,
        remarks: r.remarks ?? null,
        is_official: !!r.is_official,
      })),
    [results],
  );

  const [edits, setEdits] = useState<Map<string, ResultEdit>>(new Map());
  const [removals, setRemovals] = useState<Map<string, ResultRemoval>>(new Map());
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [addFieldKey, setAddFieldKey] = useState("");
  const [addUploadKey, setAddUploadKey] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<PendingFile | null>(null);

  const reset = () => {
    setEdits(new Map());
    setRemovals(new Map());
    setPendingFiles([]);
    setAddFieldKey("");
    setAddUploadKey("");
    setReason("");
  };

  const setEdit = (r: ExistingResult, patch: Partial<ResultEdit>) => {
    const key = resultIdentityKey(r.result_name, r.instance_key);
    setEdits((prev) => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { result_name: r.result_name, instance_key: r.instance_key };
      next.set(key, { ...cur, ...patch });
      return next;
    });
  };

  const toggleRemoval = (r: ExistingResult) => {
    const key = resultIdentityKey(r.result_name, r.instance_key);
    setRemovals((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { result_name: r.result_name, instance_key: r.instance_key });
      return next;
    });
  };

  const existingKeys = useMemo(
    () => new Set(existing.map((r) => resultIdentityKey(r.result_name, r.instance_key))),
    [existing],
  );
  const addable = useMemo(
    () => addableFields.filter((f) => !existingKeys.has(resultIdentityKey(f.key, null))),
    [addableFields, existingKeys],
  );

  const { changes, values, remove } = useMemo(
    () => buildAmendmentChanges(existing, Array.from(edits.values()), Array.from(removals.values())),
    [existing, edits, removals],
  );

  const validationErrors = useMemo(
    () =>
      validateAmendment({
        reason,
        existing,
        values,
        remove,
        files: pendingFiles.map((f) => ({
          kind: f.kind,
          old_id: f.old_id ?? null,
          storage_path: `pending:${f.file.name}`, // Platzhalter; echter Pfad entsteht beim Upload
          file_name: f.file.name,
          file_size_bytes: f.file.size,
        })),
      }),
    [reason, existing, values, remove, pendingFiles],
  );
  // Pfad-Dubletten entstehen erst beim Upload (Zeitstempel) – hier nicht relevant.
  const shownErrors = validationErrors.filter((e) => !e.includes("Speicherpfad"));

  const onReplacePicked = (file: File | null) => {
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;
    setPendingFiles((prev) => [...prev, { ...target, file }]);
  };

  const submit = async () => {
    if (!user) return;
    if (shownErrors.length > 0) {
      toast.error("Korrektur nicht möglich", { description: shownErrors[0] });
      return;
    }
    setSubmitting(true);
    const uploadedPaths: Array<{ kind: "upload" | "document"; path: string }> = [];
    try {
      // 1. Dateien außerhalb der Datenbanktransaktion hochladen.
      const files: FileChange[] = [];
      for (const pf of pendingFiles) {
        const { path } =
          pf.kind === "upload"
            ? await api.orderUploads.uploadOnly({
                measurementId,
                fieldKey: pf.field_key!,
                file: pf.file,
              })
            : await api.documents.uploadOnly({ measurementId, file: pf.file, userId: user.id });
        uploadedPaths.push({ kind: pf.kind, path });
        files.push({
          kind: pf.kind,
          old_id: pf.old_id ?? null,
          storage_path: path,
          file_name: pf.file.name,
          file_type: pf.file.type || null,
          file_size_bytes: pf.file.size,
          field_key: pf.field_key,
          entry_index: pf.entry_index ?? null,
        });
      }

      // 2. Atomarer Datenbankvorgang inkl. Historie und Idempotenz.
      await amend.mutateAsync({
        orderMeasurementId: measurementId,
        operationId: crypto.randomUUID(),
        reason: reason.trim(),
        values,
        remove,
        files,
      });

      toast.success("Korrektur gespeichert", {
        description: "Die Dienstleistung bleibt abgeschlossen; die Änderungen wurden historisiert.",
      });
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      // 3. Verwaiste Storage-Objekte nach einem fehlgeschlagenen Datenbankvorgang bereinigen.
      for (const up of uploadedPaths) {
        try {
          if (up.kind === "upload") await api.orderUploads.removeStorageObject(up.path);
          else await api.documents.removeStorageObject(up.path);
        } catch { /* Bereinigung ist best-effort */ }
      }
      toast.error("Korrektur fehlgeschlagen", { description: err?.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const renderValueInput = (r: ExistingResult) => {
    const key = resultIdentityKey(r.result_name, r.instance_key);
    const edit = edits.get(key);
    const removed = removals.has(key);
    const eff = {
      value: edit && "value" in edit ? edit.value ?? null : r.value,
      text_value: edit && "text_value" in edit ? edit.text_value ?? null : r.text_value,
      remarks: edit && "remarks" in edit ? edit.remarks ?? null : r.remarks,
    };
    const isStructured =
      (eff.remarks ?? "").trim().startsWith("[") || (eff.remarks ?? "").trim().startsWith("{");

    return (
      <div className={`flex flex-wrap items-center gap-2 ${removed ? "opacity-50 line-through" : ""}`}>
        {r.value !== null || (edit && "value" in edit) ? (
          <Input
            type="number"
            step="any"
            className="w-36"
            disabled={removed}
            value={eff.value === null ? "" : String(eff.value)}
            onChange={(e) =>
              setEdit(r, { value: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        ) : (
          <Input
            className="w-56"
            disabled={removed}
            value={eff.text_value ?? ""}
            onChange={(e) => setEdit(r, { text_value: e.target.value === "" ? null : e.target.value })}
          />
        )}
        {r.remarks !== null && (
          isStructured ? (
            <span className="text-xs text-muted-foreground">Strukturierte Daten (Messblock/Wiederholung) bleiben erhalten</span>
          ) : (
            <Input
              className="w-56"
              placeholder="Bemerkung"
              disabled={removed}
              value={eff.remarks ?? ""}
              onChange={(e) => setEdit(r, { remarks: e.target.value === "" ? null : e.target.value })}
            />
          )
        )}
        {r.unit && <span className="text-xs text-muted-foreground">{r.unit}</span>}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Nachträgliche Korrektur
          </DialogTitle>
          <DialogDescription>
            Die Dienstleistung bleibt abgeschlossen. Jede Änderung erfordert eine Begründung und
            wird vollständig in der Korrekturhistorie dokumentiert.
          </DialogDescription>
        </DialogHeader>

        {loadingResults ? (
          <p className="text-sm text-muted-foreground">Gespeicherte Werte werden geladen…</p>
        ) : (
          <div className="space-y-6">
            {/* Ergebnisse */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Vorhandene Ergebnisse</h3>
              {existing.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine gespeicherten Ergebnisse vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {existing.map((r) => {
                    const key = resultIdentityKey(r.result_name, r.instance_key);
                    const removed = removals.has(key);
                    return (
                      <div key={r.id} className="border rounded-md p-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {r.display_label || r.result_name}
                            {r.instance_key && (
                              <span className="ml-2 text-xs text-muted-foreground">[{r.instance_key}]</span>
                            )}
                            {r.is_official && (
                              <Badge variant="outline" className="ml-2 text-[10px]">offiziell</Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={removed ? "outline" : "ghost"}
                            onClick={() => toggleRemoval(r)}
                          >
                            {removed ? (
                              <><Undo2 className="h-3 w-3 mr-1" /> Behalten</>
                            ) : (
                              <><Trash2 className="h-3 w-3 mr-1" /> Entfernen</>
                            )}
                          </Button>
                        </div>
                        {renderValueInput(r)}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ergebnis ergänzen (keine Messblock-Ergebnisse – G1) */}
              {addable.length > 0 && (
                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1">
                    <Label className="text-xs">Fehlendes Ergebnis ergänzen</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={addFieldKey}
                      onChange={(e) => setAddFieldKey(e.target.value)}
                    >
                      <option value="">– Feld wählen –</option>
                      {addable.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!addFieldKey}
                    onClick={() => {
                      const def = addable.find((f) => f.key === addFieldKey);
                      if (!def) return;
                      const key = resultIdentityKey(def.key, null);
                      setEdits((prev) => {
                        const next = new Map(prev);
                        next.set(key, { result_name: def.key, instance_key: null, value: null });
                        return next;
                      });
                      setAddFieldKey("");
                    }}
                  >
                    Hinzufügen
                  </Button>
                </div>
              )}

              {/* Neu hinzugefügte Felder */}
              {Array.from(edits.values())
                .filter((e) => !existingKeys.has(resultIdentityKey(e.result_name, e.instance_key)))
                .map((e) => {
                  const def = addableFields.find((f) => f.key === e.result_name);
                  const key = resultIdentityKey(e.result_name, e.instance_key);
                  return (
                    <div key={key} className="border border-dashed rounded-md p-2 space-y-1">
                      <div className="text-sm font-medium">
                        {def?.label || e.result_name}
                        <Badge variant="secondary" className="ml-2 text-[10px]">neu</Badge>
                      </div>
                      <Input
                        type="number"
                        step="any"
                        className="w-36"
                        value={e.value === null || e.value === undefined ? "" : String(e.value)}
                        onChange={(ev) =>
                          setEdits((prev) => {
                            const next = new Map(prev);
                            next.set(key, { ...e, value: ev.target.value === "" ? null : Number(ev.target.value) });
                            return next;
                          })
                        }
                      />
                    </div>
                  );
                })}
            </section>

            {/* Dateien und Dokumente */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Dateien und Dokumente</h3>
              {uploads.length === 0 && docs.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Dateien vorhanden.</p>
              )}
              {uploads.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <span>{u.file_name} <span className="text-xs text-muted-foreground">({u.field_key})</span></span>
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => {
                      replaceTargetRef.current = { kind: "upload", old_id: u.id, old_name: u.file_name, field_key: u.field_key, entry_index: u.entry_index, file: null as unknown as File };
                      uploadInputRef.current?.click();
                    }}
                  >
                    <FileSymlink className="h-3 w-3 mr-1" /> Ersetzen
                  </Button>
                </div>
              ))}
              {docs.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <span>{d.file_name} <span className="text-xs text-muted-foreground">(Messdokument)</span></span>
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => {
                      replaceTargetRef.current = { kind: "document", old_id: d.id, old_name: d.file_name, file: null as unknown as File };
                      docInputRef.current?.click();
                    }}
                  >
                    <FileSymlink className="h-3 w-3 mr-1" /> Ersetzen
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap items-end gap-2 pt-2">
                {fileFields.length > 0 && (
                  <>
                    <div>
                      <Label className="text-xs">Datei zu Feld ergänzen</Label>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={addUploadKey}
                        onChange={(e) => setAddUploadKey(e.target.value)}
                      >
                        <option value="">– Feld wählen –</option>
                        {fileFields.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button" variant="outline" disabled={!addUploadKey}
                      onClick={() => {
                        replaceTargetRef.current = { kind: "upload", field_key: addUploadKey, file: null as unknown as File };
                        uploadInputRef.current?.click();
                      }}
                    >
                      <FilePlus2 className="h-3 w-3 mr-1" /> Datei wählen
                    </Button>
                  </>
                )}
                <Button
                  type="button" variant="outline"
                  onClick={() => {
                    replaceTargetRef.current = { kind: "document", file: null as unknown as File };
                    docInputRef.current?.click();
                  }}
                >
                  <FilePlus2 className="h-3 w-3 mr-1" /> Dokument ergänzen
                </Button>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-1 pt-1">
                  {pendingFiles.map((pf, i) => (
                    <div key={i} className="flex items-center justify-between border border-dashed rounded-md p-2 text-sm">
                      <span>
                        {pf.file?.name}
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {pf.old_id ? `ersetzt ${pf.old_name}` : pf.kind === "upload" ? `neu (${pf.field_key})` : "neu (Dokument)"}
                        </Badge>
                      </span>
                      <Button
                        type="button" size="sm" variant="ghost"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={uploadInputRef} type="file" className="hidden"
                onChange={(e) => { onReplacePicked(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
              <input
                ref={docInputRef} type="file" className="hidden"
                onChange={(e) => { onReplacePicked(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
            </section>

            {/* Begründung */}
            <section className="space-y-1">
              <Label>Korrekturgrund *</Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pflichtfeld: Warum wird die abgeschlossene Dienstleistung korrigiert?"
              />
            </section>

            {/* Zusammenfassung */}
            <section className="space-y-1">
              <h3 className="text-sm font-semibold">Zusammenfassung der Änderungen</h3>
              {changes.length === 0 && pendingFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Änderungen vorgenommen.</p>
              ) : (
                <ul className="text-sm space-y-0.5">
                  {changes.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium">{c.label}</span>{" "}
                      {c.kind === "modified" && <>geändert: <span className="line-through text-muted-foreground">{c.oldDisplay}</span> → {c.newDisplay}</>}
                      {c.kind === "cleared" && <>wird geleert (bisher: {c.oldDisplay})</>}
                      {c.kind === "removed" && <>wird entfernt (bisher: {c.oldDisplay})</>}
                      {c.kind === "added" && <>wird ergänzt: {c.newDisplay}</>}
                    </li>
                  ))}
                  {pendingFiles.map((pf, i) => (
                    <li key={`f${i}`}>
                      <span className="font-medium">{pf.file?.name}</span>{" "}
                      {pf.old_id ? `ersetzt ${pf.old_name}` : "wird ergänzt"}
                    </li>
                  ))}
                </ul>
              )}
              {shownErrors.length > 0 && (
                <ul className="text-sm text-destructive space-y-0.5 pt-1">
                  {shownErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </section>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                disabled={submitting}
                onClick={() => { reset(); onOpenChange(false); }}
              >
                Abbrechen
              </Button>
              <Button
                disabled={submitting || shownErrors.length > 0}
                onClick={submit}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Korrektur speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
