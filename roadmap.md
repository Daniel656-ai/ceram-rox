# ROX Roadmap – Nachträgliche Korrektur abgeschlossener Dienstleistungen

Auftrag: ROX_-_Umsetzung_Nachträgliche_Korrektur_pasted.md (freigegeben, Basis v4-Vorlage, G1)

## Erledigt
- [x] Ist-Stand geprüft (replace_measurement_results, can_correct_results, Sperrtrigger, Storage, Constraints)
- [x] Additive SQL-Migration angewendet (nur Web-Cloud): RPC `amend_completed_measurement` + `rox_file_versions`, G1-Sperre, Historie, Idempotenz – `drizzle/migrations/0023_amend_completed_measurement.sql`
- [x] API-Domain-Funktionen: `resultCorrections.amendCompleted`/`fileVersions`, `orderUploads.uploadOnly`, `documents.uploadOnly`/`listForMeasurement`
- [x] Reine Payload-Logik `src/lib/amendment/payload.ts` + 22 Tests
- [x] Frontend: „Nachträglich korrigieren" + „Korrekturhistorie" bei abgeschlossener Dienstleistung (TaskExecutionPage, AmendCompletedDialog, erweiterter CorrectionHistoryDialog)
- [x] 1114 Tests, Typecheck, Build – alle bestanden

## Blockiert
- Tauri-Desktop-Test mit Unternehmensdatenbank (kein Zugang aus Sandbox)
- Web-Browser-Test mit echter abgeschlossener Dienstleistung (keine Testdaten im Produktivbestand erlaubt)
- Firmendatenbank: Migration NICHT ausgeführt (ausdrücklich untersagt) – separates Freigabeverfahren
