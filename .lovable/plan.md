
# Gemeinsamer Workflow: Pilot Plant + Labor in einem Auftrag

Ziel: Ein Auftrag deckt den kompletten Lebenszyklus ab – von der Pilot-Plant-Planung über Probenerzeugung bis zur Laboranalyse und Freigabe. Kein zweites Auftragssystem, keine Datenkopien.

## 1. Datenmodell (Erweiterung, keine Migration von Altdaten)

Neue Enums:
- `order_kind`: `pilot_plant | labor | combined | legacy` (bestehende Aufträge = `legacy`, Default für neue = `labor`)
- `masse_type`: `DK | GK | KK | MK | PK`
- `workflow_status`: `entwurf | geplant | pp_in_progress | pp_completed | samples_created | waiting_analysis | analysis_in_progress | results_complete | abgeschlossen`
  (existierender `status` bleibt für Rückwärtskompatibilität bestehen; `workflow_status` läuft parallel und ist die neue Führungsgröße.)

`measurement_orders` – neue Spalten:
- `order_kind order_kind NOT NULL DEFAULT 'legacy'`
- `workflow_status workflow_status` (nullable → nur für neue Aufträge)
- Pilot-Plant-Felder: `pp_experiment_number text`, `pp_v2o5_percent numeric`, `pp_experiment_date date`, `pp_issuer_user_id uuid`, `pp_previous_experiments text`, `pp_experiment_kind text`, `pp_masse_type masse_type`, `pp_remarks text`

Neue Tabelle `order_analysis_requests` (Analyseanforderungen-Pool auf Auftragsebene, vor Probenerzeugung):
- `id`, `order_id → measurement_orders`, `service_id → measurement_services`, `quantity int DEFAULT 1`, `notes text`, `created_at`, `created_by`
- Zuordnung zu Proben erfolgt später über einen neuen Nullable-FK auf `order_measurements.analysis_request_id`. Damit bleiben bestehende `order_measurements` unberührt; neue Analysen können frei oder aus einer Anforderung heraus entstehen.

`samples` bleibt unverändert. Verknüpfung zum Auftrag existiert bereits über `measurement_orders.sample_id` — zusätzlich wird ein optionaler Rückweg genutzt: neue Proben, die im Auftrag erzeugt werden, tragen `samples.order_id` (neue Nullable-Spalte) und behalten ihre reguläre `PYY####`-Nummer. Bestehende Sample-Logik bleibt unverändert.

Statusautomat (Trigger auf `order_measurements` + `samples` + `order_analysis_requests`):
- Erste PP-Felder gesetzt → `pp_in_progress`
- `pp_experiment_date` gesetzt → `pp_completed`
- ≥1 Sample mit `order_id` → `samples_created`
- ≥1 offene, an Sample zugeordnete Analyse → `waiting_analysis`
- ≥1 `order_measurements.status='in_progress'` → `analysis_in_progress`
- Alle zugeordneten Analysen `completed` → `results_complete`
- Manuell abschließbar → `abgeschlossen`
- Manuelles Setzen bleibt jederzeit möglich (Master + berechtigte Rollen)

Alle neuen Tabellen erhalten GRANTs + RLS analog zu bestehenden Auftragstabellen.

## 2. Backend / API

Neue Domain-Module in `src/lib/api/`:
- `orderAnalysisRequests.ts` – list/create/update/delete + `assignToSample(requestId, sampleId)` (legt daraus `order_measurements` an)
- Erweiterung `orders.ts`: Pilot-Plant-Felder in `create`/`update`, `updateWorkflowStatus`
- Erweiterung `samples.ts`: `createForOrder(orderId, …)` – reuse bestehender Logik, setzt `order_id`

RPC/SECURITY DEFINER:
- `assign_analysis_request_to_sample(_request_id, _sample_id)` – erzeugt `order_measurements` mit `service_id` aus Anforderung und `analysis_request_id`
- `recompute_order_workflow_status(_order_id)` – wird von Triggern und manuell aufgerufen

## 3. Frontend

`CreateOrderPage.tsx`: neues Pflichtfeld **Auftragsart**. Je nach Auswahl werden zusätzliche Abschnitte eingeblendet:
- Pilot Plant → PP-Felder + optionale Standardanalysen (Pool)
- Labor → aktuelle Maske (unverändert)
- Kombiniert → beides

`OrderDetailPage.tsx` bekommt Tabs (nur wenn `order_kind != 'legacy'`):
1. **Allgemein** – bestehende Kopfdaten
2. **Pilot Plant** – PP-Felder editieren, Historie
3. **Proben** – Liste aller `samples` mit `order_id`, Anlegen weiterer Proben (`PP-###` als Anzeigename; Systemnummer bleibt `PYY####`)
4. **Analysen** – zwei Bereiche:
   - Anforderungen-Pool (noch nicht zugewiesen) mit „Probe zuweisen"-Aktion
   - Zugewiesene Analysen (bestehende `order_measurements`-Tabelle)
5. **Ergebnisse** – vorhandene Ergebnisanzeige aller Measurements des Auftrags
6. **Abschluss** – Workflow-Status-Steuerung, Freigabe, Abschluss

Legacy-Aufträge (`order_kind='legacy'`) zeigen weiterhin die bisherige Detailansicht ohne Tabs.

Neuer `WorkflowStatusBadge` mit i18n-Labels (DE/EN) analog `StatusBadge`.

## 4. Berechtigungen

- Auftragsart wählen, PP-Felder editieren, Anforderungen anlegen → `orders.create` / `orders.edit`
- Anforderung einer Probe zuweisen → `orders.edit` oder Zuweisung an eigene Probe
- Workflow-Status manuell setzen → Master oder `orders.edit`
- Keine Änderung an bestehenden Regeln für `order_measurements` / `samples`

## 5. i18n

Neue Keys in `orders.json` (DE/EN): Auftragsart, alle Statuswerte, Tab-Titel, PP-Feldlabels, Analysepool-Texte.

## 6. Technische Details

- Migration erstellt Enums, Spalten, Tabelle, GRANTs, RLS, Trigger, RPCs in **einer** Datei.
- `src/integrations/supabase/types.ts` wird nach Migration automatisch neu generiert; Code-Änderungen folgen danach.
- Alle Datenzugriffe ausschließlich über `src/lib/api/*` (bestehende Regel).
- Radix-Select-Werte verwenden `__none__` statt leerer Strings.
- Keine Änderung an `sample_id` auf `measurement_orders`; das Feld bleibt für Legacy-Aufträge relevant.

## 7. Umsetzungsreihenfolge

1. Migration (Enums, Spalten, `order_analysis_requests`, `samples.order_id`, `order_measurements.analysis_request_id`, RLS, Trigger, RPCs)
2. API-Layer (`orderAnalysisRequests`, Erweiterungen `orders`/`samples`)
3. i18n-Keys
4. `CreateOrderPage` – Auftragsart + PP-Sektion + Anforderungen-Pool
5. `OrderDetailPage` – Tabs-Grundgerüst + einzelne Tabs
6. `WorkflowStatusBadge` + Abschluss-Tab
7. Verifikation: Legacy-Auftrag unverändert, neuer Combined-Auftrag durchläuft alle Status.
