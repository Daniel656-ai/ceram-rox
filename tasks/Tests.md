# Tests – Sicherheitsnetz vor dem Aufräumen (Aufgabe 021)

## Bestand und Lücken

Stand: 2026-11-21, Branch `main` (Commit `5e52dc3c`). Ermittelt durch Lesen von Code, Tests und Migrationen und durch einen Volllauf. Die Abdeckung ist eine Einschätzung anhand von Testtiteln und Importen, keine Coverage-Messung.

### Ausgangslage

| Punkt | Befund |
|---|---|
| Test-Framework | Vitest 3 (jsdom, `globals`, `testTimeout`/`hookTimeout` 20 s), Setup `src/test/setup.ts` (`jest-dom`, `asyncUtilTimeout` 10 s, `matchMedia`-Stub), Befehl `npm test` |
| Testdateien | 188 Dateien, 1807 Tests (überwiegend in `src/test/`, der Rest neben dem Code in `src/lib/**`) |
| Art der Tests | überwiegend reine Logik; Backend per `vi.mock` gemockt; nur 3 API-Tests (`src/lib/api/__tests__`). Dazu einige Komponenten-/Seitentests (u. a. `orderEditPage.test.tsx` für `CreateOrderPage` im Bearbeiten-Modus, Ergebnisansichten) |
| E2E-Tests | keine |
| DB-Tests (Funktionen/Trigger/RLS) | keine im Testlauf. Nur manuelle Skripte mit einem Wegwerf-Postgres: `scripts/test-order-deletion-local.py`, `scripts/test-equipment-local.py` |
| DB-Umfang | 206 Migrationen in `supabase/migrations` und 48 in `drizzle/migrations` (0000–0047, aktiv, u. a. Equipment, Auftrag bearbeiten/löschen, m³ löschen). Roh gezählt (inkl. überschriebener Fassungen): ca. 236 Funktionen, 186 Trigger, 562 Policies, ca. 616 `has_role(`- und 370 `has_permission(`-Aufrufe |
| Typprüfung | `npx tsc -p tsconfig.app.json --noEmit`: 0 Fehler (ca. 2 min) |
| Volllauf auf `main` | **nicht grün**: 4 Dateien / 35 Tests rot, alle wegen `localStorage` (siehe unten); 1772 grün; Dauer ca. 5 min |
| CI | `release.yml` (Desktop-Release, im Dev-Repo per `if` abgeschaltet) und `dev-web.yml` (Web-Vorschau nach Merge, Node `lts/*`). Beide ohne Tests und ohne Typprüfung |
| PGlite o. Ä. | nicht installiert |

### Rote Tests auf main

Lokal läuft Node v26.13.1. Seit Node 25 gibt es ein eigenes globales `localStorage`, das ohne `--localstorage-file` `undefined` ist und das `localStorage` von jsdom überdeckt. Das ist ein Umgebungsproblem und kein Fachfehler. Es trifft aber auch die CI, sobald `lts/*` auf Node ≥ 25 springt.

**Behoben in `improve/tests-basis`:** `src/test/setup.ts` setzt den `localStorage` von jsdom ein, wenn das globale `localStorage` fehlt. Danach Volllauf 1807/1807 grün (Node 26).

| Testdatei | Rot | Fehlerbild |
|---|---|---|
| `src/lib/modularReport/__tests__/modularReport.test.ts` | 17/17 | `Cannot read properties of undefined (reading 'clear')` |
| `src/test/taskServiceFilter.test.ts` | 11/11 | wie oben |
| `src/test/ordersPageSamples.test.tsx` | 5/5 | wie oben |
| `src/test/orderFilterPersistence.test.tsx` | 2/2 | gespeicherte Filter werden nicht wiederhergestellt bzw. landen beim falschen Konto, weil der Speicher fehlt |

Die beiden Einzelfälle aus dem ersten Lauf (`refreshGuard`, `nestedMeasurementRenderer`) sind auf dem aktuellen `main` grün.

### Legende

- **Abdeckung:** gut = Kernfälle inkl. Grenzfälle getestet · teilweise = einzelne Aspekte oder nur Hilfslogik · keine
- **Risiko bei Umbau:** wie wahrscheinlich und wie schädlich ein unbemerkter Bruch beim Aufräumen wäre
- **Art:** R = reine Funktion (ohne Mocks testbar) · A = API-Schicht (mit gemocktem `dbClient` testbar) · U = UI/Seite · DB = Funktion/Trigger/RLS (nur gegen Testdatenbank)

---

### 1. Aufträge

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Auftrag anlegen (Formular, Service-Tabs, Auswahl/Abwahl, Wertübergabe, Anlegeablauf) | `pages/CreateOrderPage.tsx`, `lib/orders/createOrderFlow.ts`, `lib/orderCreation/*`, `lib/orderServiceSelection.ts`, `lib/orderFormValueHandover.ts` | `createOrderFlow`, `orderServiceSelection`, `serviceDeselection`, `activeServiceTab`, `serviceFormStatus`, `orderFormValueHandover`, `serviceTabsFiltering`, `formRendererLook.test.tsx` | teilweise (Ablauf und Hilfslogik gut, Seite im Anlege-Modus keine) | hoch | R/U |
| Auftrag bearbeiten (Ausgangsstand, Änderungen berechnen, Leistungen ergänzen/entfernen, Hinweis an Messdienstleister) | `lib/orders/orderEdit.ts`, `editServiceTicks.ts`, `CreateOrderPage.tsx` (Bearbeiten-Modus), `OrderChangeNotice.tsx`, drizzle 0039–0042, 0045 | `orderEdit` (28), `editServiceTicks` (20), `orderEditUi.test.tsx`, `orderEditPage.test.tsx` (21), `orderChangeNotice.test.tsx` | gut (Client), DB keine | hoch | R/U/DB |
| Auftrags-API (CRUD, Instanzen, Analyse-Anforderungen) | `lib/api/orders.ts`, `orderInstances.ts`, `orderAnalysisRequests.ts` | – | keine | hoch | A |
| Auftrag löschen/stornieren (inkl. Anhänge, Ersteller/Master), einzelne Messung löschen | `lib/api/orders.ts`, `lib/orders/orderDeleteSummary.ts`, `orderStoragePaths.ts`, `OrderDeleteInfo.tsx`, `lib/measurementRun/deleteMeasurement.ts`, drizzle 0036/0037/0043/0046/0047 | `api/__tests__/orderDeletion.test.ts` (gemockt), `orderDeleteSummary`, `orderStoragePaths`, `orderDeleteDialog.test.tsx`, `deleteMeasurement`; manuell `scripts/test-order-deletion*` | gut (Client), DB nur manuell | hoch | R/A/DB |
| Auftrags-Excel-Export | `lib/orderExport/{buildOrderExport,toWorkbook}.ts`, `OrderExcelExportButton.tsx` | `orderExport` (16), `orderExcelButton.test.tsx` | gut | mittel | R/U |
| Freigabe-Bezeichnung am Auftrag | `lib/orders/orderReleaseLabel.ts` | `orderReleaseLabel` | gut | niedrig | R |
| Auftragsnummer (Trigger `generate_order_number`), Umnummerieren (RPCs `preview_/renumber_user_orders`) | Migrationen, `lib/orders/renumber.ts` | `renumberOrders.test.ts` (nur Client) | teilweise | hoch | R/DB |
| Experiment-/Versuchsnummer | `lib/orders/experimentNumber.ts` | `experimentNumber`, `experimentNumberResolution`, `api/__tests__/orderExperimentNumber` | gut | niedrig | R/A |
| Identität, Auftragsart, Masse-Typ, Projektpflicht, Abrechnungsstatus | `lib/orders/{orderIdentity,orderKind,orderMasseType,projectRequirement,billing}.ts` | `orderIdentity`, `orderKindClassification`, `orderMasseType`, `projectRequirement`, `billing` | gut | niedrig | R |
| Filter und Filter-Persistenz | `lib/orders/orderFilterColumns.ts`, `components/order/OrderListFilters.tsx`, `pages/OrdersPage.tsx` | `orderFilters`, `orderFilterPersistence.test.tsx`, `taskServiceFilter` (rot) | teilweise | mittel | R/U |
| Priorität und Ranking (Client `priorityRank` ↔ DB `priority_enum_to_int`, Kaskaden-Trigger) | `lib/orders/priority.ts`, Trigger `trg_cascade_order_priority/ranking` | `orderPriority.test.ts` (nur Client) | teilweise | hoch | R/DB |
| Auftragsvorlagen (kopieren, Eingaben, „als Vorlage verwenden“) | `lib/orderTemplateCopy.ts`, `orderTemplateInputs.ts`, `UseAsTemplateDialog.tsx`, `pages/TemplatesPage.tsx` | `orderTemplateCopy`, `orderTemplateInputs`, `UseAsTemplateDialog.test.tsx` | gut (Seite/API keine) | mittel | R/U |
| Entwurf/Autosave | `hooks/useOrderDraftAutosave.ts`, `lib/orderDraftSafety.ts`, `lib/api/orderDrafts.ts` | `orderDraftAutosave.test.tsx`, `orderDraftSafety` | gut (API/Panel keine) | mittel | R/A |
| Auftragsimport (Excel) | `lib/excel-import.ts`, `pages/ImportOrderPage.tsx` | – | keine | mittel | R |
| Vorgabenänderung (RPC `amend_order_spec`), Korrektur abgeschlossener Leistungen (RPC `amend_completed_measurement`) | `lib/amendment/payload.ts`, `SpecAmendment.tsx` | `amendmentPayload`, `specAmendment` | teilweise (Client) | hoch | R/DB |
| SLA-Berechnung | `lib/sla/slaCalculator.ts` | `sla/__tests__/slaCalculator.test.ts` | gut | niedrig | R |
| Aufgaben-Ausführung (Tasks, zurück zur Aufgabe, Übernahme/Freigabe/Umhängen) | `pages/TaskExecutionPage.tsx` (1590 Z.), `lib/measurementRun/taskBack.ts`, RPCs `claim_/release_/reassign_measurement` | `taskBack`, `taskOrderIdentity.test.tsx`, `reassignmentEvent`, `ReassignMeasurementDialog.test.ts` | teilweise | hoch | R/U/DB |
| Status, Workflow, Auftragssperre | `lib/api/orderWorkflow.ts`, `workflowEngine.ts`, `serviceWorkflows.ts`, Trigger `trg_workflow_*`, `sync_order_status_on_measurement_change`, `enforce_order_lock_*`, `expand_service_workflow` | `directedServiceDependencies` (nur Client-Regel) | keine bis teilweise | hoch | A/DB |
| Kalender, Laborplanung | `pages/CalendarPage.tsx` (766 Z.), `LabPlanningPage.tsx`, `lib/isoWeek.ts` | – | keine | mittel | U/R |
| Laufzettel (Probe, Auftrag, Druck) | `lib/runSheet/*` | `buildRunSheet`, `buildOrderRunSheet`, `pppGroups`, `printHtml` | gut | niedrig | R |

### 2. Proben

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Probenliste/-detail, CRUD | `pages/SamplesPage.tsx` (920 Z.), `SampleDetailPage.tsx`, `lib/api/samples.ts` | `ordersPageSamples.test.tsx` | teilweise | mittel | A/U |
| Probe bearbeiten | `lib/samples/sampleEdit.ts` | `sampleEdit.test.ts` | gut | niedrig | R |
| Probennummer (`generate_sample_number`, 5 Fassungen; zwei Trigger) | Migrationen | – | keine | hoch | DB |
| Zuordnung Probe ↔ Auftrag | `lib/samples/orderLinks.ts`, `lib/orders/orderSamples.ts` | `sampleOrderLinks`, `orderSamples` | gut | niedrig | R |
| Aktiver Proben-Kontext (Speichern unter richtiger Probe) | `lib/samples/activeSampleContext.ts` | `activeSampleContext` | gut | niedrig | R |
| Ersatzprobe, Umhängen, Herkunft/Rückverfolgung | `ReplacementSampleDialog`, `SampleReassignDialog`, RPC `get_sample_traceability` | indirekt `reassignmentEvent` | keine bis teilweise | mittel | U/DB |
| Bulk-Proben | `pages/BulkSamplePage.tsx` | – | keine | niedrig | U |
| Etiketten (Felder, GHS/PSA-Symbole, Druck), Barcode/DMC | `lib/labels/{fields,symbols,print}.ts`, `components/labels/*`, `SampleScanner.tsx` | – | keine | mittel | R/U |
| Probengeometrie | `lib/geometry/*` | `geometryCalculations`, `plateGeometry`, `crossSectionDimensions` | gut | niedrig | R |

### 3. Messungen / Ergebnisse

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| **Vorläufige vs. offizielle Ergebnisse** | `lib/officialResults.ts` (535 Z.), `lib/resultSchema.ts`, `scopedMeasurementValues.ts` | `officialResults`, `officialResultsVerhalten` (27, davon 1 `it.fails` F-1), `repeaterOfficialResults`, `repeaterCalculationResults`, `resultSchema`, `scopedMeasurementValues`, `recipeResultValue` | gut (`resultSchema` selbst nicht vertieft) | hoch | R |
| Ergebnisse ersetzen/ergänzen (RPC `replace_measurement_results`), Korrekturhistorie | `lib/results/replaceResults.ts`, `lib/api/resultCorrections.ts` | `replaceResults` (24), `localAvSecondCorrection` | gut (Client), DB keine | mittel | R/DB |
| Messlauf (Guards: Hydrierung, Speichern, Verlassen) | `lib/measurementRun/*`, `hooks/useMeasurementAutosave.ts` | je Modul eine Testdatei | gut (Hook keine) | mittel | R |
| Messungs-API, Messungsnummer, Statusprotokoll | `lib/api/measurements.ts`, `measurementResults.ts`, `generate_measurement_number` | `api/__tests__/measurements` (20), `api/__tests__/measurementResults` (15), beide mit gemocktem `dbClient` | gut (Client-API), DB keine | hoch | A/DB |
| Messdatei-Import (Profile, Klassifikation, Blöcke, RFA-Fälle) | `lib/measurementImport.ts` (504 Z.), `measurementClassification.ts`, `measurementBlocks.ts` | `measurementImport` (5), `measurementClassification`, `measurementBlocks`, `rfa*` (5 Dateien) | teilweise | mittel | R |
| Geräte-Importe Netzsch, Gassorption/BJH, Geometrie | `lib/instrumentImport/*` | `netzschImport`, `gasSorptionImport`, `gasSorptionSmp`, `bjhWorkbookImport`, `bjhCharts`, `geometryImport` | gut | niedrig | R |
| Kurven (Datensatz, Auswertepunkte, Zoom, Beschriftung, Export) | `lib/curves/*` | `analysisTypes`, `curveEvaluationPoints`, `curveZoom`, `curveViewerZoom.test.tsx`, `labelLayout`, `curveDataset` (29), `curveExport` (8) | gut (PDF-Export/Download keine) | mittel | R |
| Ergebnisdatenbank: Daten und Aggregation (offizielle und vorläufige Werte, Matrix, Filter, Gruppen nach Auftrag, Durchläufe, interne Einträge, strukturierte Werte) | `hooks/useResultsDatabase.ts`, `lib/resultsMatrix.ts`, `lib/results/{resultsFilters,orderGroups,internalResults,sampleResultsAggregation,sampleNavigation}.ts`, `resultDisplayPrecision.ts`, `resultLabels.ts` | `resultsAllValues`, `resultsMatrix`, `resultsFilters.test.tsx`, `orderGroups`, `orderRuns.test.tsx`, `internalResults`, `structuredValues.test.tsx`, `sampleNavigation`, `sampleResultsAggregation`, `resultsChartData`, `resultDisplayPrecision`, `gasInOutLabels` | gut | mittel | R |
| Ergebnisdatenbank: Ansichten (Übersichten, Matrix-Seitenleiste, Messarten-Chips, Aktivitäts- und BET-Darstellung) | `pages/ResultsDatabasePage.tsx`, `components/results/*` | `resultsMatrixPanel`, `orderOverviewCompact`, `serviceChips`, `activityMeasurement` (20), `activityVariants` (25), `betMeasurement` (13), `sampleLabel` | teilweise (Komponenten gut, Seite selbst keine) | mittel | U |
| Auftrags-Ergebnisaggregation/-struktur (Auftragsdetail) | `lib/orderResultsAggregation.ts`, `orderResultsStructure.ts` | `orderResultsAggregation` (10), `orderResultsStructureVerhalten` (14), `resultSchema` (2 Fälle) | gut | hoch | R |
| Statistik | `lib/resultsStatistics.ts` | `resultsStatistics` | gut | niedrig | R |
| Ergebnis-/Auftraggeber-Bedingungen | `lib/resultConditions.ts`, `lib/results/requesterConditions.ts` | `calcResultConditions*`, `requesterConditions` | gut | niedrig | R |

### 4. Formulare

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| **Formel-Engine** (Parser, Rechenarten, Funktionen, Fehlerfälle, Referenzen) | `lib/formulaEngine.ts` (548 Z.) | `formulaComparison`, `formulaLn`, `formulaTrig`, `globalConstants`, `formulaEngineVerhalten` (63, davon 7 `it.fails`: F-3, F-4, F-5, F-6 ×2, F-7, F-8) | gut | hoch | R |
| **Rechen-Bindings** (`resolveBinding`, `runCalculation`, `applyCalculationOutputs`) | `lib/calculationBindings.ts`, `lib/api/formCalculations.ts` | `calculationBindings` (22); indirekt `calcLinkedFields`, `seriesCalculations` … | gut (`calculationBindings.ts`), `api/formCalculations.ts` keine | hoch | R |
| Lokale Berechnungen, Serien, verknüpfte Vorgaben | `lib/localCalculations.ts` | `calcLinkedFields`, `calcLinkedVorgaben`, `seriesCalculations`, `localAvSecondCorrection` | gut | mittel | R |
| Regeln (Auswertung, nicht leer, Repeater-Unterfeld, Leistung auslösen) | `lib/ruleEvaluation.ts`, `lib/api/ruleTriggers.ts` | `ruleTriggers`, `ruleNotEmpty`, `ruleRepeaterSubfield` | teilweise | mittel | R/A |
| Repeater (Layout, Zeilentitel, Köpfe, Fokus, Aggregation) | `lib/repeater*.ts`, `FormLayoutRenderer.tsx` (2421 Z.) | `repeaterRowLabel`, `repeaterTableHeaders`, `repeaterFocusStability`, `repeaterCalc*`, `repeaterSubfieldMasterData`, `repeaterAggregation` (10) | gut | hoch | R/U |
| Verknüpfte Felder und Formularwerte | `lib/fieldLinks.ts`, `lib/linkedFormValues.ts` | `fieldLinks`, `linkedFormValueSource`, `linkedFormValuesInstances` | gut/teilweise | mittel | R |
| Formular-Spiegelung | `lib/formMirrorGuard.ts` | `formMirrorGuard.test.ts` | gut | niedrig | R |
| Stammdaten, inaktive Optionen, globale Felder/Vererbung | `lib/masterData*.ts`, `lib/globalFieldInheritance.ts` | `masterDataRef`, `inactiveMasterDataOptions`, `globalFieldInheritance` | teilweise | mittel | R |
| Validierung, Feldtypen | `lib/globalValidation.ts`, `lib/formFieldTypes.ts` | `globalValidation` (17, davon 2 `it.fails` F-11), `formFieldTypes` (11, davon 2 `it.fails` F-12) | gut | mittel/hoch | R |
| Formulardefinitionen, Rollenansichten, Feldrechte, Versionen, Klonen | `lib/api/formDefinitions.ts`, `formRoleViews.ts`, `formFieldPermissions.ts`, `serviceVersions.ts`, DB `_clone_form_definition` | – | keine | hoch | A/DB |
| Rich Text | `lib/richText.ts` | `richText.test.ts` | gut | niedrig | R |
| **Berichts-Platzhalter und Bindings** | `lib/reportPlaceholders.ts`, `reportBindings.ts`, `reportFieldCatalog.ts` | `reportPlaceholdersVerhalten` (39, davon 4 `it.fails`: F-9, F-10 ×3) | gut (Funktionen), Designer-Vorschau keine | hoch | R |
| Modularer Bericht | `lib/modularReport/*` | `modularReport.test.ts` (rot, `localStorage`) | gut (sobald lauffähig) | mittel | R |
| Kundendokumentation (Kapitel, Export, Revisionsabgleich) | `lib/customerDocumentation/*` | `chapters.test.ts`, `releaseSync.test.ts` | teilweise | mittel | R |
| Service-Designer (Formular-, Regel-, Bericht-, Layout-Designer) | `components/ServiceDesigner/*`, `pages/AdminServiceDesignerPage.tsx` | – | keine | hoch | U |
| Bericht erzeugen (Edge Function `generate-order-report`, 1029 Z.) | `supabase/functions/generate-order-report` | – | keine | hoch | R/DB |

### 5. Pilot Plant

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Neuer Prozess (Templates `kind='pilot_plant'`, Step-Runs, Guided Stepper, Runtime-Panel) | `lib/api/processTemplates.ts`, `orderStepRuns.ts`, `workflowEngine.ts`, `PilotPlantGuidedStepper.tsx`, `ProcessRuntimePanel.tsx` | – | keine | hoch | A/U/DB |
| Alter Prozess (Blöcke, `pilot_plant_blocks`) | `lib/api/pilotPlantProcess.ts`, `PilotPlantProcessPanel.tsx` | `pilotPlantTab.test.tsx` (nur Anzeige) | – | – | **nicht testen**: nicht mehr in Gebrauch |
| Mundstück 293/1 (Planung, Paarung, Sync) | `lib/rules/mundstueck293.ts`, `lib/api/mundstueck293.ts` | `mundstueck293`, `mundstueck293AnalysePpp`, `mundstueck293Sync` | gut | niedrig | R/A |
| Pilot-Plant-Liste → auszulösende Leistung | `lib/orderServiceSelection.ts` | `pilotPlantServiceRef` | gut | niedrig | R |
| Auftragsart/Versuchsnummer Pilot Plant | `lib/orders/orderKind.ts`, `orderIdentity.ts` | siehe Aufträge | gut | niedrig | R |

### 6. m³-Liste

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Berechnungen, Schritt 1, Ableitung aus Auftrag | `lib/m3List/{calculations,derive}.ts` | `calculations`, `step1`, `derive`, `m3ElementDisplay.test.tsx` | gut | mittel | R |
| Auftragsbezeichnung, Layout-Aufteilung, Druck-HTML | `lib/m3List/{orderLabel,layoutSplit,printM3Html}.ts` | `orderLabel`, `layoutSplit`, `printM3Html` | gut | niedrig | R |
| TEST-Markierung | `lib/m3List/testMarking.ts` | `testMarkingMulti`, `step1` | gut | mittel | R |
| Konstanten-Erkennung, Template, PDF-Export | `lib/m3List/{constants,template,pdfExport}.ts` | `constantsRecognition` (2), `template` (6), `pdfExport` (4) | teilweise | mittel | R |
| Probenahme-Reihenfolge, NOx-Übergabe | `lib/m3List/noxHandover.ts`, `lib/noxColumnOrder.ts` | `m3SamplingOrder`, `noxColumnOrder` | gut | niedrig | R |
| Probenbezeichnungen | `lib/m3List/sampleNames.ts` | `sampleNames` | gut | niedrig | R |
| m³-Liste löschen (Berechtigung, Hinweis) | `lib/productionDocuments/m3Delete.ts`, drizzle 0038/0044 | `m3Delete` | gut (Client), DB keine | mittel | R/DB |
| m³-Formular (UI, Speichern) | `components/productionDocuments/M3ListForm.tsx` | – | keine | mittel | U |

### 7. Projekte

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| **Kostenaufstellung** (Beträge, Stundensätze) | `lib/costBreakdown.ts` | – | keine | hoch | R |
| **Gebuchte Leistungen, Stundenaggregation** | `lib/projectServiceAggregation.ts` (`measurementHours` doppelt, auch in `costBreakdown.ts`, mit anderem Rückgabetyp) | – | keine | hoch | R |
| Projektrollen (Mehrfachrollen) | `lib/projectRoles.ts` | `projectRoles.test.ts` | gut | niedrig | R |
| Projektliste/-detail (9 Tabs) | `pages/ProjectsPage.tsx`, `ProjectDetailPage.tsx` (1109 Z.), `components/project/*` | – | keine | hoch | U/A |
| Budget, Ausgaben, Zeiteinträge, Material | `ProjectBudgetCard`, `lib/api/project{Expenses,TimeEntries,Materials}.ts`, DB `validate_time_entry_scope` | – | keine | mittel | A/U/DB |
| Abschluss, Governance, Meilensteine, Dokumente | `lib/api/project{Closure,Governance,Milestones,Documents}.ts` | – | keine | mittel | A/DB |
| Portfolios und Controlling (RPCs `get_portfolio_*`, Export) | `lib/api/projectPortfolios.ts`, `portfolioStructure.ts`, `portfolioControlling.ts`, `controllingExport.ts` | – | keine | hoch | A/R/DB |
| FFG-Bericht, Funding-Zuordnung | `components/portfolio/*` | – | keine | mittel | U |

### 8. Lager / Rohstoffe

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Rohstoffliste/-detail | `pages/RawMaterialsPage.tsx`, `RawMaterialDetailPage.tsx` (1449 Z.), `lib/api/rawMaterials.ts` | – | keine | hoch | U/A |
| Rohstoffsuche, Anzeigelabel | `lib/rawMaterialSearch.ts`, `lib/rawMaterials/displayLabel.ts` | `rawMaterialSearch`, `displayLabel`, `rawMaterialValueLabel` | gut | niedrig | R |
| Gebinde (CRUD, Archiv) | `lib/api/rawMaterialContainers.ts` | `api/__tests__/rawMaterialContainers.test.ts` (nur Fallback) | teilweise | hoch | A |
| Bestandsbuchung, Bewegungen, Gebindecode (`book_container_consumption` 5 Fassungen, `record_container_movement` …) | Migrationen, `lib/api/containerMovements.ts` | – | keine | hoch | DB |
| Lagerorte | `lib/storageLocations.ts` | `storageLocations.test.ts` | gut | niedrig | R |
| Container-Scan | `pages/ContainerScanPage.tsx` | – | keine | mittel | U |
| Mischungen, Rezeptversionen | `pages/MixtureDetailPage.tsx` (1363 Z.), `lib/api/mixtures*.ts` | – | keine | hoch | U/A |
| Mischungs-Chargen (produzieren, wiegen, korrigieren, abschließen, freigeben) | `pages/BatchPlanningPage.tsx`, `BatchExecutionPage.tsx`, `lib/api/batches.ts`, `mixtureExecution.ts`, ca. 25 SQL-Funktionen | – | keine | hoch | A/U/DB |
| Rezeptabschnitte, Einheiten | `lib/recipeSections.ts`, `lib/recipeUnits.ts` | `recipeSections`, `recipeUnits`, `recipeResultValue` | gut | niedrig | R |
| Gefahrstoffklassen, Gefahrstoff-Benachrichtigung | `lib/hazardClasses.ts`, Trigger `notify_hazard_material_change` | – | keine | mittel | R/DB |
| Verbrauchsmaterial | `pages/ConsumablesPage.tsx`, `lib/api/consumables.ts` | – | keine | niedrig | A/U |
| Prüfmittel/Geräte-Status | `lib/equipment/status.ts`, `lib/api/testEquipment.ts` | `equipment/status.test.ts`; manuell `scripts/test-equipment*` | gut (Status), DB keine | niedrig/mittel | R/DB |

### 9. Fertigungsfreigaben

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Freigabe-API, Statusfluss, Feldkoerzierung | `lib/api/productionReleases.ts` (826 Z.), `lib/productionRelease/fields.ts` | – | keine | hoch | A/R |
| Revision freigeben/abschließen (RPCs) | `release_/complete_production_release_revision` | – | keine | hoch | DB |
| PDF-Import-Pipeline (Text, Bild, Edge Function `parse-production-release`) | `lib/productionRelease/{importPipeline,pdfVisual,pdfText}.ts` (851 + 321 Z.) | – | keine | hoch | R/A |
| Blöcke bilden/zusammenführen, Identität (Dateiname/Revision) | `lib/productionRelease/{blocks,documentIdentity}.ts` | `releaseBlocks`, `releaseIdentity` | gut | niedrig | R |
| Maße/Toleranzen (`analyzeDimensionText`) | `lib/productionRelease/dimensions.ts` | `crossSectionDimensions` | gut | niedrig | R |
| Spec-Sets, Spezifikationswerte | `lib/productionRelease/specSets.ts`, `lib/specValues.ts` | `releaseSpecSets`; `specValues` nur indirekt | gut / teilweise | mittel | R |
| Quellbezug auf konkrete Revision | `lib/productionReleaseRef.ts` | `productionReleaseRef` | gut | niedrig | R |
| **Fertigungsunterlagen: Anforderungsprüfung, Status** | `lib/productionDocuments/requirements.ts` | – | keine | hoch | R |
| Fertigungsunterlagen: Berechtigungen/Navigation | Permission-Keys | `productionDocumentsPermissions` | gut | niedrig | R |

### 10. Benutzer / Rechte

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Login, Session, Profil/Rollen laden, Passwort zurücksetzen, OAuth | `contexts/AuthContext.tsx`, `lib/api/auth.ts`, `pages/{Auth,ResetPassword,ChangePassword,OAuthConsent}.tsx` | – | keine | hoch | U/A |
| Passwort-Richtlinie, Passwort-Generator | `lib/passwordPolicy.ts` | – | keine | mittel | R |
| Basisrollen/Mehrfachrollen (`master`, `auftraggeber`, `durchfuehrer`) | `lib/roles.ts` | `multiRolesUsage.test.ts` | teilweise | hoch | R |
| Permission-Keys (Client ↔ SQL), Navigation | `hooks/usePermissions.ts`, `scripts/audit-permissions.ts` | `productionDocumentsPermissions` (nur ein Bereich) | teilweise | hoch | R |
| Eigene Rollen, Feldrechte, Rollenansichten | `lib/api/customRoles.ts`, `formFieldPermissions.ts`, `formRoleViews.ts`, `pages/Admin{Roles,Permissions}Page.tsx` | – | keine | hoch | A/U |
| Benutzerverwaltung (Edge Function `admin-users`, Service-Role) | `pages/AdminUsersPage.tsx`, `lib/api/users.ts`, `supabase/functions/admin-users` | – | keine | hoch | A |
| Externe Kunden (Datenisolation über restriktive Policies `is_external_customer`/`external_owns_sample`) | `lib/auth/externalCustomer.ts`, `lib/externalApps.ts`, RLS | `externalApps.test.ts`, `MeasurementRunPicker.externalApps.test.tsx` | teilweise (Client), RLS keine | hoch | R/DB |
| **RLS gesamt** (`has_role`, `has_permission`, `is_project_member`, `has_project_role`, `can_view_portfolio`) | Migrationen | – | keine | hoch | DB |
| Neuer Benutzer → Profil (Trigger `handle_new_user`) | Migrationen | – | keine | hoch | DB |

### 11. Sonstiges

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| „Ansicht aktualisieren“ mit Speicherschutz | `lib/refreshGuard.ts` | `refreshGuard.test.ts` | gut | niedrig | R |
| Dashboard, Aktivitäts-Feed, Aktivitätsprotokoll | `pages/Dashboard.tsx`, `lib/api/activityLog.ts`, Log-Trigger | – | keine | mittel | U/A/DB |
| Abwesenheiten, Arbeitszeiten, Ausfallzeiten (Überlappungsprüfung in DB), ICS-Feed | `lib/api/absences.ts`, `workSchedules.ts`, `downtimes.ts`, Edge Function `absence-ics-feed` | – | keine | mittel | A/DB |
| Feiertage Österreich, ISO-Woche | `lib/austrian-holidays.ts`, `lib/isoWeek.ts` | – | keine | niedrig | R |
| Übersetzungen (5 Sprachen, Schlüsselvollständigkeit) | `src/i18n/locales/*` | – | keine | niedrig | R |
| Desktop-Updater, Release | `components/UpdateChecker.tsx`, `src-tauri/*`, `release.yml` (im Dev-Repo abgeschaltet) | – | keine | mittel | – |
| Dev-Web-Vorschau | `.github/workflows/dev-web.yml` | – | keine | niedrig | – |
| MCP-Werkzeuge | `lib/mcp/*`, Edge Function `mcp` | – | keine | mittel | A |
| Exporte Excel/Diagramme | `lib/chartExport.ts`, `controllingExport.ts` | indirekt `bjhCharts`, `resultsChartData` | teilweise | niedrig/mittel | R |
| Admin: Datenbank/Integritätsprüfung, Sync, Statistik, Firmeneinstellungen, Symbole, Etikettenvorlagen, Arbeitspaket-Kategorien | `pages/Admin*.tsx`, Edge Function `db-integrity-check` | – | keine | mittel | U/A |
| Suchbare Auswahl, Zahlen-Eingabe-Schutz, Scroll/Suche | `lib/ui/optionFilter.ts`, `components/ui/input.tsx` | `scrollAndSearch.test.tsx` | teilweise | niedrig | R/U |
| Datei-Transfer, Uploads, Bildergalerie | `lib/fileTransfer.ts`, `lib/imageGallery.ts` | `imageGallery` | teilweise | niedrig | R |

---

### Vorschlag zur Reihenfolge (höchstes Risiko zuerst)

Je Bereich ein Branch `improve/tests-<bereich>`. Innerhalb eines Bereichs zuerst reine Funktionen (R), dann die API-Schicht mit gemocktem `dbClient` (A), dann gezielte Komponententests (U). Die DB-Logik bildet eine eigene Spur und wartet auf deine Entscheidung zur Testdatenbank.

| # | Branch | Inhalt (Schwerpunkt) | Warum zuerst |
|---|---|---|---|
| 0 | `improve/tests-basis` | Volllauf auf `main` grün machen: `localStorage` für Node ≥ 25 im Test-Setup absichern (35 rote Tests) | ohne grünen Ausgangspunkt kann der test-runner nicht zwischen „durch Änderung kaputt“ und „vorher schon kaputt“ unterscheiden |
| 1 | `improve/tests-ergebnisse` | `officialResults` (vorläufig/offiziell), Auftrags-Ergebnisaggregation/-struktur, `curves/dataset`/`export`, Messungs-API | Kern der Laborergebnisse, 535 Zeilen mit nur 3 Tests |
| 2 | `improve/tests-formulare` | `formulaEngine` systematisch, `calculationBindings`, `reportPlaceholders`/`reportBindings`, `globalValidation`, `formFieldTypes`, `repeaterAggregation` | alle Berechnungen und Berichte hängen daran |
| 3 | `improve/tests-projekte` | `costBreakdown`, `projectServiceAggregation` (inkl. doppeltem `measurementHours`), `controllingExport` | Geld und Stunden ohne einen einzigen Test |
| 4 | `improve/tests-rechte` | `passwordPolicy`, `roles`, Permission-Keys Client ↔ SQL (Abgleich wie `audit-permissions.ts`), `externalCustomer`, Auth-Context-Verhalten | Sicherheitsgrenze im Client |
| 5 | `improve/tests-freigaben` | `productionDocuments/requirements`, `productionRelease/fields`, `specValues`, `importPipeline` (reine Anteile), Freigabe-API | große ungetestete Pipeline |
| 6 | `improve/tests-auftraege` | `excel-import`, Workflow-/Status-Client, Auftrags-API, `CreateOrderPage` im Anlege-Modus (Bearbeiten ist schon abgedeckt) | größte Seite, viele Abläufe |
| 7 | `improve/tests-lager` | `hazardClasses`, `labels/fields`/`symbols`, Gebinde-API, Mischungs-/Chargen-API | Bestandsbuchung |
| 8 | `improve/tests-pilot-plant` | `workflowEngine`, `orderStepRuns`, `processTemplates`, Stepper | neuer Prozess ungetestet |
| 9 | `improve/tests-proben` | `labels/print`, Proben-API, Ersatzprobe/Umhängen | überwiegend schon gut |
| 10 | `improve/tests-m3` | `constants`, `template`, `pdfExport` vertiefen | schon gut abgedeckt |
| 11 | `improve/tests-sonstiges` | Feiertage, ISO-Woche, i18n-Schlüsselvollständigkeit, `chartExport` | geringes Risiko |
| DB | `improve/tests-db-*` | Testdatenbank PGlite: spielt `supabase/migrations` **und** `drizzle/migrations` ab, mit Ersatz für das Supabase-Schema `auth`. Danach RLS je Rolle (inkl. externer Kunden), Nummernkreise, Auftragssperre/Workflow, Auftrag bearbeiten/löschen (drizzle 0036–0047), Bestandsbuchung, Chargen, Ergebnis-RPCs | höchstes Risiko insgesamt; Aufbau mit dir abstimmen, bevor es losgeht |

Merges werden gebündelt: Schritt 1 und 2 zusammen, in Schritt 3 mehrere Bereiche pro Merge.

## Testübersicht (fortlaufend gepflegt)

| Funktionalität | Testdatei | Was wird geprüft | Status |
|---|---|---|---|
| Offizielle vs. vorläufige Ergebnisse (verknüpfte Formulare, Messdatenblock, Repeater, klassische Formulare) | `src/test/officialResultsVerhalten.test.ts` | Formular-Präfix, Bezeichnung/Einheit/Kennzeichnung, Formelfehler, doppelte Ergebnisschlüssel; Messdatenblock ohne Messungen, Rollen der Unterfelder, Messfall-Liste (leere Positionen, `element:`-Werte, Elemente außerhalb der Liste nie offiziell, nicht zugeordnete Importwerte, Importeinheiten, unlesbarer Import); Repeater ohne Zeilen; verwaiste Repeater-Zeilen (kein Repeater, verschachtelt, alle entfernt, `storage_key`, Sonderzeichen in der Formular-ID); klassische Rechenfelder (archiviert, verkettet in beliebiger Reihenfolge, Rundung, veralteter Wert, Formelfehler, fehlende Eingabe) | grün (1 × `it.fails`: F-1) |
| Auftrags-Ergebnisaggregation je Dienstleistung | `src/test/orderResultsAggregation.test.ts` | nur offizielle Werte, Gruppierung über Dienstleistungs-ID, fehlende ID/Namen, Mittelwert ohne fehlende Werte, Dezimalkomma/Text, getrennte Spalten je Ergebniskennung, nachgetragene Bezeichnung/Einheit, Ersatzproben, Messungen ohne offizielle Werte | grün |
| Auftrags-Ergebnisstruktur, Vergleichstabelle, Ergebnisgruppen | `src/test/orderResultsStructureVerhalten.test.ts` | nur offizielle Werte, natürliche Probensortierung, Messungen ohne Probe, mehrere Dienstleistungen, Messdatenblock-Instanzen (Bezeichnung, Kontext, Platzhalter), Zahl/Text/Leerwert, Metadaten, Ersatzprobe, definierte Ergebnisstruktur über kanonischen Schlüssel; Vergleich mit fehlenden Werten, Text, Einheit; Gruppierung „Ergebnisse“ | grün |
| Kurven-Datensatz (Kanäle, Ausschnitt, Interpolation, Reduktion, Fläche, Übersicht) | `src/test/curveDataset.test.ts` | Kanalüberschriften (leer, leere Klammer, dL/L0, Leerzeichen, letzter Schrägstrich), Kanalschlüssel, ungültige Punkte, fehlende Kanäle, Bereichsgrenzen (inklusiv, vertauscht), Interpolation (leer, außerhalb, Grenzen, absteigend, doppeltes X), Downsampling, Trapezfläche mit Basislinie, X-Bereich, Min-Max-Übersicht | grün |
| Kurven-Export CSV | `src/test/curveExport.test.ts` | Metazeilen, leere Werte statt 0, CSV-Quoting, Punkt-/Bereichsauswertung, Rückfall auf technische Schlüssel, Berichtsübernahme, Änderungsdatum | grün |
| Ergebnis-API (`measurementResults`) | `src/lib/api/__tests__/measurementResults.test.ts` | Tabellen/Filter (ohne interne Aufträge, Auftrag, Messung, ID), Präzisionsdefinitionen (keine Abfrage ohne IDs, Rückfall bei fehlendem Zugriff), Anlegen/Ändern/Löschen, verknüpfte Formularwerte (eigene Probe, eigene Messung ausgeschlossen), DB-Fehler kommen als Fehler an | grün |
| Messungs-API (`measurements`) | `src/lib/api/__tests__/measurements.test.ts` | offene Aufgaben nur bei Kompetenz, Vertretungskandidaten ohne Dubletten, höchste Projektrolle, RPCs `claim_`/`reassign_`/`release_`/`delete_order_measurement` mit Parametern, leere ID-Listen ohne Abfrage, Abschluss mit bereinigter Begründung, Statusänderung, Statistik-Zeitraum, DB-Fehler kommen als Fehler an | grün |
| Formel-Engine (Rechenarten, Funktionen, Fehlerfälle, Referenzen) | `src/test/formulaEngineVerhalten.test.ts` | Punkt vor Strich, Linksassoziativität, Klammern, `%` als Prozentanteil, unäres Minus/Plus; Zahlen (Dezimalpunkt, `_`, deutsches Format und Einheiten aus Feldern, Wahrheitswerte); Felder mit Punkt-Notation, Konstanten PI/π/E und Vorrang gleichnamiger Felder, bekannte Referenzen ohne Wert, leere/Text-Feldwerte; alle Funktionen (SUM … DEGREES ohne LN/Trig, IF ohne Sonst-Zweig), Listen/Mehrfachauswahl, leere Listen, Semikolon als Trenner; Vergleiche außerhalb IF; Fehlermeldungen mit Position (Division durch 0, unbekannte Funktion/Feld, Klammern, Komma, Zeichen, leere Formel); `extractReferences`; Editor-Beschreibungen | grün (7 × `it.fails`: F-3, F-4, F-5, F-6 ×2, F-7, F-8; leere Werte in SUM/MIN/MAX wie Excel) |
| Rechen-Bindings globaler Berechnungen | `src/test/calculationBindings.test.ts` | Ein-/Ausgabebindungen lesen (Standardquelle/-ziel, ungültige Einträge), Quellen Konstante/Formularfeld/System/Stammdaten/Berechnung (Rückfall, Semikolon-Listen, fehlende Quelle, Zyklus), Vorrang Bindung > Formular > System, Formelfehler werden weitergegeben, Ausgaben nur auf Formularfelder (auch 0, ohne Fehler/leere Werte), Verkettung unabhängig von der Reihenfolge | grün |
| Berichts-Platzhalter, Report-Bindings, Feldkatalog-Formatierung | `src/test/reportPlaceholdersVerhalten.test.ts` | Katalog (eindeutige Tokens, Token → Pfad, AG/MDL ausgenommen), Pfadauflösung mit Index, Formatierung (leer „—“, Ja/Nein, Listen, Tabellen, Objekte, ISO-Datum), Token-Ersetzung (Leerzeichen, mehrfach, AG:/MDL:, freie Pfade, Systemvariablen, unbekannte bleiben stehen); `shared_data`-Bindings (order-Wurzel, verschachtelt, JSON, Baum ohne Mutation, Abflachen); Ablageort-Rückfall; Zahlen-/Datums-/Einheitenformat; Beispielwerte (feste Uhrzeit) | grün (4 × `it.fails`: F-9, F-10 ×3) |
| Globale Validierungsregeln | `src/test/globalValidation.test.ts` | Pflicht (leer, 0/false gültig), Bereich inkl. Grenzen und Dezimalkomma, min/max nur eigene Grenze, offener Bereich, leere/Text-Werte toleriert, Muster (ungültiges Muster blockiert nicht), eigene Meldung/Schweregrad, Ausdrucksregel, mehrere Regeln, `validation_ids` aus Metadaten | grün (2 × `it.fails`: F-11) |
| Feldtypen des Formulardesigners | `src/test/formFieldTypes.test.ts` | eindeutige Typen, Bezeichnung/Rückfall, Unterfeldtypen ohne Repeater/Messblock und ohne leere Gruppen, `slugify` (Sonderzeichen, Akzente, Ränder, 60 Zeichen) | grün (2 × `it.fails`: F-12) |
| Repeater-Aggregation | `src/test/repeaterAggregation.test.ts` | Schlüssel `bereich.unterfeld`, Referenzen mit Bezeichnung/Einheit in Unterfeld-Reihenfolge, nur Repeater, Zahlenlisten je Unterfeld (deutsches Format, Einheit), leere/Text-Werte nie als 0, fehlende Einträge, Auswertung mit SUM/COUNT/AVERAGE | grün |
