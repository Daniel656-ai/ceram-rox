# Roadmap

## Aktuell: Ergebnisänderung und -ergänzung (freigegeben 30.10.2026)

- [ ] Finalen SQL-Entwurf aus Chat-Historie rekonstruieren und gegen reales Web-Schema verifizieren (Spaltentypen, Constraints, FKs, RLS, Berechtigungsfunktionen)
- [ ] Additive Migration: `measurement_results.text_value`, `measurement_result_corrections` (change_type 'ergänzt', operation_id, raw_dataset_id), `measurement_raw_datasets` (replaces_dataset_id, operation_id, superseded_at), neue Tabelle `measurement_import_operations`, UNIQUE-Index auf kanonische Ergebnisidentität
- [ ] RPC `replace_measurement_results` (SECURITY DEFINER, Advisory Locks, Idempotenz, Transaktionssicherheit, serverseitiges is_official)
- [ ] Typisierte API-Anbindung in `src/lib/api/` (Domain-Funktion, kein direkter supabase-Zugriff in UI)
- [ ] Frontend-Erweiterung: Ergebnisimport-/Korrekturbereich (MeasurementFileImportPanel/Korrektur-Dialog) mit operation_id, Begründung, Textwerten
- [ ] Regressionstests: Wertänderung, Ergänzung, Berechtigungen, Historie, Idempotenz, Rollback
- [ ] Testsuite + Build ausführen, Abschlussbericht (Dateien, Migrationen, RPC, Datenfluss, Tests, offene Punkte, Web-/Desktop-Status)
