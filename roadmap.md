# Roadmap

## m³-Schriftgestaltung und Platzoptimierung (02.11.2026)
- [ ] Bestehende Abschnittsstruktur prüfen und ohne persistente Änderungen kompakt anordnen.
- [ ] Tabelleninhalt und Überschriften fett, zwei Schriftstufen größer in Bildschirm, HTML und PDF.
- [ ] Vorhandene Tests ausführen, Bildschirm und A4-Druck separat prüfen; Dateien und Ergebnisse dokumentieren.
- [ ] Desktop-Abnahme: benötigt tatsächliche ROX-Desktop-Anwendung, aus Sandbox nicht verfügbar.

## Ergebnisänderung und -ergänzung (freigegeben 30.10.2026) — umgesetzt

- [x] Finalen SQL-Entwurf gegen reales Web-Schema verifiziert (Spaltentypen, Constraints, FKs, RLS, Berechtigungsfunktionen, 0 Dubletten)
- [x] Additive Migration `0022_replace_measurement_results`: `measurement_results.text_value`, `measurement_result_corrections` (change_type 'ergänzt', operation_id, raw_dataset_id), `measurement_raw_datasets` (replaces_dataset_id, operation_id, superseded_at), Tabelle `measurement_import_operations` (Grants + RLS), UNIQUE-Index auf kanonische Identität
- [x] RPC `replace_measurement_results` (SECURITY DEFINER, Advisory Locks, Idempotenz via Payload-Hash, serverseitiges is_official, transaktionssicher)
- [x] API-Anbindung `api.resultCorrections.replaceResults` + Hook `useReplaceMeasurementResults`
- [x] Reines Modul `src/lib/results/replaceResults.ts` (parseResultInput, canonicalResultKey, buildReplaceResultsPayload, buildChangedEntries)
- [x] Dialog `ReplaceResultsDialog.tsx`, verankert in `OrderResultsDetail.tsx` (Button „Ergebnisse ändern/ergänzen")
- [x] 24 neue Regressionstests (`src/test/replaceResults.test.ts`); Gesamtsuite 893 Tests / 118 Dateien bestanden; Build OK
- [ ] Browser-Abnahme des Dialogs im Web (angemeldet, echter Auftrag)
- [ ] Desktop-/Tauri-Abnahme (nicht möglich aus Sandbox — bleibt offen)
