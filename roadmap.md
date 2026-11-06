# ROX Roadmap – Nachträgliche Korrektur abgeschlossener Dienstleistungen

Auftrag: ROX_-_Umsetzung_Nachträgliche_Korrektur_pasted.md (freigegeben, Basis v4-Vorlage, G1)

## Offen
- [ ] Ist-Stand prüfen: replace_measurement_results, correct_measurement_result, can_correct_results, enforce_order_lock_on_children, storage.protect_delete, Tabellen/Constraints/RLS
- [ ] SQL-Migrationsdatei (additiv): neue SECURITY DEFINER RPC `correct_completed_measurement` + Historie/Idempotenz, G1 (keine neuen Messblock-Ergebnisse)
- [ ] Migration als Datei bereitstellen; Web-Cloud additiv anwenden; KEINE Ausführung auf Unternehmensdatenbank
- [ ] API-Domain-Funktion in src/lib/api/ für die RPC
- [ ] Frontend: Aktion „Nachträglich korrigieren" bei abgeschlossener Dienstleistung (nur zugeordneter MDL / Master)
- [ ] Korrekturmodus: Werte laden, klar unterscheidbar, Begründungspflicht, Änderungszusammenfassung, Abbrechen ohne Speichern
- [ ] Korrekturhistorie-UI (chronologisch, nicht editierbar)
- [ ] Tests: Berechtigungen, Ergebnisse (inkl. 0-Wert, G1-Abweisung), Historie, Idempotenz, Transaktion
- [ ] Testsuite + Typecheck + Build
- [ ] Abschlussbericht /mnt/documents/ROX-Nachtraegliche-Korrektur-Abschlussbericht.md

## Blockiert
- Tauri-Desktop-Test mit Unternehmensdatenbank (kein Zugang aus Sandbox)
