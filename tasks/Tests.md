# Tests – Sicherheitsnetz vor dem Aufräumen (Aufgabe 021)

## Bestand und Lücken

Stand: 2026-11-21, Branch `main` (Commit `e401284a`). Ermittelt durch Lesen von Code, Tests und Migrationen und durch einen Volllauf. Die Abdeckung ist eine Einschätzung anhand von Testtiteln und Importen, keine Coverage-Messung.

### Ausgangslage

| Punkt | Befund |
|---|---|
| Test-Framework | Vitest 3 (jsdom, `globals`), Setup `src/test/setup.ts` (nur `jest-dom` und `matchMedia`-Stub), Befehl `npm test` |
| Testdateien | 156 Dateien, 1438 Tests (rund 120 in `src/test/`, der Rest neben dem Code in `src/lib/**`) |
| Art der Tests | fast nur reine Logik, Backend per `vi.mock("../client")` gemockt; nur 3 API-Tests (`src/lib/api/__tests__`) |
| Seiten-/E2E-Tests | keine (Ausnahme: einzelne Komponententests wie `ordersPageSamples.test.tsx`, `UseAsTemplateDialog.test.tsx`) |
| DB-Tests (Funktionen/Trigger/RLS) | keine im Testlauf. Nur manuelle Skripte mit einem Wegwerf-Postgres: `scripts/test-order-deletion-local.py`, `scripts/test-equipment-local.py` |
| DB-Umfang | 206 Migrationen in `supabase/migrations`, zusätzlich `drizzle/migrations` (Equipment u. a., zweiter Strang). Roh gezählt (inkl. überschriebener Fassungen): ca. 236 Funktionen, 186 Trigger, 562 Policies, ca. 616 `has_role(`- und 370 `has_permission(`-Aufrufe |
| Typprüfung | `npx tsc -p tsconfig.app.json --noEmit`: 0 Fehler (lokal ca. 6 min) |
| Volllauf auf `main` | **nicht grün**: 6 Dateien / 37 Tests rot, siehe „Rote Tests auf main“ |
| CI | nur `.github/workflows/release.yml`: baut und veröffentlicht bei **jedem Push auf `main`** (Versionssprung, Tauri-Release), ohne Tests und ohne Typprüfung |
| PGlite o. Ä. | nicht installiert |

### Rote Tests auf main

Lokal läuft Node v26.13.1, `release.yml` nutzt Node 20. Die bisher erkannte Ursache ist `localStorage` unter Node ≥ 25: Node bringt ein eigenes globales `localStorage` mit, das jsdom überdeckt und ohne `--localstorage-file` `undefined` ist. Das ist ein Umgebungsproblem, kein Fachfehler (Annahme, noch nicht mit Node 20/22 gegengeprüft).

| Testdatei | Rot | Fehlerbild | Vermutete Ursache |
|---|---|---|---|
| `src/lib/modularReport/__tests__/modularReport.test.ts` | 17/17 | `Cannot read properties of undefined (reading 'clear')` | `localStorage` (Node ≥ 25) |
| `src/test/taskServiceFilter.test.ts` | 11/11 | wie oben | `localStorage` |
| `src/test/ordersPageSamples.test.tsx` | 5 | wie oben bzw. `STACK_TRACE_ERROR` | `localStorage` |
| `src/test/orderFilterPersistence.test.tsx` | 2 | gespeicherte Filter werden nicht wiederhergestellt bzw. auf ein anderes Konto übertragen | vermutlich `localStorage` (Persistenz) |
| `src/test/nestedMeasurementRenderer.test.tsx` | 1 | `STACK_TRACE_ERROR` (Punkte hinzufügen/umsortieren/duplizieren/entfernen) | unklar: Umgebung, Zeitlimit oder echter Fehler |
| `src/test/refreshGuard.test.ts` | 1 | „meldet Ladefehler“: Promise wird erfüllt statt abgelehnt | unklar: möglicherweise echter Fehler |

Bewertung: 34 von 37 roten Tests gehen sehr wahrscheinlich auf `localStorage` zurück. Die beiden Einzelfälle muss ich auf Node 20/22 gegenprüfen, bevor ich sie als Umgebungsproblem oder als echten Fehler einordne.

### Legende

- **Abdeckung:** gut = Kernfälle inkl. Grenzfälle getestet · teilweise = einzelne Aspekte oder nur Hilfslogik · keine
- **Risiko bei Umbau:** wie wahrscheinlich und wie schädlich ein unbemerkter Bruch beim Aufräumen wäre
- **Art:** R = reine Funktion (ohne Mocks testbar) · A = API-Schicht (mit gemocktem `dbClient` testbar) · U = UI/Seite · DB = Funktion/Trigger/RLS (nur gegen Testdatenbank)

---

### 1. Aufträge

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Auftrag anlegen (Formular, Service-Tabs, Auswahl/Abwahl, Wertübergabe) | `pages/CreateOrderPage.tsx` (1547 Z.), `lib/orderCreation/*`, `lib/orderServiceSelection.ts`, `lib/orderFormValueHandover.ts` | `orderServiceSelection`, `serviceDeselection`, `activeServiceTab`, `serviceFormStatus`, `orderFormValueHandover`, `serviceTabsFiltering` | teilweise (Hilfslogik gut, Seite keine) | hoch | R/U |
| Auftrags-API (CRUD, Instanzen, Analyse-Anforderungen) | `lib/api/orders.ts`, `orderInstances.ts`, `orderAnalysisRequests.ts` | – | keine | hoch | A |
| Auftrag löschen/stornieren (RPC `cancel_or_delete_order`), einzelne Messung löschen | `lib/api/orders.ts`, `lib/measurementRun/deleteMeasurement.ts` | `api/__tests__/orderDeletion.test.ts` (gemockt), `deleteMeasurement.test.ts`; manuell `scripts/test-order-deletion*` | teilweise | hoch | A/DB |
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
| **Vorläufige vs. offizielle Ergebnisse** | `lib/officialResults.ts` (535 Z.), `lib/resultSchema.ts`, `scopedMeasurementValues.ts` | `officialResults` (nur 3 Tests), `repeaterOfficialResults`, `repeaterCalculationResults`, `resultSchema`, `scopedMeasurementValues`, `recipeResultValue` | teilweise | hoch | R |
| Ergebnisse ersetzen/ergänzen (RPC `replace_measurement_results`), Korrekturhistorie | `lib/results/replaceResults.ts`, `lib/api/resultCorrections.ts` | `replaceResults` (24), `localAvSecondCorrection` | gut (Client), DB keine | mittel | R/DB |
| Messlauf (Guards: Hydrierung, Speichern, Verlassen) | `lib/measurementRun/*`, `hooks/useMeasurementAutosave.ts` | je Modul eine Testdatei | gut (Hook keine) | mittel | R |
| Messungs-API, Messungsnummer, Statusprotokoll | `lib/api/measurements.ts`, `measurementResults.ts`, `generate_measurement_number` | – | keine | hoch | A/DB |
| Messdatei-Import (Profile, Klassifikation, Blöcke, RFA-Fälle) | `lib/measurementImport.ts` (504 Z.), `measurementClassification.ts`, `measurementBlocks.ts` | `measurementImport` (5), `measurementClassification`, `measurementBlocks`, `rfa*` (5 Dateien) | teilweise | mittel | R |
| Geräte-Importe Netzsch, Gassorption/BJH, Geometrie | `lib/instrumentImport/*` | `netzschImport`, `gasSorptionImport`, `gasSorptionSmp`, `bjhWorkbookImport`, `bjhCharts`, `geometryImport` | gut | niedrig | R |
| Kurven (Datensatz, Auswertepunkte, Zoom, Beschriftung, Export) | `lib/curves/*` | `analysisTypes`, `curveEvaluationPoints`, `curveZoom`, `curveViewerZoom.test.tsx`, `labelLayout` | teilweise (`dataset.ts`, `export.ts` keine) | mittel | R |
| Ergebnisdatenbank (Seite, Aggregation, Diagramme, Anzeigegenauigkeit) | `pages/ResultsDatabasePage.tsx` (1124 Z.), `lib/results/sampleResultsAggregation.ts`, `lib/orderResultsAggregation.ts`, `orderResultsStructure.ts`, `resultDisplayPrecision.ts` | `sampleResultsAggregation`, `resultsChartData`, `resultDisplayPrecision` | teilweise (Auftrags-Aggregation keine) | hoch | R/U |
| Statistik | `lib/resultsStatistics.ts` | `resultsStatistics` | gut | niedrig | R |
| Ergebnis-/Auftraggeber-Bedingungen | `lib/resultConditions.ts`, `lib/results/requesterConditions.ts` | `calcResultConditions*`, `requesterConditions` | gut | niedrig | R |

### 4. Formulare

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| **Formel-Engine** (Parser, Rechenarten, Funktionen, Fehlerfälle, Referenzen) | `lib/formulaEngine.ts` (548 Z.) | `formulaComparison`, `formulaLn`, `formulaTrig`, `globalConstants` | teilweise (Grundrechenarten, Fehlerfälle, `extractReferences` fehlen) | hoch | R |
| **Rechen-Bindings** (`resolveBinding`, `runCalculation`, `applyCalculationOutputs`) | `lib/calculationBindings.ts`, `lib/api/formCalculations.ts` | nur indirekt (`calcLinkedFields`, `seriesCalculations` …) | teilweise | hoch | R |
| Lokale Berechnungen, Serien, verknüpfte Vorgaben | `lib/localCalculations.ts` | `calcLinkedFields`, `calcLinkedVorgaben`, `seriesCalculations`, `localAvSecondCorrection` | gut | mittel | R |
| Regeln (Auswertung, nicht leer, Repeater-Unterfeld, Leistung auslösen) | `lib/ruleEvaluation.ts`, `lib/api/ruleTriggers.ts` | `ruleTriggers`, `ruleNotEmpty`, `ruleRepeaterSubfield` | teilweise | mittel | R/A |
| Repeater (Layout, Zeilentitel, Köpfe, Fokus, Aggregation) | `lib/repeater*.ts`, `FormLayoutRenderer.tsx` (2421 Z.) | `repeaterRowLabel`, `repeaterTableHeaders`, `repeaterFocusStability`, `repeaterCalc*`, `repeaterSubfieldMasterData` | gut (`repeaterAggregation` keine) | hoch | R/U |
| Verknüpfte Felder und Formularwerte | `lib/fieldLinks.ts`, `lib/linkedFormValues.ts` | `fieldLinks`, `linkedFormValueSource`, `linkedFormValuesInstances` | gut/teilweise | mittel | R |
| Formular-Spiegelung | `lib/formMirrorGuard.ts` | `formMirrorGuard.test.ts` | gut | niedrig | R |
| Stammdaten, inaktive Optionen, globale Felder/Vererbung | `lib/masterData*.ts`, `lib/globalFieldInheritance.ts` | `masterDataRef`, `inactiveMasterDataOptions`, `globalFieldInheritance` | teilweise | mittel | R |
| Validierung, Feldtypen | `lib/globalValidation.ts`, `lib/formFieldTypes.ts` | – | keine | mittel/hoch | R |
| Formulardefinitionen, Rollenansichten, Feldrechte, Versionen, Klonen | `lib/api/formDefinitions.ts`, `formRoleViews.ts`, `formFieldPermissions.ts`, `serviceVersions.ts`, DB `_clone_form_definition` | – | keine | hoch | A/DB |
| Rich Text | `lib/richText.ts` | `richText.test.ts` | gut | niedrig | R |
| **Berichts-Platzhalter und Bindings** | `lib/reportPlaceholders.ts`, `reportBindings.ts`, `reportFieldCatalog.ts` | – | keine | hoch | R |
| Modularer Bericht | `lib/modularReport/*` | `modularReport.test.ts` (rot, `localStorage`) | gut (sobald lauffähig) | mittel | R |
| Kundendokumentation (Kapitel, Export, Revisionsabgleich) | `lib/customerDocumentation/*` | `chapters.test.ts`, `releaseSync.test.ts` | teilweise | mittel | R |
| Service-Designer (Formular-, Regel-, Bericht-, Layout-Designer) | `components/ServiceDesigner/*`, `pages/AdminServiceDesignerPage.tsx` | – | keine | hoch | U |
| Bericht erzeugen (Edge Function `generate-order-report`, 1029 Z.) | `supabase/functions/generate-order-report` | – | keine | hoch | R/DB |

### 5. Pilot Plant

| Funktionalität | Quelle | Vorhandene Tests | Abdeckung | Risiko | Art |
|---|---|---|---|---|---|
| Neuer Prozess (Templates `kind='pilot_plant'`, Step-Runs, Guided Stepper, Runtime-Panel) | `lib/api/processTemplates.ts`, `orderStepRuns.ts`, `workflowEngine.ts`, `PilotPlantGuidedStepper.tsx`, `ProcessRuntimePanel.tsx` | – | keine | hoch | A/U/DB |
| Alter Prozess (Blöcke, als `@deprecated` markiert) | `lib/api/pilotPlantProcess.ts`, `PilotPlantProcessPanel.tsx` | – | keine | mittel | A/U |
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
| Desktop-Updater, Release | `components/UpdateChecker.tsx`, `src-tauri/*`, `release.yml` | – | keine | hoch | – |
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
| 0 | `improve/tests-basis` | Volllauf auf `main` grün machen: `localStorage` für Node ≥ 25 im Test-Setup absichern, übrige rote Tests klären oder als bekannten Fehler markieren | ohne grünen Ausgangspunkt kann der test-runner nicht zwischen „durch Änderung kaputt“ und „vorher schon kaputt“ unterscheiden |
| 1 | `improve/tests-ergebnisse` | `officialResults` (vorläufig/offiziell), Auftrags-Ergebnisaggregation, `curves/dataset`/`export`, Messungs-API | Kern der Laborergebnisse, 535 Zeilen mit nur 3 Tests |
| 2 | `improve/tests-formulare` | `formulaEngine` systematisch, `calculationBindings`, `reportPlaceholders`/`reportBindings`, `globalValidation`, `formFieldTypes`, `repeaterAggregation` | alle Berechnungen und Berichte hängen daran |
| 3 | `improve/tests-projekte` | `costBreakdown`, `projectServiceAggregation` (inkl. doppeltem `measurementHours`), `controllingExport` | Geld und Stunden ohne einen einzigen Test |
| 4 | `improve/tests-rechte` | `passwordPolicy`, `roles`, Permission-Keys Client ↔ SQL (Abgleich wie `audit-permissions.ts`), `externalCustomer`, Auth-Context-Verhalten | Sicherheitsgrenze im Client |
| 5 | `improve/tests-freigaben` | `productionDocuments/requirements`, `productionRelease/fields`, `specValues`, `importPipeline` (reine Anteile), Freigabe-API | große ungetestete Pipeline |
| 6 | `improve/tests-auftraege` | `excel-import`, Workflow-/Status-Client, Auftrags-API, Smoke-Tests für `CreateOrderPage` | größte Seite, viele Abläufe |
| 7 | `improve/tests-lager` | `hazardClasses`, `labels/fields`/`symbols`, Gebinde-API, Mischungs-/Chargen-API | Bestandsbuchung |
| 8 | `improve/tests-pilot-plant` | `workflowEngine`, `orderStepRuns`, `processTemplates`, Stepper | neuer Prozess ungetestet |
| 9 | `improve/tests-proben` | `labels/print`, Proben-API, Ersatzprobe/Umhängen | überwiegend schon gut |
| 10 | `improve/tests-m3` | `constants`, `template`, `pdfExport` vertiefen | schon gut abgedeckt |
| 11 | `improve/tests-sonstiges` | Feiertage, ISO-Woche, i18n-Schlüsselvollständigkeit, `chartExport` | geringes Risiko |
| DB | `improve/tests-db-*` | Testdatenbank (z. B. PGlite) mit allen Migrationen; danach RLS je Rolle, Nummernkreise, Auftragssperre/Workflow, Bestandsbuchung, Chargen, Ergebnis-RPCs | höchstes Risiko insgesamt, braucht aber erst die Entscheidung zum Aufbau |

## Testübersicht (fortlaufend gepflegt)

| Funktionalität | Testdatei | Was wird geprüft | Status |
|---|---|---|---|
| _wird ab Schritt 3 je Bereich ergänzt_ | | | |
