
# Ausbau „Mischungen & Lösungen" zum vollständigen Produktionsmanagement

Das ist ein sehr umfangreicher Ausbau (≈ 10 neue Tabellen, viele neue UIs, GMP-konforme Dokumentation). Ich empfehle eine **stufenweise Umsetzung** in 5 Phasen, damit du nach jeder Phase ein funktionierendes System hast und Feedback geben kannst, bevor die nächste startet.

## Phase 1 — Rezepturversionen & Prozessstruktur (Datenmodell + UI)

**Datenbank (neue Tabellen):**
- `mixture_recipe_versions` — versionierte Rezepturen (`version_no`, `is_active`, `created_by`, `notes`); bestehende `mixture_recipe_items` bekommt `recipe_version_id`
- `mixture_process_sections` — Prozessabschnitte (Name, Beschreibung, `sort_order`, `planned_duration_min`, `target_temperature`, `target_unit`, `remarks`)
- `mixture_process_steps` — zeitgesteuerte Rohstoffzugaben & Aktionen (`section_id`, `raw_material_id` nullable, `planned_quantity`, `unit`, `offset_minutes`, `window_minutes`, `sort_order`, `instruction`)
- `mixture_planned_measurements` — geplante Prozessmessungen je Abschnitt (`parameter_name`, `unit`, `target_value`, `tolerance`, `offset_minutes`)

**UI:**
- `MixtureDetailPage` → neuer Tab **„Prozess"** mit Sections-Editor (drag-sort), pro Section editierbare Steps & Plan-Messwerte
- Versionswahl + „Neue Version erstellen" Button im Rezeptur-Tab
- **Rohstoffverfügbarkeits-Check** in Rezeptur-Anzeige: rote Warnung + Fehlmenge wenn Bestand < Bedarf; Rezeptur-Status-Badge „nicht vollständig produzierbar"

## Phase 2 — Chargenausführung mit Verwiegeprotokoll

**Datenbank:**
- `mixture_batches` erweitern: `recipe_version_id`, `status` (`geplant`|`laufend`|`abgeschlossen`|`abgebrochen`|`freigegeben`), `started_at`, `ended_at`, `released_at`, `released_by`
- `mixture_batch_weighings` — Verwiegeprotokoll (`batch_id`, `step_id`, `raw_material_id`, `raw_material_batch_id`, `target_quantity`, `actual_quantity`, `deviation_abs`, `deviation_pct` generated, `weighed_at`, `weighed_by`, `notes`)
- `mixture_batch_measurements` — erfasste Prozessmesswerte (`batch_id`, `section_id`, `parameter_name`, `target_value`, `actual_value`, `unit`, `measured_at`, `measured_by`, `comment`)
- `mixture_batch_deviations` — Prozessabweichungen (`batch_id`, `kind` enum: `time`|`quantity`|`additional_raw`|`process`, `old_value`, `new_value`, `reason`, `created_by`, `created_at`)

**RPC:**
- `start_mixture_batch(batch_id)` — prüft Verfügbarkeit, setzt Status `laufend`
- `record_weighing(...)` — bucht Rohstoff aus Lager, schreibt Verwiegeposition
- `complete_mixture_batch(batch_id)` — Endzeit, sperrt Bearbeitung
- `release_mixture_batch(batch_id)` — Freigabe durch berechtigten User

**UI:**
- Neuer Reiter **„Charge ausführen"** in `MixtureDetailPage` mit Timeline-View, Step-by-Step Wizard
- Pro Step: Soll/Ist-Eingabe, Chargen-Auswahl Rohstoff, Ampel (grün ±2%, gelb ±5%, rot >5%)
- Messwert-Eingabe-Panel pro Abschnitt
- Button „Abweichung dokumentieren" (Dialog: Typ, alter/neuer Wert, Grund)

## Phase 3 — Dashboards & Verfügbarkeits-Vorabprüfung

- `MixturesDashboardPage` (`/mischungen/dashboard`) mit:
  - Offene/laufende Chargen
  - Fehlende Rohstoffe (Aggregat über alle laufenden+geplanten Chargen)
  - Offene Proben & Dienstleistungen
- Dialog „Charge anlegen": prüft erneut Verfügbarkeit, zeigt Fehlmengen, erlaubt „Abbrechen" oder „Mit Abweichung starten" (Pflicht-Begründung wird als Deviation gespeichert)

## Phase 4 — Elektronisches Herstellungsprotokoll (PDF)

- View `vw_batch_production_record` aggregiert alle Daten
- Edge Function `generate-batch-record` mit Deno + `pdf-lib` erstellt GMP-konformes PDF (Rezepturdaten, Verwiegeprotokoll, Messwerte, Abweichungen, Freigabe, Signatur-Block)
- Bildschirm-, Druck- und PDF-Ansicht
- Archivierung in Storage-Bucket `batch-records`

## Phase 5 — Proben & Dienstleistungen

- `samples` erweitern: `sample_kind` enum (`rueckstell`|`labor`|`kunde`|`stabilitaet`), `sampling_location`, `quantity`, `unit` (teilweise bereits vorhanden via `sampled_at`/`sampled_by`)
- Neue Tabelle `sample_services` — gebuchte Dienstleistungen pro Probe (`sample_id`, `service_id` → bestehende `measurement_services`, `status`, `assignee`, `due_date`, `result_value`, `result_unit`, `result_text`)
- UI in `SampleDetailPage`: Reiter „Dienstleistungen" mit Add/Track
- Verknüpfung mit bestehendem Messsystem (`order_measurements`) für Ergebnisse & Dokumente

## Technische Hinweise

- Alle neuen Tabellen: RLS aktiv, GRANTs für `authenticated` + `service_role`, Policies via `has_permission('raw_materials.manage')` oder `master`-Rolle
- Komplette Audit-Trail via bestehendes `activity_log` + neuer Tabelle `mixture_batch_deviations`
- i18n DE/EN in `mixtures.json` erweitern
- API-Schicht strikt über `src/lib/api/mixtures*.ts` — kein direkter Supabase-Call in Komponenten

## Vorschlag

**Ich starte mit Phase 1 + 2 zusammen**, weil sie das fachliche Kernstück sind (versionierte Rezeptur + ausführbare Charge mit Verwiegeprotokoll). Phasen 3–5 baue ich danach iterativ.

## Fragen vor Start

1. **Soll Phase 1 + 2 jetzt vollständig umgesetzt werden** (groß, ~15 Dateien, eine Migration), oder zuerst nur Phase 1 (Rezepturversionen + Prozessstruktur), damit du das Datenmodell vorab prüfen kannst?
2. **Toleranzschwellen Ampel** (grün/gelb/rot bei Verwiegung): Default ±2 % / ±5 % oder pro Rohstoff/Rezeptur konfigurierbar?
3. **Freigabe-Workflow**: reicht „4-Augen-Prinzip" (Hersteller ≠ Freigeber, beide mit `raw_materials.manage`), oder soll ich eine eigene Permission `mixtures.release` einführen?
4. **PDF-Protokoll** (Phase 4): Standardlayout in Lovable bauen, oder hast du eine Vorlage (Logo, Felder, Reihenfolge)?
