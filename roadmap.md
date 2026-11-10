# ROX Roadmap – Nachträgliche Korrektur abgeschlossener Dienstleistungen

## Freigabe: Individuelle AV-Werte (2026-11-10)
- [ ] Zeilenlokalen AV-Vorrang ausschließlich für platzierte K-Wert-Berechnungen ergänzen; Vorgabe/Formeln/Historie unverändert.
- [ ] Werte 40/50/60, Einzeländerung 55, JSON-Wiederöffnung und unveränderte Integritätsprüfung testen; Abschlussbericht.
- [ ] Vollständige Web-Schreibabnahme: benötigt isolierte reale NOx-Formularkonfiguration, keine Produktiv-Testdaten verändern.
- [ ] Tauri-Abnahme: benötigt erreichbare Unternehmensinstallation.

## Freigabe: Prüfmittelüberwachung Phase 1 (2026-11-10)
- [x] Additive Web-Migrationen 0029–0032, sichere Prüfungs-RPCs und unveränderliche Historie.
- [x] Prüfmittelverwaltung, interne Prüfungen, Korrekturen und Wartungsfreigabe; DE/EN.
- [x] Kundenlisten/Ergebnisse/Statistiken gefiltert, restriktive externe Isolation und interne Ergebnis-/Verrechnungssperre; Admin-Gesamtsicherung bleibt vollständig.
- [ ] 23 initiale Prüfmittel übernehmen: Original-Prüfmittelplan.xlsx mit Intervallen und Verantwortlichen fehlt.
- [x] 1283 Unit-Tests, isolierte SQL-Prüfungen, Webprüfung DE/EN ohne Produktiv-Testdaten; vollständige Web-Schreibabnahme/Parallelrennen benötigen isolierte echte ROX-Testumgebung.
- [x] Separate Unternehmens-SQL und technischer Abschlussbericht.
- [ ] Desktop-Abnahme: benötigt erreichbare Tauri-Unternehmensinstallation.

## Aktuelle Freigabe: Erweiterung intelligenter Rohstoff-Repeater (g, Lot, Layout)
- [x] `recipeUnits.ts`: zentrale Einheitenumrechnung (g↔kg, ml↔l), `defaultRecipeUnit` (Feststoffe→g), `compareStock` in Bestandseinheit; inkompatible Einheiten → kein Alarm.
- [x] `RecipeMaterialRow` additiv um `container_id`/`lot_number` (Snapshot) erweitert; `stripRecipeLotAssignments` für Vorlagenkopien.
- [x] `RawMaterialRecipeField.tsx`: Lot-/Gebindeauswahl (nur passende, aktive Gebinde; Snapshot bei archiviertem Gebinde), zweistufige Bestandsprüfung (Gesamt + Gebinde), einheitliches 8-Spalten-Grid mit festen Breiten für Handle/Badge/Löschen.
- [x] `orderTemplateInputs.ts`: Vorlagenkopien setzen `container_id`/`lot_number` zurück; `RecipeDocumentationCard.tsx` zeigt Lot an.
- [x] 1.245 Tests (24 neue), Typprüfung bestanden. Keine DB-/Backend-/Infrastrukturänderungen.
- [ ] Web-Abnahme mit echten Rezepturen/Gebinden: blockiert – keine Schreibzugriffe/Testdaten im Produktivbestand erlaubt.
- [ ] Tauri-Abnahme mit Firmen-Datenbank: blockiert durch fehlenden Zugang zur Firmeninstallation.

## Freigabe: Durchgängige Probenbezeichnung
- [x] Zentrale Fallbacks und stabile Mehrprobenanzeige, Aufgaben-/Projekt-/Dashboard-Spalten und Suche additiv ergänzt; vorhandene SELECTs unverändert.
- [x] 1.226 Tests bestanden, automatische Buildprüfung erfolgreich; angemeldete Web-Prüfung von Auftragsanzeige, Probenlink und Dashboard-Suche ohne Produktivschreibzugriffe; Abschlussbericht erstellt.
- [ ] Vollständige Web-Abnahme: Aufgaben-/Projektansicht und Sonderfälle benötigen passende erreichbare Bestandsdaten/Ansichten; separate Typprüfung nicht ausgeführt.
- [ ] Tauri-Abnahme: blockiert durch fehlenden Zugang zur Firmeninstallation.

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
