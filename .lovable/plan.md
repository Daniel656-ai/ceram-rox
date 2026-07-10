# Umbau Service Designer → Workflow- & Prozessdesigner

Das ist ein architektureller Großumbau, der ROX vom formularzentrierten zum prozesszentrierten Modell verschiebt. Ich schlage vor, in **vier klar abgetrennten Phasen** vorzugehen, damit bestehende Dienstleistungen, Aufträge und Auswertungen jederzeit lauffähig bleiben. Jede Phase ist eigenständig auslieferbar.

Bitte prüfen und bestätigen — oder mir sagen, welche Phase zuerst umgesetzt werden soll.

---

## Phase 1 – Fundament: getrennte Workflow- & Formular-Architektur

Ziel: Datenmodell und Admin-UI so entkoppeln, dass Prozess und Formular voneinander unabhängig existieren. Keine Änderung am bestehenden Auftragslauf.

**Datenbank (neu)**
- `service_workflow_definitions` — pro Service ein aktueller Workflow (versioniert).
- `service_workflow_steps` — Schritte mit Feldern: name, description, role_required, assignee_user_id, form_id (nullable), is_mandatory, order_index, condition_expr (jsonb), due_hours, escalation_role, auto_actions (jsonb), notify_config (jsonb).
- `service_forms` — Formular als eigenständige Entität (heute in `service_data_fields`/`service_form_layouts` verstreut).
- `order_workflow_instances` — pro Auftrag/Messung eine laufende Workflow-Instanz.
- `order_workflow_tasks` — konkrete Aufgabe pro Schritt (assigned_to, status, opened_at, completed_at, form_response_id).

Alle Tabellen mit RLS + GRANT nach Standardmuster (auftraggeber/durchfuehrer/master + PMO).

**Migration bestehender Services**
- Skript legt für jeden bestehenden Service einen Default-Workflow an: `Auftraggeberformular → Messdienstleisterformular → Ergebnisbericht`.
- Bestehende `service_data_fields` werden in `service_forms` gruppiert (Auftraggeber-, Messdienstleister-Formular). Keine Datenlöschung, alte Tabellen bleiben lesbar erhalten.
- Bestehende offene Aufträge bekommen automatisch eine `order_workflow_instances`-Zeile im passenden Schritt (basierend auf `status`).

**Admin-UI**
- `AdminServiceDesignerPage` wird in zwei Tabs geteilt:
  - **Workflow** (neuer grafischer Designer, siehe Phase 2)
  - **Formulare** (bestehender `FormDesigner`, aber pro Formular statt pro Service)
- Formulare sind service-übergreifend wiederverwendbar (z. B. „Standard-Auftraggeberformular").

---

## Phase 2 – Grafischer Workflow Designer

Ziel: Admin baut Prozesse per Drag & Drop.

- Neue Komponente `WorkflowCanvas` auf Basis von **React Flow** (`@xyflow/react`, bereits leichtgewichtig, MIT-Lizenz).
- Node-Typen: Start, Formular-Schritt, Freigabe, Bedingung (if/else), Automatische Aktion, Ende.
- Rechte Seitenleiste = Schritt-Eigenschaften (alle Felder aus der Anforderung: Rolle, Benutzer, Formular-Auswahl, Pflicht ja/nein, Frist, Eskalation, Benachrichtigung, Folgeaktion, Bedingung).
- Verbindungen definieren Reihenfolge; bedingte Kanten aus Bedingungsknoten.
- Speichern versioniert den Workflow (analog zu `service_versions`); aktive Aufträge laufen auf ihrer eingefrorenen Version weiter.

---

## Phase 3 – Runtime & „Meine Aufgaben" automatisch

Ziel: Aufgabe = reiner Workflow-Schritt, öffnet automatisch das richtige Formular.

- Neuer Datenbank-Trigger: bei Abschluss einer `order_workflow_tasks` wird der nächste Schritt gestartet (unter Beachtung der Bedingungen), passende `order_workflow_tasks` werden erzeugt, Benachrichtigungen versendet.
- „Meine Aufgaben" (`OrdersPage` Durchführer-View) zeigt statt Messungen künftig `order_workflow_tasks`.
- Klick auf Aufgabe → Route `/aufgaben/:taskId` lädt den Task, resolved `form_id` und rendert dynamisch:
  - `LiveFormRenderer` (aus bestehender `LiveReportRenderer`-Logik weiterentwickelt) — zeigt Auftrag/Projekt/Probendaten schreibgeschützt oben, Eingabefelder darunter.
- Nach Speichern: Task-Status → `completed`, Runtime-Trigger triggert Folgeschritt.
- Bestehende Route `/aufgaben/:measurementId` bleibt als Fallback für nicht migrierte Messungen erhalten.

**Auto-Aktionen (v1)**
- „Nächster Schritt", „Benachrichtigung an Rolle X", „Status setzen", „Ergebnisbericht aktualisieren", „Auftrag abschließen". Weitere Aktionen (PDF, E-Mail, Archivierung) folgen in Phase 4.

---

## Phase 4 – Ergebnisbericht & Automatisierungen erweitern

Ziel: Ergebnisbericht wird zum reinen Aggregations-Dokument, keine Doppelerfassung.

- `LiveReportRenderer` wird an das neue Formular-/Workflow-Modell angebunden.
- Bindings verweisen direkt auf: `order`, `project`, `sample`, `form_response(form_id, field_key)` — Single Source of Truth.
- Benutzer erfasst nur noch Interpretation/Bewertung/Empfehlung.
- Zusätzliche Auto-Aktionen: E-Mail per Edge Function, PDF-Erzeugung, Dokumentenarchivierung.
- Eskalations-Cron: überfällige Tasks → Benachrichtigung an Eskalations-Rolle.

---

## Technischer Rahmen

- Alles nur über `src/lib/api/*` — kein direkter Supabase-Zugriff aus UI (Projektregel).
- Rückwärtskompatibilität: alte Tabellen (`measurement_orders`, `order_measurements`, `service_data_fields`, `service_form_layouts`) bleiben lesbar und schreibbar; Runtime bevorzugt neue Tabellen, fällt sonst auf alte zurück.
- i18n DE/EN von Anfang an.
- Keine Löschung, keine Zerstörung historischer Auftragsdaten.

---

## Umfang & Aufwand (Einschätzung)

| Phase | Umfang | Neue Tabellen | Neue Komponenten |
|---|---|---|---|
| 1 – Fundament | Groß | 5 | 2 (Split-Tabs, FormLibrary) |
| 2 – Canvas Designer | Groß | 0 | 4 (Canvas, Node-Typen, Sidebar) |
| 3 – Runtime | Mittel | 0 | 2 (LiveFormRenderer, TaskPage-Rewrite) |
| 4 – Berichte/Automation | Mittel | 0 | 3 (Aktions-Engine, Cron, E-Mail-EF) |

Umsetzung in einem Durchgang ist möglich, aber riskant für laufende Aufträge. Ich empfehle klar **Phase-für-Phase mit Zwischenabnahme**.

---

## Rückfragen an dich

1. **Reihenfolge**: Fange ich mit **Phase 1** (Fundament + Migration) an? Oder willst du zuerst den **grafischen Designer** (Phase 2) sehen, auch wenn die Runtime dann noch die alte bleibt?
2. **Formulare wiederverwendbar**: Sollen Formulare service-übergreifend nutzbar sein (z. B. ein globales „Auftraggeberformular"), oder bleiben sie 1:1 an einen Service gebunden?
3. **React Flow OK**: Für den grafischen Designer würde ich `@xyflow/react` einsetzen (leichtgewichtig, ~40 KB gz). Einverstanden?
4. **Alte „Messungen"-Ansicht**: Soll die klassische Messungs-Ansicht während der Übergangszeit parallel bestehen bleiben, oder direkt durch die Workflow-Aufgaben-Ansicht ersetzt werden?
