# Architektur-Refactoring: Ceram ROX Prozess- & Service Designer

## Zielbild

Ein einziger Service/Prozess-Designer, der sowohl **Labor-Dienstleistungen** (geräte-/methodenorientiert) als auch **Pilot-Plant-Prozessschritte** modelliert. Kein zweites Modul, keine parallele Codebasis. Fachliche Unterscheidung erfolgt ausschließlich über einen `process_kind` und wiederverwendbare Vorlagen.

Da noch keine produktiven Aufträge existieren, werden die parallel gewachsenen Strukturen (`service_workflows`, `service_workflow_definitions`, `pilot_plant_blocks`, `order_workflow_tasks`, `service_data_fields`, `service_forms`) auf **eine kanonische Datenstruktur** konsolidiert. Legacy-Tabellen werden migriert und anschließend entfernt.

## Kanonische Datenstruktur (Phase 1)

Neue, gemeinsame Basistabellen — ersetzen mittelfristig alle Sonderwege:

```text
process_templates          (Vorlage: "Labor-Service" ODER "Pilot-Plant-Prozess")
 ├─ kind: 'labor' | 'pilot_plant'
 ├─ category, version, is_active
 └─ metadata

process_steps              (Ein Schritt = 1 Formular + 1 Rolle + Regeln)
 ├─ template_id
 ├─ order_index, step_key, name
 ├─ role_required / assignee_rule
 ├─ form_id (→ form_definitions)
 ├─ is_mandatory, condition_expr
 ├─ auto_actions (jsonb: create_samples, create_lab_orders, notify, ...)
 └─ due_hours, escalation_role

form_definitions           (Ein Formular = wiederverwendbar über Steps hinweg)
 ├─ name, scope ('global' | 'template')
 ├─ schema (fields[])
 └─ layout

form_fields                (Normalisiert für Query-Zugriff & Validierung)
 ├─ form_id, field_key, label, type, unit
 ├─ is_required, validation, default_value
 ├─ formula (computed), select_options
 └─ sort_order, parent_field_id (repeater)

order_instances            (Ein Auftrag = 1 Instanz, egal ob Labor/PP/kombiniert)
 ├─ template_id, order_number
 ├─ project_id, sample_ids[], created_by
 ├─ status, workflow_status
 ├─ shared_data (jsonb — DIE zentrale Datenquelle)
 └─ locked_at

order_step_runs            (Ein Task = konkrete Ausführung eines Steps)
 ├─ order_id, step_id, order_index
 ├─ status, assigned_to, opened_at, completed_at
 ├─ form_response (jsonb — wird in shared_data gemerged)
 ├─ time_minutes (auto aus opened→completed)
 └─ notes

order_step_positions       (Positionsbasierte Ergebnisse: pro Probe/Mundstück/…)
 ├─ step_run_id, position_ref, label
 ├─ status: open | in_progress | completed | not_feasible
 ├─ result_value, remarks, not_feasible_reason
 └─ completed_by, completed_at
```

**Zentrale Regel:** `order_instances.shared_data` ist die _einzige_ persistente Datenschicht des Auftrags. Jeder abgeschlossene `order_step_run` mergt sein `form_response` per Trigger in `shared_data` unter einem step-key-Namespace. Folgeschritte lesen von dort → jedes Datum wird nur einmal erfasst.

## Gemeinsame Workflow-Engine (Phase 2)

Eine einzige Engine — keine Sonderfälle für Labor vs. Pilot Plant.

Kern-RPCs:

- `wf_seed_from_template(order_id, template_id)` — erzeugt `order_step_runs`.
- `wf_start_step(step_run_id)` — Status `in_progress`, `opened_at=now()`.
- `wf_complete_step(step_run_id, response, notes)` — validiert Pflichtfelder & Positionen, mergt in `shared_data`, erstellt `project_time_entries`, führt `auto_actions` aus (z.B. Sample-/Lab-Order-Erzeugung), prüft Instanz-Vollständigkeit.
- `wf_finalize_order(order_id)` — automatischer Abschluss + Lock, wenn alle Steps `completed` und alle Positionen entweder `completed` oder `not_feasible` mit Begründung.

Ein zentraler Trigger `trg_lock_on_finalize` sperrt `order_instances` und alle abhängigen Tabellen (Bypass nur via `app.bypass_order_lock` für die Engine selbst).

Rollen, Berechtigungen (`has_role`), Kompetenzmatrix (`mdl_service_permissions`), Benachrichtigungen und Arbeitszeiterfassung greifen über einen einzigen Code-Pfad — unabhängig vom `kind`.

## Service Designer UI-Erweiterung (Phase 3)

Ein Designer, zwei Modi (nur UI-Unterschied):

- **Modus „Labor"**: Steps zeigen Felder wie Prüfmethode, Gerät, Prüfparameter. Typischerweise 1–2 Steps.
- **Modus „Pilot Plant"**: Steps sind Prozessbausteine (Knetung, Extrusion, …), üblicherweise 5–10. Palette wiederverwendbarer Bausteine ("Prozess-Snippets") aus `process_templates` mit `scope='snippet'`.

Gemeinsam nutzbar: Formular-Editor, Feldtypen (inkl. `computed`, `handwriting`, `repeater`, Upload), Formel-Engine, Rollen-/Berechtigungs-Selector, Validierung, Vorschau.

## Wiederverwendbare Vorlagen (Phase 4)

- `form_definitions.scope='global'` → globale Formularbibliothek (z.B. „Standard-Bediener + Bemerkung").
- `process_templates.scope='snippet'` → Prozess-Snippets, per Drag&Drop in andere Templates einfügbar.
- Versionierung über `process_templates.version` + `is_active`. Bestehende Aufträge bleiben an ihre Snapshot-Version gebunden (Referenz in `order_instances.template_snapshot`).

## Laufzettel, Protokolle, Berichte (Phase 5)

- **Laufzettel** = generierte Ansicht aus `shared_data` + `order_step_runs` (kein separater Datentopf).
- **Prozessprotokoll** = chronologische Sicht auf `order_step_runs` + `activity_log`.
- **Ergebnisbericht** = konfigurierbar über `report_templates` (bereits vorhanden), mit Bindings auf `shared_data`-Pfade. Auto-Draft beim Abschluss.

## Migration von Bestandsstrukturen

Da keine produktiven Aufträge existieren, wird konsolidiert statt parallelisiert:

| Alt                                         | Neu                                    |
|---------------------------------------------|----------------------------------------|
| `measurement_services` (labor)              | `process_templates` (kind=labor)       |
| `service_workflow_definitions` + `_steps`   | `process_templates` + `process_steps`  |
| `pilot_plant_blocks`                        | `order_step_runs` (kind=pilot_plant)   |
| `service_data_fields`, `service_forms`      | `form_definitions` + `form_fields`     |
| `measurement_orders`                        | `order_instances`                      |
| `order_measurements`                        | `order_step_runs` (mit Position-Rows)  |
| `order_workflow_tasks/positions`            | `order_step_runs/positions`            |
| `pilot_plant_produced_samples`              | `auto_actions` in Step (kein neuer Typ)|

Alt-Tabellen werden per Migration umgezogen, dann in einem Cleanup-Sprint entfernt. API-Layer (`src/lib/api/*`) wird auf die neuen Namen umgestellt; UI konsumiert nur noch die neuen Domains.

## Umsetzungsreihenfolge

1. **Datenschicht** (Migration): Neue Tabellen + GRANTs + RLS + Trigger für `shared_data`-Merge und Auto-Lock. Migrationsskripte für Alt→Neu.
2. **API-Layer**: Neue Module `processTemplates`, `formDefinitions`, `orderInstances`, `orderStepRuns`, `workflowEngine`. Alt-Module als Thin-Wrapper markieren (`@deprecated`), damit UI schrittweise migriert.
3. **Workflow-Engine**: RPCs `wf_seed_from_template`, `wf_start_step`, `wf_complete_step`, `wf_finalize_order` + `auto_actions`-Executor.
4. **Service Designer UI**: Ein Designer mit Modus-Umschalter, Formular-Editor auf neuer Basis, Snippet-Bibliothek.
5. **Auftrags-UI**: `CreateOrderPage` + `OrderWorkflowTabs` konsumieren `order_instances`; alte Pilot-Plant-Panels entfernt.
6. **Laufzettel & Reports**: Auto-Generierung aus `shared_data`, Bindings in Report-Templates auf neue Pfade umstellen.
7. **Cleanup**: Legacy-Tabellen dropen, Code aus `src/lib/api/*` und Komponenten entfernen.

## Technische Leitplanken

- Alle Datenzugriffe ausschließlich über `src/lib/api/*` (ESLint-Regel bleibt scharf).
- Keine CHECK-Constraints für zeitabhängige Regeln → Trigger.
- Jede neue `public`-Tabelle: `CREATE TABLE` → `GRANT` (authenticated + service_role) → `ENABLE RLS` → Policies.
- RLS-Policies gehen konsequent über `has_role(auth.uid(), …)` — keine rekursiven Selects.
- `shared_data` niemals aus dem Client direkt schreiben; nur über `wf_complete_step`.
- Sperrmechanismus (`is_order_locked`) bleibt zentral in einer Funktion + Triggern auf allen abhängigen Tabellen.

## Aufwandseinschätzung

Phase 1–3 sind die eigentliche Architekturarbeit (~ groß). Phase 4–7 sind überwiegend UI-Umstellung und Cleanup auf der bereits stabilen neuen Basis.

## Offene Entscheidungen vor Start

1. **Big-Bang oder Migration in Etappen?** Ich empfehle Big-Bang, da noch keine Produktivdaten existieren — sauberer Cut, keine Zombie-Tabellen.
2. **Umbenennung `measurement_orders` → `order_instances` durchziehen?** Empfohlen (verhindert Verwirrung Labor↔PP). Alternative: Tabelle behalten, nur Semantik erweitern.
3. **Sollen `service_data_fields` in `form_fields` überführt werden, oder bleibt `form_definitions.schema` (jsonb) alleinige Wahrheit?** Empfehlung: normalisierte `form_fields` — bessere Query- und Validierungsleistung, saubere FKs für Berechnungen.

Sag mir, ob ich mit Big-Bang starte und ob die drei offenen Punkte oben nach meiner Empfehlung entschieden werden — dann lege ich mit der Migration von Phase 1 los.
