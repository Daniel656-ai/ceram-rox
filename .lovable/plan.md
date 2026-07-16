
## Ziel

Die Ketten-Architektur `Formular → Dienstleistung → Prozess → Workflow-Vorlage → Auftrag (Instanz)` einführen — **rein additiv**, ohne bestehende Tabellen, Designer oder Bibliotheken zu ersetzen oder umzubauen.

Der Service Designer bleibt zentrale Verwaltungsoberfläche. Neu ist:
1. **Zuordnung Formular ↔ Dienstleistung** (M:N)
2. **Zuordnung Dienstleistung ↔ Prozess** (M:N, geordnet)
3. **Zuordnung Prozess ↔ Workflow-Vorlage** (M:N, geordnet)
4. **Auftrags-Assistent**: Prozesse auswählen → Auftrag wird zur Workflow-Instanz mit eigenständiger Prozess-/Dienstleistungs-/Formular-Struktur
5. **Runtime-Ansicht** je Auftrag mit hierarchischer Struktur (Prozess → Dienstleistung → Formular)

## Was bleibt unverändert

- `form_definitions`, `form_fields`, `form_role_views`, `form_field_permissions` (Formularbibliothek)
- `FormLayoutDesigner`, `RoleViewsDesigner`, `WorkflowStepsDesigner`
- `measurement_services` (Dienstleistungsbibliothek), `service_data_fields`, `service_form_layouts`
- `process_templates`, `process_steps` (bestehender Prozess-Designer bleibt für form-basierte Prozesse funktionsfähig)
- `workflow_templates`, `workflow_template_steps` (bestehender ROX-Workflow-Designer bleibt)
- `measurement_orders`, `service_workflow_*` (Legacy-Workflow-Runtime)

Keine dieser Tabellen wird geändert oder entfernt.

## Neue Datenstruktur (nur additiv)

### Vorlagen (Templates)

| Tabelle | Zweck |
|---|---|
| `service_form_links` | (service_id, form_definition_id, order_index) — welche Formulare gehören zu einer Dienstleistung |
| `process_service_links` | (process_template_id, service_id, order_index) — welche Dienstleistungen enthält ein Prozess |
| `workflow_process_links` | (workflow_template_id, process_template_id, order_index) — welche Prozesse enthält ein Workflow |

Alle mit Unique-Constraint auf (parent, child), `ON DELETE CASCADE` zum Parent, `ON DELETE RESTRICT` zum Child (Vorlagen bleiben geschützt).

### Instanzen (Auftrag)

| Tabelle | Zweck |
|---|---|
| `order_processes` | Prozess-Instanz je Auftrag (order_id, process_template_id, name, order_index, status) |
| `order_process_services` | Dienstleistungs-Instanz je Prozess-Instanz (service_id, name, order_index, status, assigned_role, assigned_to) |
| `order_service_forms` | Formular-Instanz je Dienstleistungs-Instanz (form_definition_id, response_data JSONB, completed_at, completed_by, role_view_key) |

Instanzen enthalten Snapshots (Namen), damit nachträgliche Änderungen an Vorlagen bestehende Aufträge nicht verändern. Beim Erzeugen: rekursive Kopie der ausgewählten Prozesse.

RLS: `authenticated` darf lesen (join über `measurement_orders`), Erstellen/Ändern über has_role/has_permission wie bestehende Order-Tabellen.

## UI-Erweiterungen

### Service Designer — neue Tabs / Bereiche

- **Dienstleistungs-Detail** (AdminServicesPage): neuer Tab „Formulare" — Formulare aus der Formularbibliothek per Multi-Select zuordnen, Reihenfolge sortieren, entfernen (Zuordnung, nicht Formular).
- **Prozess-Detail** (`AdminServiceDesignerPage`, Prozessvorlage): neuer Tab „Dienstleistungen" — geordnete Liste von Dienstleistungs-Referenzen mit Drag-to-reorder. Bestehender „Prozessschritte"-Tab bleibt für rein form-basierte Prozesse.
- **Workflow-Vorlage** (neue Seite `/admin/workflow-designer` oder Tab in ROX): Prozesse aus der Prozessbibliothek referenzieren und ordnen. Bestehende `workflow_templates`/`workflow_template_steps` werden erweitert um `workflow_process_links`.

### Auftragserstellung (`CreateOrderPage`)

- Neuer optionaler Bereich: „Aus Workflow-Vorlage anlegen" ODER „Prozesse auswählen".
- Zeigt Checkbox-Liste der Prozesse (aus Workflow-Vorlage vorausgewählt, aber änderbar).
- Beim Speichern: `order_processes` + `_services` + `_forms` als Snapshots anlegen.

### Auftrags-Detailansicht (`OrderDetailPage`)

- Neuer Tab „Workflow" mit hierarchischer Baum-Ansicht Prozess → Dienstleistung → Formular.
- Klick auf Formular öffnet den bestehenden `FormLayoutRenderer` mit rollenbasierten Ansichten und Berechtigungen — nutzt die vorhandene Runtime.
- Status pro Ebene (offen / in Arbeit / abgeschlossen), automatischer Rollup wie bereits im System.

## Technische Umsetzung

```text
Migration
├── Tabellen (6): service_form_links, process_service_links, workflow_process_links,
│                  order_processes, order_process_services, order_service_forms
├── GRANTS + RLS je Tabelle
├── Trigger updated_at
└── RPC: create_order_workflow_instance(order_id, process_template_ids[])
        → kopiert Vorlagen rekursiv als Instanzen mit Snapshots

API-Module (src/lib/api)
├── serviceFormLinks.ts     — M:N Formular ↔ Dienstleistung
├── processServiceLinks.ts  — M:N Dienstleistung ↔ Prozess
├── workflowProcessLinks.ts — M:N Prozess ↔ Workflow
└── orderWorkflow.ts        — Lesen/Ändern der Instanz-Struktur

UI-Komponenten (src/components)
├── ServiceDesigner/ServiceFormsTab.tsx      — Formulare je Dienstleistung
├── ServiceDesigner/ProcessServicesTab.tsx   — Dienstleistungen je Prozess
├── WorkflowDesigner/WorkflowProcessesTab.tsx— Prozesse je Workflow
├── Orders/ProcessSelectionStep.tsx          — Checkbox-Auswahl im Auftragswizard
└── Orders/OrderWorkflowRuntime.tsx          — Runtime-Baum + Formularöffner

Integrationspunkte (bestehende Dateien, minimale Änderungen)
├── AdminServicesPage.tsx        — Tab „Formulare" ergänzen
├── AdminServiceDesignerPage.tsx — Tab „Dienstleistungen" für Prozessvorlage
├── CreateOrderPage.tsx          — Optionaler Workflow-Wizard-Schritt
└── OrderDetailPage.tsx          — Tab „Workflow"
```

## Wiederverwendbarkeit (garantiert)

- Ein Formular kann in beliebig vielen Dienstleistungen verlinkt sein (`service_form_links`, UK auf Paar)
- Eine Dienstleistung kann in beliebig vielen Prozessen liegen
- Ein Prozess kann in beliebig vielen Workflow-Vorlagen liegen
- Instanzen sind eigenständige Snapshots → spätere Vorlagenänderungen berühren laufende Aufträge nicht

## Was in dieser Iteration NICHT enthalten ist

- Migration bestehender `process_steps` (form_id direkt) in die neue Dreischicht — bleibt parallel funktionsfähig
- Migration bestehender Aufträge — neue Struktur greift nur für neu angelegte Aufträge, die einen Workflow/Prozesse wählen
- Automatische Konvertierung Legacy `service_workflow_definitions` → neue `workflow_process_links`

Beides kann später ohne Bruch nachgezogen werden.
