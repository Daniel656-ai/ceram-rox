/**
 * Reine Logik für die nachträgliche Korrektur abgeschlossener Dienstleistungen
 * (RPC `amend_completed_measurement`, Freigabevorlage v4, Entscheidung G1).
 *
 * Die Funktionen hier bauen und validieren ausschließlich den Payload –
 * sie schreiben nichts. Alle fachlichen Sperren (Berechtigung, Status,
 * G1-Sperre für neue Messblock-Ergebnisse, Idempotenz, Historie) werden
 * zusätzlich serverseitig erzwungen.
 */

export interface ExistingResult {
  id: string;
  result_name: string;
  instance_key: string | null;
  display_label: string | null;
  unit: string | null;
  value: number | null;
  text_value: string | null;
  remarks: string | null;
  is_official: boolean;
}

/** Ein übermittelter Werteeintrag. Fehlender Schlüssel = beibehalten, null = leeren. */
export interface ResultEdit {
  result_name: string;
  instance_key: string | null;
  value?: number | null;
  text_value?: string | null;
  remarks?: string | null;
}

export interface ResultRemoval {
  result_name: string;
  instance_key: string | null;
}

export interface FileChange {
  kind: "upload" | "document";
  /** Vorhandene Datei, die ersetzt wird; null/undefined = ergänzen. */
  old_id?: string | null;
  storage_path: string;
  file_name: string;
  file_type?: string | null;
  file_size_bytes?: number | null;
  field_key?: string;
  entry_index?: number | null;
}

export interface AmendmentPayload {
  orderMeasurementId: string;
  operationId: string;
  reason: string;
  values: ResultEdit[];
  remove: ResultRemoval[];
  files: FileChange[];
}

export interface AmendmentChange {
  result_name: string;
  instance_key: string | null;
  label: string;
  kind: "modified" | "cleared" | "removed" | "added";
  oldDisplay: string;
  newDisplay: string;
}

/**
 * Kollisionsfreier Identitätsschlüssel: getrennte Bestandteile per JSON,
 * niemals eine verkettete Zeichenkette aus result_name + instance_key.
 */
export const resultIdentityKey = (resultName: string, instanceKey: string | null | undefined): string =>
  JSON.stringify([resultName, instanceKey ?? ""]);

/** G1: Messblock-Ergebnisse tragen das Muster form:<uuid>:<block>[<instanz>].<feld>. */
const BLOCK_ENTRY_RE = /^form:[0-9a-f-]{36}:[^\[\]]+\[[^\]]+\]\..+$/;
export const isBlockEntryResultName = (resultName: string): boolean => BLOCK_ENTRY_RE.test(resultName);

const displayValue = (r: { value: number | null; text_value: string | null; remarks: string | null }): string => {
  if (r.value !== null && r.value !== undefined) return String(r.value);
  if (r.text_value !== null && r.text_value !== undefined && r.text_value !== "") return r.text_value;
  if (r.remarks !== null && r.remarks !== undefined && r.remarks !== "") return r.remarks;
  return "–";
};

/**
 * Leitet aus den vorhandenen Ergebnissen und den Benutzereingaben die
 * effektiven Änderungen ab. Unveränderte Felder werden nicht übermittelt.
 */
export function buildAmendmentChanges(
  existing: ExistingResult[],
  edits: ResultEdit[],
  removals: ResultRemoval[],
): { values: ResultEdit[]; remove: ResultRemoval[]; changes: AmendmentChange[] } {
  const byKey = new Map(existing.map((r) => [resultIdentityKey(r.result_name, r.instance_key), r]));
  const removalKeys = new Set(removals.map((r) => resultIdentityKey(r.result_name, r.instance_key)));

  const values: ResultEdit[] = [];
  const changes: AmendmentChange[] = [];

  for (const edit of edits) {
    const key = resultIdentityKey(edit.result_name, edit.instance_key);
    if (removalKeys.has(key)) continue; // Entfernen hat Vorrang; serverseitig ohnehin abgewiesen
    const old = byKey.get(key);
    const label = old?.display_label ?? edit.result_name;

    if (!old) {
      // Neuer Eintrag (kein Messblock – das filtert die UI und der Server).
      const hasContent =
        (edit.value !== undefined && edit.value !== null) ||
        (edit.text_value !== undefined && edit.text_value !== null && edit.text_value !== "") ||
        (edit.remarks !== undefined && edit.remarks !== null && edit.remarks !== "");
      if (!hasContent) continue;
      values.push(edit);
      changes.push({
        result_name: edit.result_name,
        instance_key: edit.instance_key,
        label,
        kind: "added",
        oldDisplay: "–",
        newDisplay: displayValue({
          value: edit.value ?? null,
          text_value: edit.text_value ?? null,
          remarks: edit.remarks ?? null,
        }),
      });
      continue;
    }

    const next = {
      value: edit.value !== undefined ? edit.value : old.value,
      text_value: edit.text_value !== undefined ? edit.text_value : old.text_value,
      remarks: edit.remarks !== undefined ? edit.remarks : old.remarks,
    };
    const unchanged =
      next.value === old.value && next.text_value === old.text_value && next.remarks === old.remarks;
    if (unchanged) continue;

    values.push(edit);
    const allCleared = next.value === null && !next.text_value && !next.remarks;
    changes.push({
      result_name: edit.result_name,
      instance_key: edit.instance_key,
      label,
      kind: allCleared ? "cleared" : "modified",
      oldDisplay: displayValue(old),
      newDisplay: allCleared ? "–" : displayValue(next),
    });
  }

  const remove: ResultRemoval[] = [];
  for (const rem of removals) {
    const old = byKey.get(resultIdentityKey(rem.result_name, rem.instance_key));
    if (!old) continue;
    remove.push(rem);
    changes.push({
      result_name: rem.result_name,
      instance_key: rem.instance_key,
      label: old.display_label ?? rem.result_name,
      kind: "removed",
      oldDisplay: displayValue(old),
      newDisplay: "–",
    });
  }

  return { values, remove, changes };
}

/**
 * Clientseitige Vorabvalidierung (spiegelt die serverseitigen Prüfungen,
 * ersetzt sie aber nicht). Liefert verständliche Fehlermeldungen.
 */
export function validateAmendment(args: {
  reason: string;
  existing: ExistingResult[];
  values: ResultEdit[];
  remove: ResultRemoval[];
  files: FileChange[];
}): string[] {
  const errors: string[] = [];
  const { reason, existing, values, remove, files } = args;

  if (!reason || reason.trim().length === 0) {
    errors.push("Eine Begründung ist erforderlich.");
  }

  const existingKeys = new Set(existing.map((r) => resultIdentityKey(r.result_name, r.instance_key)));
  const valueKeys = new Set<string>();
  const removeKeys = new Set<string>();

  for (const rem of remove) {
    const key = resultIdentityKey(rem.result_name, rem.instance_key);
    if (removeKeys.has(key)) errors.push(`Doppelter Entfernen-Eintrag für ${rem.result_name}.`);
    removeKeys.add(key);
    if (!existingKeys.has(key)) errors.push(`Zu entfernendes Feld ${rem.result_name} existiert nicht.`);
  }

  for (const edit of values) {
    const key = resultIdentityKey(edit.result_name, edit.instance_key);
    if (valueKeys.has(key)) errors.push(`Doppelter Eintrag für ${edit.result_name}.`);
    valueKeys.add(key);
    if (removeKeys.has(key)) errors.push(`Feld ${edit.result_name} ist gleichzeitig geändert und entfernt.`);
    const hasValue = edit.value !== undefined && edit.value !== null;
    const hasText = edit.text_value !== undefined && edit.text_value !== null && edit.text_value !== "";
    if (hasValue && hasText) {
      errors.push(`Widerspruch für ${edit.result_name}: Zahl und Text dürfen nicht gleichzeitig gesetzt werden.`);
    }
    // G1: neue Messblock-Ergebnisse sind gesperrt (bestehende bleiben korrigierbar).
    if (!existingKeys.has(key) && isBlockEntryResultName(edit.result_name)) {
      errors.push(
        `Neue Messblock-Ergebnisse können im nachträglichen Korrekturmodus nicht angelegt werden (${edit.result_name}).`,
      );
    }
    // Ein bestehender Datensatz darf nicht versehentlich vollständig geleert werden.
    const old = existing.find((r) => resultIdentityKey(r.result_name, r.instance_key) === key);
    if (old) {
      const next = {
        value: edit.value !== undefined ? edit.value : old.value,
        text_value: edit.text_value !== undefined ? edit.text_value : old.text_value,
        remarks: edit.remarks !== undefined ? edit.remarks : old.remarks,
      };
      if (next.value === null && !next.text_value && !next.remarks) {
        errors.push(`Feld ${edit.result_name} wäre danach leer – zum Entfernen die Löschaktion verwenden.`);
      }
    }
  }

  const seenPaths = new Set<string>();
  const seenOldIds = { upload: new Set<string>(), document: new Set<string>() };
  for (const f of files) {
    if (!f.storage_path || !f.storage_path.trim()) errors.push("Datei ohne Speicherpfad.");
    if (!f.file_name || !f.file_name.trim()) errors.push("Datei ohne Dateinamen.");
    if (f.storage_path && seenPaths.has(f.storage_path)) {
      errors.push(`Doppelter Speicherpfad: ${f.storage_path}.`);
    }
    if (f.storage_path) seenPaths.add(f.storage_path);
    if (f.old_id) {
      const set = seenOldIds[f.kind];
      if (set.has(f.old_id)) errors.push(`Datei ${f.old_id} wird mehrfach ersetzt.`);
      set.add(f.old_id);
    }
    if (f.file_size_bytes !== undefined && f.file_size_bytes !== null && f.file_size_bytes < 0) {
      errors.push(`Ungültige Dateigröße bei ${f.file_name}.`);
    }
  }

  if (values.length === 0 && remove.length === 0 && files.length === 0) {
    errors.push("Keine Änderungen gegenüber dem gespeicherten Stand.");
  }

  return errors;
}
