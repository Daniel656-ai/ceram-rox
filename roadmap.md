# Roadmap: RFA und dynamische Elementergebnisse

## Phase 1 – Bestandsprüfung
- [ ] 1.1 case_key-Constraint in measurement_cases prüfen (DB, lesend)
- [ ] 1.2 Einheitenkonflikte bei Wiederholungsimport prüfen
- [ ] 1.3 Historische Ergebnisse / offizielle Freigabe prüfen
- [ ] 1.4 Zentrale RFA-Klassifizierung (detectAnalysisKey/isRfaService) prüfen
- [ ] 1.5 Speicherpfad für Textwerte (parseValue → text_value → Anzeige) prüfen

## Phase 2 – Umsetzung (nur wenn Phase 1 ohne strukturelle Änderungen machbar)
- [ ] 2.1 elementKeys.ts: 28 fehlende Elemente ergänzen
- [ ] 2.2 rfaFixedElements.ts: isValidResultValue ersetzt isPositiveMeasurement
- [ ] 2.3 MeasurementCaseEditorDialog: Auswahl „Vollständige externe Analyse"
- [ ] 2.4 measurementBlocks.ts + FormLayoutRenderer: case_key-Kontext bis zum Import
- [ ] 2.5 measurementImport.ts: vier Betriebsmodi
- [ ] 2.6 Oxide/Elementsymbole: eigenständige Identität
- [ ] 2.7 officialResults.ts: isValidResultValue + Sortierung
- [ ] 2.8 TaskExecutionPage: text_value-Speicherung

## Phase 3 – Regressionstests
- [ ] src/test/rfaDynamicResults.test.ts (10 Szenarien + Pflichtprüfungen)

## Phase 4 – Abschluss
- [ ] Gesamtsuite + Typecheck + Build
- [ ] Abschlussbericht in /mnt/documents
