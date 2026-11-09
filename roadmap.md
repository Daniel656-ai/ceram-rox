# ROX Roadmap – Nachträgliche Korrektur abgeschlossener Dienstleistungen

## Aktuelle Freigabe: Offizielle Messergebnisse aus Repeater-Unterfeldern
- [x] Repeater-Unterfelder in `buildLinkedFormResultCandidates` über Instanzkonzept (`__instance_id`, `idx_<n>`-Rückfall) als Ergebniskandidaten; Container nie offiziell; flache Suche für Unterfelder entfernt.
- [x] `repeaterAggregateScope` in die Abschluss-Berechnungsauswertung eingebunden (Aggregate wie in der Formularanzeige).
- [x] `resolveResultPrecision` erkennt Repeater-Unterfelder (2/3 Nachkommastellen je Unterfeld).
- [x] Stabile Zeilenkennungen für Ergebnis-Repeater im Renderer (Vergabe + Selbstheilung bei Altdaten, frische Kennung beim Duplizieren).
- [x] Bereinigung: nur nachweislich entfernte Zeilen mit stabiler Kennung (`collectStaleRepeaterInstanceKeys`); historische/flache/positionsbasierte Ergebnisse bleiben unberührt.
- [x] 1.217 Tests (17 neue), Typprüfung bestanden. Keine DB-/Backend-/Infrastrukturänderungen.
- [ ] Web-Abnahme mit echter Aktivitätsmessung: blockiert – keine Schreibzugriffe/Testdaten im Produktivbestand erlaubt.
- [ ] Tauri-Abnahme mit Firmen-Datenbank: blockiert durch fehlenden Zugang zur Firmeninstallation.

## Freigabe: Abschließende Absicherung Hydration/Autosave/Repeater (A+B+C)
- [x] A: Einheitlicher frischer Datenbankabruf (`refetchOnMount: "always"` überall, Hydration erst nach `isFetchedAfterMount`).
- [x] B: Strikte Render-Schranke – Formular mountet erst nach abgeschlossener Hydration („Messdaten werden geladen …", Fehler mit Wiederholen).
- [x] C: Dirty-Tracking – Hintergrund-Updates nur ohne lokale Eingaben, sonst sichtbarer Konflikthinweis mit optionalem Übernehmen; `hydrationGuard.ts` + 14 Tests.
- [ ] Sieben Abnahmeszenarien Web: blockiert – keine Schreibzugriffe/Testdaten im Produktivbestand erlaubt.
- [ ] Tauri-Abnahme mit Firmen-Datenbank: blockiert durch fehlenden Zugang zur Firmeninstallation.

## Freigabe: kritische Behebung Messwertverlust (Phase 1+2)
- [x] Phase 1: Spiegel-Schutz (LinkedFieldControl/MasterDataFieldControl spiegeln erst nach erfolgreichem Laden/eindeutiger Auflösung) + Löschschutz für gespiegelte Felder im Entwurfsspeichern.
- [x] Phase 2: Autosave auch außerhalb des Messdurchlaufs, sichtbarer Speicherstatus, Warnung beim Schließen mit ungespeicherten Änderungen, serialisierte Speicherung, Freigabe nur nach erfolgreichem Speichern.
- [x] 1.189 Tests, Typprüfung, Build bestanden; Web-Bearbeitungsseite lesend geprüft (Statusanzeige sichtbar, Werte hydriert, keine neuen Fehler).
- [ ] Web-Abnahme der zehn Testszenarien mit echten Eingaben: blockiert – keine Testdaten/Schreibzugriffe im Produktivbestand erlaubt.
- [ ] Tauri-Abnahme mit Firmen-Datenbank: blockiert durch fehlenden Zugang zur Firmeninstallation.

## Freigabe: eindeutige Feldzuordnung bei Vorlagenkopien
- [x] Exakte Formularidentitäten ausschließlich als Identifikationsindex nutzen; uneindeutige Parameter mit Warnung überspringen.
- [x] Warnungen im Vorlagendialog anzeigen; 1.170 Tests und automatische Typ-/Buildprüfung bestanden.
- [x] Angemeldete Web-Neuanlage ohne Datenänderungen geprüft; technischer Änderungsbericht erstellt.
- [ ] Web-Abnahme am echten Gasfeldauftrag: blockiert durch fehlenden Vorlagenzugang der verfügbaren Sitzung; keine Rechteänderung.
- [ ] Tauri-Abnahme mit Firmen-Datenbank: blockiert durch fehlenden Zugang zur Firmeninstallation.

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
