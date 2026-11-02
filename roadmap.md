# Roadmap

## m³-Schriftgestaltung und Platzoptimierung (02.11.2026)
- [ ] Seitliche Anordnung wartet auf Zuordnung: vorhandene Liste hat Kopfdaten, Kontrollfelder und Berechnungen, aber keinen separaten Abschnitt Auftragsdetails/Labormessungen. Keine Felder spekulativ verschoben.
- [x] Tabelleninhalt und Überschriften fett, zwei Schriftstufen größer in Bildschirm (13 → 16 px), HTML (9 → 12 pt) und PDF (10 → 12 pt).
- [x] 104 m³-Tests und gesamte Suite (900 Tests, 119 Dateien) bestanden; Build OK. Bestehende Liste angemeldet ohne Schreiben geprüft: Bildschirm, HTML-Druck und PDF vollständig, beide Druckwege eine A4-Seite. Dokumentation: m3-typography-review.md.
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
