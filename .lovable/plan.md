# Umbau ROX: Workflow-orientierte Arbeitsobjekte

## Grundentscheidungen (bestätigt)
- `measurement_orders` bleibt die zentrale Tabelle und wird zum „Arbeitsobjekt". Alte `order_number` bleibt intern für Verrechnung/KPIs, neue `reference_number` wird UI-Hauptkennzeichnung.
- 7 Startursprünge (Pilot Plant, Produktion, QC, Labor, Reklamation, Entwicklung, Kundenauftrag), später im Admin erweiterbar.
- Kunde als Freitextfeld.
- Workflow-Vorlage wird primär über den **Ursprung** bestimmt, Servicepakete können die Vorlage ergänzen.
- Big-Bang-Umstellung der Benutzeroberfläche für alle Rollen — kein Feature-Flag pro User.

## Phase A: Datenbank-Fundament

Neue Spalten in `measurement_orders`:
- `reference_type` (enum: experiment, serial, batch, complaint, customer_ref, internal)
- `reference_number` (text, unique je Jahr/Origin)
- `origin` (text, verweist auf `work_object_origins.key`)
- `customer_name` (text, Freitext)

Neue Katalog-/Konfig-Tabellen:
- `work_object_origins` — pflegbarer Ursprungskatalog mit Default-Vorlage
- `reference_number_sequences` — Nummernkreise `(origin, reference_type, year)` mit `pattern` (z. B. `V{yy}-{seq:03}`)
- `workflow_templates` — benannte Vorlagen (Bezug zu Origin optional)
- `workflow_template_steps` — Schritte einer Vorlage (order_index, step_key, name, role_required, form_id, is_mandatory, condition_expr jsonb, due_hours)
- `service_package_workflow_map` — verknüpft Servicepaket mit Vorlage; Flag `requires_kneading`, `prepend_steps`, `append_steps`

Trigger `trg_bootstrap_workflow` (AFTER INSERT auf `measurement_orders`):
1. Vorlage bestimmen (explizit → Servicepaket-Map → Origin-Default)
2. Steps kopieren in `service_workflow_definitions` + `service_workflow_steps` (Auftrags-spezifisch)
3. Bei `requires_kneading = false` Steps `weighing` und `kneading` entfernen
4. `reference_number` aus Sequenz + Pattern generieren (falls leer)
5. `order_workflow_instance` + erste `order_workflow_tasks` anlegen

Backfill für bestehende Aufträge:
- `reference_type = 'experiment'`, `reference_number = pp_experiment_number ?? order_number`
- `origin` aus `order_kind` ableiten (`pilot_plant` → Pilot Plant, `labor` → Labor, `combined` → Pilot Plant)

Seed-Daten:
- 7 Origins mit deutschen/englischen Labels
- 2 Start-Vorlagen: „Pilot Plant Standardversuch" (Verwiegen → Kneten → Extrusion → Trocknung → Brennen → Probenerzeugung → Laborprüfungen → Bericht) und „Produktionsunterstützung" (ohne Verwiegen/Kneten)
- Nummernkreise für alle Origins

## Phase B: API-Fassade

Neues API-Modul `src/lib/api/workObjects.ts`:
- `list({ origin?, referenceType?, assignedToMe? })`
- `get(id)` — inkl. Workflow-Progress, Proben, Dokumente, Ergebnisse
- `myOpenTasks()` — `order_workflow_tasks` des angemeldeten Users, gruppiert nach Origin
- `openTask(taskId)` — lädt Task + gebundenes Formular
- `completeTask(taskId, response)` — schließt Task, aktiviert Nachfolger

Bestehende `api.orders.*`, `api.measurements.*`, `api.samples.*` bleiben unverändert erhalten.

Admin-API `src/lib/api/workflowConfig.ts`:
- CRUD für Origins, Vorlagen, Vorlagen-Schritte, Nummernkreise, Paket-Mapping

## Phase C: Neue Benutzeroberfläche (Big Bang)

Neue Seiten:
- `/arbeit` — Meine Arbeitsliste. Karten pro offener Task mit großer Referenznummer, Origin-Badge, Step-Name, Frist. Klick öffnet direkt Formular.
- `/arbeit/:id` — Arbeitsobjekt-Detail. Kopfzeile:
  ```text
  ┌──────────────────────────────────────────────────┐
  │ [Origin]  V25-043                    Status: ▶   │
  │           Pilot Plant Extrusion                   │
  │ Projekt · Auftraggeber · Kunde · Fortschritt: 3/8 │
  └──────────────────────────────────────────────────┘
  ```
  Darunter horizontaler Workflow-Stepper (Offen/In Bearbeitung/Erledigt) und Tabs „Proben", „Dokumente", „Ergebnisse", „Historie", „Arbeitsauftrag".

Umgestaltete Seiten:
- `OrdersPage` → wird zu „Arbeitsobjekte" (Filter nach Origin/Referenztyp, Referenznummer als primäre Spalte)
- `CreateOrderPage` → Auswahl Ursprung + Servicepaket bestimmt Workflow automatisch, keine manuelle Dienstleistungsauswahl mehr
- `Dashboard` → „Meine offenen Schritte" als Haupt-Widget
- Sidebar: neuer Menüpunkt „Meine Arbeit" oben; alte Dienstleistungs-Ansichten unter Admin

Neue Komponenten:
- `WorkObjectHeader` — Kopf mit großer Referenznummer
- `WorkflowProgress` — Stepper-Darstellung
- `TaskExecutionDialog` — öffnet Formular direkt
- `OriginBadge`

## Phase D: Admin-Bereich

Neue Admin-Seiten:
- `/admin/origins` — Ursprünge verwalten, Default-Vorlage zuweisen
- `/admin/workflow-templates` — Vorlagen und Schritte pflegen (Drag & Drop, Formular-Bindung)
- `/admin/reference-sequences` — Nummernkreise pflegen
- Erweiterung `AdminServicePackagesPage` um Reiter „Workflow-Verknüpfung" (Vorlage + Kneten-Flag + Zusatzschritte)

## Was unverändert bleibt

- `measurement_services`, `order_measurements`, `measurement_results` — Struktur und Verrechnung
- `service_packages`, `service_package_items` — nur Erweiterung durch Mapping-Tabelle
- Bestehende Berichte (`order_reports`), Report-Bindings
- Rollen/Permissions (`user_roles`, `has_role`)
- Ergebnisdatenbank, Auswertungen, KPIs
- Bestehende Auftragsnummern und PP-Felder

## Umsetzungsreihenfolge

1. **Migration A1** — Schema-Erweiterung `measurement_orders` + neue Katalogtabellen + Seeds + Backfill (kein Trigger aktiv)
2. **Migration A2** — Trigger + Sequenzfunktionen aktivieren
3. **API-Fassade** (`workObjects`, `workflowConfig`)
4. **Neue UI-Komponenten** (Header, Progress, Task-Dialog)
5. **Neue Seiten** `/arbeit`, `/arbeit/:id`
6. **Umbau bestehender Seiten** (Orders, CreateOrder, Dashboard, Sidebar)
7. **Admin-Seiten** für Origins/Vorlagen/Sequenzen
8. **Cleanup**: Alte „Meine Aufgaben"-Ansicht deaktivieren, i18n-Strings aktualisieren

## Risiken & Absicherung

- **Backfill bricht Verrechnungsauswertungen** → `order_number` bleibt unverändert; nur Anzeige-Priorität wechselt
- **Trigger-Fehler blockiert Auftragsanlage** → Trigger als `SECURITY DEFINER` mit Exception-Handling; bei Fehler Fallback auf leere Instanz + Log
- **Bestehende Aufträge ohne Workflow-Instanz** → Backfill legt für alle offenen Aufträge eine Instanz aus Default-Vorlage an
- **RLS** → neue Tabellen erhalten `GRANT` + Policies für `authenticated` (lesen) und `master` (schreiben)

## Umfang

Diese Umstellung ist groß (geschätzt 15-25 Dateien, 3-4 Migrationen, mehrere Iterationen). Ich starte nach Freigabe mit Phase A und stimme mich nach jeder Phase kurz mit dir ab.
