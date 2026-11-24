# Abhängigkeiten zwischen Code und Konfiguration

Zweck: Ändert sich in Prod eine Konfiguration (Formular, Feld, Dienstleistung, Workflow, Globales Feld …), soll schnell
klar sein, ob **unser Code** davon betroffen ist. Die Liste nennt Stellen im Code, die an bestimmten Schlüsseln,
Namen oder Strukturen hängen.

Grundlage: `tasks/029b-konfig-tabellen.md` (welche Tabellen die Oberfläche ändert). Stand: Dev-`main`
b8abe423 (2026-11-24). Es stehen **keine Messwerte und keine Kundendaten** in dieser Datei, nur Schlüssel und Namen aus dem Code.

## So liest man die Liste

- **Hängt an:** Konfiguration, auf die sich der Code verlässt (Tabelle, Schlüssel, Name).
- **Wenn umbenannt/gelöscht:** was im Code passiert. „Sicherheitsnetz" heißt: nichts geht verloren, die Anzeige fällt
  zurück auf die allgemeine Darstellung. „Stille Abweichung" heißt: kein Fehler, aber falsche oder fehlende Anzeige.
- **Risiko:** hoch = falsches Ergebnis oder Abbruch möglich, mittel = falsche Darstellung, niedrig = kosmetisch.
- Geprüft wurde nur, was im Code steht. Prod-Formulare selbst sind hier nicht erfasst. Ob ein Schlüssel in Prod
  tatsächlich so heißt, zeigt der Konfig-Diff (siehe `CLAUDE.md`).

## Überblick nach Risiko

| Bereich | Code | Hängt an | Risiko |
|---|---|---|---|
| Aktivitätsmessung (NOx) | `src/lib/results/activityMeasurement.ts` | Feldschlüssel-Muster | mittel |
| BET | `src/lib/results/betMeasurement.ts` | Schlüssel `spezifische_oberflache_bet`, Messart | mittel |
| m³-Liste | `src/lib/m3List/*` | Formular „m³-Liste", Konstanten `m3_*`, Feldschlüssel | **hoch** |
| Mundstück 293/1 (Auto-Regel) | `src/lib/rules/mundstueck293.ts`, `src/lib/api/mundstueck293.ts` | Feld- und Dienstleistungsnamen | **hoch** |
| Ergebnisse und offizielle Werte | `src/lib/officialResults.ts` | `is_result`, Formeln, Messblöcke | **hoch** |
| Messdatenblöcke und RFA | `src/lib/measurementBlocks.ts`, `rfaFixedElements.ts` | Blockfelder, Elementliste | **hoch** |
| Ergebnisstruktur je Dienstleistung | `src/lib/resultSchema.ts` | `service_parameter_definitions` | mittel |
| Excel-Export | `src/lib/orderExport/buildOrderExport.ts` | wie Aktivität/BET, Ergebnisse | mittel |
| Berichte / Kundendokumentation | `src/lib/reportFieldCatalog.ts`, `reportBindings.ts`, `customerDocumentation/*` | Feldpfade, Dienstleistungsnamen | mittel |
| Auftragsvorlagen und Eingaben | `src/lib/orderTemplateInputs.ts` | Feldschlüssel, `binding_path` | mittel |
| Auftragsart → Formular | `src/lib/api/orderKindFormTemplates.ts` | Auftragsarten `labor`, `pilot_plant` | mittel |
| Formelberechnungen | `src/lib/formulaEngine.ts`, `officialResults.ts` | Feldschlüssel in Formeln | **hoch** |
| Workflows | Datenbankfunktionen `wf_*`, `expand_*workflow*` | Workflow-Tabellen | **hoch** |
| Projektkosten (Knetung) | `src/pages/ProjectDetailPage.tsx` | Dienstleistungsname enthält „knetung" | niedrig |

## Einträge

### 1. Aktivitätsmessung (NOx)

- **Code:** `src/lib/results/activityMeasurement.ts`, Ansicht `src/components/results/ActivityMeasurementView.tsx`, Excel `activityExportRows` in `src/lib/orderExport/buildOrderExport.ts`. Regeln: `docs/gestaltungsregeln.md` (Abschnitt Aktivitätsmessung).
- **Betroffen:** Messart „Aktivitätsmessung" (Formular mit Messblock oder flachen Feldern je Temperaturstufe).
- **Schlüssel im Code:** Block `aktivitatsmessblock`, Unterblock `gas_einstellungen`, Katalysatorkennung `kat_nr`, `test_nr`, `temperatur_n`, `eta_nox`, `eta_nox_kopie`, `eta_nox_kopie_kopie`, `k_wert`, `k_wert_kopie`, Gase `<gas>_in_n` / `<gas>_out_n` (NO, NH3, NO2, N2O, CO, CO2), Altfelder `no`, `no_2`, `nh3_1`, `nh3_2`, `h2o`, `o2`, `co`. Erkennung über die **Struktur** (Muster), nicht über feste Nummern.
- **Wenn umbenannt/gelöscht:** Das Muster greift evtl. nicht mehr. Dann landet der Wert unter „Weitere Angaben" (nichts geht verloren), oder eine Spalte/ein Bereich fehlt mit Hinweis. Wird der Feldname so geändert, dass kein Muster passt, ändert sich die Reihenfolge/Zuordnung zu Katalysator oder Temperaturstufe. Stille Abweichung möglich (Zahl landet in falscher Stufe).
- **Bei Änderung:** Feldnamen der neuen Formularversion prüfen (dafür gibt es die reine Abfrage `scripts/analyse/aktivitaet-varianten.sql`; die Feldnamen lassen sich auch aus dem Konfig-Schnappschuss holen), Zuordnung in `activityMeasurement.ts` ergänzen, Test mit den echten Feldnamen anlegen.

### 2. BET (spezifische Oberfläche)

- **Code:** `src/lib/results/betMeasurement.ts`, Ansicht `src/components/results/BetResultsTable.tsx`. Regeln: `docs/gestaltungsregeln.md` (Abschnitt BET).
- **Betroffen:** Messart „BET" / „Spezifische Oberfläche".
- **Schlüssel im Code:** Ergebnisfeld `spezifische_oberflache_bet`; alternativ Beschriftung „…Oberfläche…BET…" oder ein `*bet*`-Feld mit Einheit m²/g. Hilfswerte (Tara, Brutto, Probengewicht, Rohr-Nr., SMP-Nummer, Importinfo) werden ausgeblendet.
- **Wenn umbenannt/gelöscht:** Findet sich kein BET-Ergebnisfeld, bleibt alles sichtbar (Sicherheitsnetz). Wird der BET-Wert so umbenannt, dass weder Schlüssel noch Beschriftung noch Einheit passen, erscheinen die Hilfswerte wieder und die Zähler (offiziell/vorläufig) zählen anders. Wird ein Hilfswert so benannt, dass er wie ein BET-Ergebnis aussieht, würde er fälschlich als Ergebnis gelten.
- **Auch betroffen:** Dienstleistungs-Erkennung „BET" in `detectAnalysisKey` (siehe Eintrag 9).

### 3. m³-Liste

- **Code:** `src/lib/m3List/` (`template.ts`, `constants.ts`, `derive.ts`, `calculations.ts`, `retrofit.ts`, `sampleNumber.ts`), Oberfläche `src/components/productionDocuments/M3ListForm.tsx`, Hinweise in `src/lib/m3List/AGENTS.md`.
- **Betroffen:** Formularvorlage namens **„m³-Liste"** (`M3_FORM_NAME`), Wiederholbereich `m3_rows`, Auswahl `lab_tests_selected`, globales Objekt `m3_liste`.
- **Schlüssel im Code:**
  - Kopfdaten: `order_number`, `project_name`, `customer_name`, `end_customer`, `article_number`, `release_label`, `v2o5_percent`, `length_mm`, `piece_count`, `inner_wall_thickness_mm`, `cross_section_mm`, `cell_configuration`, `completion_date`, `delivery_date`.
  - Kontrollfelder: `delivery_volume_m3`, `av_nox`, `av_sox`, `sox_required`, `doku_date` u. a.
  - Berechnet: `cell_count`, `elements_per_m3`, `required_length_mm`, `total_element_count` u. a.
  - Konstanten (globale Felder mit Datenquelle „constant"): `m3_querschnitt_m`, `m3_druckpruefung_mm`, `m3_rsm_max_mm`, `m3_laborkat_zuschlag_mm`, `m3_elementanzahl_rundung`.
- **Wenn umbenannt/gelöscht:**
  - Formular „m³-Liste" umbenannt: Der Code findet die Vorlage nicht und bricht mit Fehlermeldung ab („Die bestehende Formularvorlage … wurde nicht gefunden"). Es wird bewusst keine neue Vorlage erzeugt.
  - Feld fehlt: Die Vorlagen-Funktion legt fehlende Felder neu an. Ist `m3_rows` kein Wiederholbereich, bricht sie zum Schutz der Konfiguration ab.
  - Konstante fehlt oder nicht lesbar: Kein Ersatzwert, die Berechnung meldet die Konstante als fehlend. Die Erkennung läuft zuerst über den Schlüssel, danach über die Bezeichnung.
- **Datenbank:** Die Funktion `m3_retrofit_order_samples` und die Löschfunktionen (`delete_m3_list`, `m3_list_delete_plan`) erkennen aus der m³-Liste erzeugte Proben an der Beschreibung („Aus m³-Liste…" bzw. „m³-Liste Zeile N"). Eine Änderung dieser Texte ändert, was gelöscht wird.

### 4. Mundstück 293/1 (automatische Regel)

- **Code:** `src/lib/rules/mundstueck293.ts` (Planung), `src/lib/api/mundstueck293.ts` (Zugriff).
- **Betroffen:** Formularfelder im Auftragsformular, Dienstleistung **„Extrusion"** und Dienstleistungen **„Schwindung <MS>"**, Stammdatenliste der Mundstücke.
- **Schlüssel im Code:** `ms_auswahl_1` (Wiederholbereich), Unterfeld `ms`, `mundstueck_ms_1`, `brennen_1`, `analyse_ppp` (in `shared_form_data.template.values`), gesperrte Auto-Felder `anzahl`, `laenge`, Zwecke „Raumgewicht / Wasseraufnahme" und „Schwindung", Schlüsselpräfix `schwindung_ms_`.
- **Wenn umbenannt/gelöscht:** Fehlt das Unterfeld `ms` oder ist es mehrdeutig, werden keine Auto-Einträge erzeugt (kein Fehler, die Regel tut nichts). Wird die Dienstleistung „Extrusion" umbenannt, wird sie nicht mehr erkannt. Die Verknüpfung zwischen `ms_auswahl_1` und `mundstueck_ms_1` besteht nur über die Reihenfolge der Zeilen. Wer dort Zeilen umsortiert oder ein Feld ersetzt, verschiebt die Zuordnung (stille Abweichung).
- **Läuft bei:** Auftrag speichern, Formular speichern, Leistung buchen/löschen.

### 5. Ergebnisse und offizielle Werte

- **Code:** `src/lib/officialResults.ts` (`buildServiceResultCandidates`, `buildLinkedFormResultCandidates`), Ergebnisdatenbank (`ResultsDatabasePage`, `src/lib/results/*`).
- **Betroffen:** alle Formulare und Dienstleistungen mit Ergebnisfeldern.
- **Schlüssel/Kennzeichen:** `is_result`, `result_label`, `field_type = computed`, Formel `validation.formula` bzw. `form_calculations` mit `is_result`. Ergebnisnamen haben die Form `form:<Formular-ID>:<Feldschlüssel>` und stehen so in `measurement_results.result_name`.
- **Wenn umbenannt/gelöscht:**
  - Feldschlüssel umbenannt: Neue Ergebnisse laufen unter dem neuen Namen. Bereits gespeicherte Werte bleiben unter dem alten Namen. In Auswertungen und Excel erscheinen zwei Spalten (alt und neu), eine ältere Messung wird nicht umbenannt.
  - `is_result` entfernt: Der Wert ist nicht mehr „offiziell", er zählt nicht mehr als Ergebnis.
  - Eingabefeld einer Berechnung gelöscht oder leer: Das Rechenfeld hat keinen Wert, beim Abschluss kommt die Meldung „offizielles Ergebnis konnte nicht berechnet werden" (siehe F-1).
- **Risiko:** hoch, weil Ergebnisse falsch zugeordnet oder doppelt erscheinen können, ohne Fehlermeldung.

### 6. Messdatenblöcke und RFA

- **Code:** `src/lib/measurementBlocks.ts`, `src/lib/rfaFixedElements.ts`, `src/lib/elementKeys.ts`, Ergebnisse in `officialResults.ts`.
- **Betroffen:** Formulare mit Feldtyp `measurement_block` (mehrere Messungen je Probe, z. B. RFA „kalibriert" / „Standardlos").
- **Schlüssel im Code:** `__instance_id`, `__label`, `__context` (innerhalb der Blockeinträge), Rollen der Unterfelder, Messfall/Elementbereich, feste Elementliste (17 Elemente „Kalibrierte Elemente"), Element-Schlüssel (`element:`-Werte).
- **Wenn umbenannt/gelöscht:** Wird der Messfall, die Elementliste oder die Rolle eines Unterfelds geändert, ändern sich Anzahl und Reihenfolge der Ergebnisfelder. Die 17 festen Elemente bleiben auch ohne Importwert erhalten, andere kommen nur bei Wert > 0 dazu. Ohne Messungen entstehen keine Ergebnisse. Wird ein Blockfeld aus dem Block herausgenommen (`parent_field_id`), erscheint es als normales Feld.
- **Erkennung RFA:** über Dienstleistungsnamen (Eintrag 9).

### 7. Ergebnisstruktur je Dienstleistung

- **Code:** `src/lib/resultSchema.ts`.
- **Hängt an:** `service_parameter_definitions` (Kategorie `output`: feste Ergebnisparameter und Reihenfolge je Dienstleistung).
- **Wenn umbenannt/gelöscht:** Die Zuordnung läuft über einen stabilen Schlüssel (`paramKey`), nicht über die sichtbare Bezeichnung. Eine reine Bezeichnungsänderung schadet nicht. Wird ein Parameter gelöscht, hängt der tatsächlich gemessene Wert hinten an (nichts geht verloren). Fehlender Wert = leere Zelle. Auch NOx-Spaltenreihenfolge und Gas-Richtung (`in`/`out`) werden aus den Namen abgeleitet (`noxColumnOrder`, `elementKeys`).

### 8. Excel-Export

- **Code:** `src/lib/orderExport/buildOrderExport.ts` (Auftrags-Excel), gemeinsamer Datenaufbau `src/lib/results/sampleDatabaseMapping.ts`.
- **Hängt an:** denselben Zuordnungen wie die Ergebnisdatenbank: Aktivitätsmessung (Eintrag 1), BET (Eintrag 2), Ergebnisse (Eintrag 5). Ein Blatt je Probe, plus Übersicht.
- **Wenn umbenannt/gelöscht:** Spalten und Zeilen folgen den Ergebnisnamen. Neuer Name = neue Spalte, alter Name bleibt für ältere Aufträge. Aktivität und BET werden im Excel in derselben festen Form ausgegeben wie in der Oberfläche, die Folgen sind dieselben wie dort.

### 9. Berichte und Kundendokumentation

- **Code:** `src/lib/reportFieldCatalog.ts`, `src/lib/reportBindings.ts`, `src/lib/reportPlaceholders.ts`, `src/lib/customerDocumentation/` (Kapitelzuordnung), Berichtsvorlagen aus `service_document_templates`.
- **Hängt an:**
  - Feldpfade in Vorlagen wie `{{schritt.feld}}` (Bezug auf `shared_data`), Platzhalter und gewählte Felder aus Formularen, globalen Feldern und Berechnungen.
  - Die Erkennung der Analyseart **aus dem Dienstleistungsnamen** (`detectAnalysisKey`): Namen mit „bench" + „NOx"/„SOx", „NOx", „SOx"/„SO2"/„SO3", „BET"/„Oberfläche", „RFA"/„XRF"/„Röntgenfluoreszenz", „Geometrie"/„Abmessung", „Physikal"/„Dichte"/„Porosität"/„Festigkeit"/„Härte". Daraus folgt das Kapitel im Bericht (Aktivität/Umsatz, physikalische Eigenschaften, Geometrie).
- **Wenn umbenannt/gelöscht:**
  - Dienstleistung umbenannt, sodass kein Stichwort mehr passt: Sie fällt auf „other" und erscheint unter „physikalische Eigenschaften", nicht im richtigen Kapitel. Kein Fehler, aber falsche Einordnung. Die Erkennung RFA (`isRfaService`) und die Elementbereiche hängen daran.
  - Feld umbenannt oder gelöscht: Der Pfad in der Vorlage findet nichts, der Platzhalter bleibt leer. Der Katalog sucht auch in bekannten anderen Ablageorten, ein Treffer ist daher nicht ausgeschlossen.
- **Risiko:** mittel (falsches Kapitel oder leere Stelle im Bericht).

### 10. Auftragsvorlagen und Eingaben

- **Code:** `src/lib/orderTemplateInputs.ts`, `src/lib/orderTemplateCopy.ts`, Auftragsanlage (`src/lib/orders/*`).
- **Hängt an:** Feldschlüssel, die beim Kopieren/Bearbeiten **nicht** übernommen werden: `versuchsnummer`, `pp_experiment_number`, `order_number`, `sample_number`, `measurement_number`, außerdem `binding_path = order.versuchsnummer`. Ergebnisfelder, Rechenfelder, Datei-, Bild- und Messimport-Felder werden nie als Eingabe übernommen.
- **Wenn umbenannt/gelöscht:** Wird `versuchsnummer` umbenannt, wird es beim Kopieren einer Vorlage übernommen (stille Abweichung, doppelte Versuchsnummer). Wird ein Eingabefeld zum Ergebnisfeld (`is_result`), fehlt es ab dann in Kopien.

### 11. Auftragsart und Formular

- **Code:** `src/lib/api/orderKindFormTemplates.ts`, Admin-Tab „OrderKindMapping" (`OrderKindMappingTab.tsx`).
- **Hängt an:** Auftragsarten `labor` und `pilot_plant` (Typ `OrderKind`), Tabelle `order_kind_form_templates`.
- **Wenn umbenannt/gelöscht:** Wird das zugeordnete Formular gelöscht oder archiviert, hat die Auftragsart keine Vorlage. Neue Auftragsarten müssen im Code (Typ `OrderKind`) ergänzt werden, sonst gibt es sie nur in der Konfiguration.
- **Pilotanlage:** Datenbankfunktionen `pp_seed_blocks`, `pp_start_block`, `pp_complete_block`, Tabelle `pilot_plant_blocks` hängen an der Auftragsart `pilot_plant`.

### 12. Formelberechnungen

- **Code:** `src/lib/formulaEngine.ts`, Auswertung in `officialResults.ts`, Anzeige im Formular-Renderer (`FormLayoutRenderer.tsx`), `src/lib/globalConstants.ts`.
- **Hängt an:** Feldschlüsseln, die in Formeln (`validation.formula`, `form_calculations.formula`, `global_calculations`) vorkommen, und an globalen Konstanten (globale Felder mit Datenquelle „constant").
- **Wenn umbenannt/gelöscht:** Der Feldschlüssel in der Formel zeigt ins Leere. Die Formel meldet dann „unbekannte Referenz" oder liefert leer, je nach Konfiguration. Bei einem **umbenannten** Eingabefeld rechnet die Formel mit dem alten Namen weiter nicht mehr, die Berechnung bleibt leer. Wird eine Funktion neu eingeführt (z. B. neue Funktionsnamen in der Formel), unterstützt die Engine nur ihre feste Liste (SUM, AVERAGE, MIN, MAX, COUNT, MEDIAN, ROUND, CEIL, FLOOR, ABS, SQRT, POW, LN, SIN, COS, TAN, ASIN, ACOS, ATAN u. a.).
- **Risiko:** hoch, weil ein leeres Rechenfeld beim Abschluss den Auftrag blockieren kann.

### 13. Workflows und Prozesse

- **Code:** Datenbankfunktionen `wf_start_step`, `wf_complete_step`, `wf_start_task`, `wf_finalize_order`, `wf_seed_from_template`, `expand_service_workflow`, `expand_order_workflows`, `create_order_workflow_instance`; Oberfläche `WorkflowDesigner`, `WorkflowStepsDesigner`, `TaskExecutionPage`, `ProcessRuntimePanel`.
- **Hängt an:** `service_workflows`, `service_workflow_definitions`, `service_workflow_steps`, `service_workflow_step_services`, `process_templates`, `process_steps`. Laufende Aufträge halten eine Kopie bzw. verweisen auf Schritte (`order_workflow_tasks`, `order_step_runs`, `order_process_services`).
- **Wenn umbenannt/gelöscht:** Löschen eines Schritts oder einer Zuordnung, während Aufträge darauf laufen, kann laufende Aufträge unvollständig machen (Schritt fehlt, Abschluss nicht möglich). Änderungen an Definitionen gelten nur für neu angelegte Aufträge, wenn die Kopie schon erzeugt wurde. Nicht im Detail geprüft, welche Tabellen mit Löschschutz versehen sind.
- **Risiko:** hoch bei Löschungen, niedrig bei reinen Beschriftungen.

### 14. Sonstiges (kleine Abhängigkeiten)

- **Projektkosten Knetung:** `src/pages/ProjectDetailPage.tsx` filtert in einer Auswertung Dienstleistungen, deren Name „knetung" enthält (die Kosten selbst kommen aus `useProjectKnetungMaterials`, nicht vom Namen). Wird die Dienstleistung umbenannt, fehlt sie in dieser Auswertung. Risiko niedrig.
- **Gefahrstoffe:** `src/lib/hazardClasses.ts` (feste Klassenliste), Empfänger über `hazard_notification_recipients`.
- **Etiketten:** `label_templates` und Firmendaten (`company_settings`) werden gelesen. Etikettenvorlagen sind unabhängig vom Ergebnisschema.
- **Prüfmittel, Arbeitsplätze, Kostenarten:** rein verwaltend, keine Auswirkung auf Ergebnisse.

## Nicht erfasst / Grenzen

- Datenbankfunktionen und Trigger sind hier nur genannt, wo sie an Formular- oder Dienstleistungsnamen hängen. Eine vollständige Prüfung aller Funktionen steht aus.
- Diese Liste ersetzt keinen Test. Bei Zweifel Beispiel-Daten im Dev-System prüfen.
- **Pflege:** Wer Code ändert, der an Konfiguration hängt, ergänzt diese Datei im selben Branch (Regel in `CLAUDE.md`).
