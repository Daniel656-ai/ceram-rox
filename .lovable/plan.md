
## Analyse des bestehenden Projektmanagements

### Bereits vorhandene Funktionen
- **Projektstammdaten**: `projects` + `ProjectDetailPage` mit Tabs (Übersicht, Proben, Aufgaben, Team, Planung, Weekly Reviews, Kosten, Materialkosten, Zeitbuchung, Dokumente, Bericht).
- **Team & Rollen**: `project_members` mit Rollen Owner/Leader/Member (`ProjectTeamTab`).
- **Planung**: Meilensteine (`project_milestones`), Arbeitspakete (`project_work_packages`), Gantt.
- **Kosten-Datenquellen**: Zeitbuchungen (`project_time_entries`), Verbrauchsmaterialien (`project_consumables`), Knetungs-Rohstoffe (`project_knetung_materials`) inkl. Stundensätzen und Personal-/Materialkosten – wird in `ProjectMaterialCosts` und Kosten-Tab aggregiert.
- **Weekly Reviews**: `project_weekly_reviews` mit Bewertung, Trends, Ampel (Basis für Lessons Learned).
- **Dokumente**: `project_documents` mit Versionierung (Antrag, Reports).
- **Aktivitäts-Log**: globaler `activity_log` (Events, Audit), aber nicht für Scope-Änderungen genutzt.

### Teilweise vorhandene Funktionen
- **Budget-Tracking**: Ist-Kosten werden berechnet, aber es gibt **kein Gesamtbudget**, keinen Forecast, keine Schwellwerte/Warnungen.
- **Lessons Learned**: Weekly Reviews enthalten Kommentare/Risiken – aber kein dediziertes Abschluss-Retro.
- **Change Log**: `order_audit_log` und `activity_log` existieren – aber nicht für genehmigungspflichtige Projekt-Scope-Änderungen.

### Komplett fehlende Funktionen
- Genehmigungspflichtiges **Change-Request-System** (Antragsteller/Genehmiger/Auswirkungen).
- **Entscheidungs-Log** (Decisions).
- **Stakeholder-/Kommunikationsplan**.
- **Lessons-Learned-Retro** als Projektabschluss-Artefakt.
- **Budget-Felder** auf Projektebene + Burn-Rate-Anzeige.

---

## Integrationsstrategie (keine neuen Top-Level-Navigationspunkte)

Alles bleibt **innerhalb von `ProjectDetailPage`**. Zur Vermeidung von Tab-Wildwuchs wird **ein neuer Sammeltab „Governance"** eingeführt, der per Sub-Tabs die fünf Bereiche bündelt:

```
ProjectDetailPage
└── Tab "Governance" (neu)
    ├── Änderungen (Change Requests)
    ├── Entscheidungen
    ├── Stakeholder & Kommunikation
    └── Lessons Learned
```

Budget wird **nicht** in Governance versteckt, sondern direkt im bestehenden **Kosten-Tab** als Kopfzeile (Budget vs. Ist + Burn-Rate-Karten) ergänzt – dort wo Kosten schon gerechnet werden. Budgetfelder selbst werden in die Projekt-Stammdaten (Übersicht) integriert.

Lessons Learned wird zusätzlich an den Button **„Projekt abschließen"** gekoppelt – beim Abschluss erscheint ein Dialog, der die Retro-Felder vorausfüllt aus den letzten Weekly Reviews (Risiken/Highlights → „Was lief gut/schlecht").

---

## Datenmodell-Erweiterungen

**Erweiterung `projects`**
- `budget_total numeric` (Gesamtbudget €)
- `budget_warning_threshold int` (z. B. 80 %)
- `budget_currency text default 'EUR'`

**Neu `project_change_requests`**
- title, description, requested_by (uuid), approver_id, approval_status (`pending|approved|rejected|withdrawn`), approval_date, impact_budget numeric, impact_schedule_days int, impact_description, related_milestone_id (nullable)
- Historie über `updated_at` + Status-Trigger ins `activity_log`.

**Neu `project_decisions`**
- title, decision_date, rationale, decided_by (uuid), affected_areas text[], status (`active|superseded|rejected`), superseded_by uuid (self-FK), related_milestone_id (nullable)

**Neu `project_stakeholders`**
- name, organization, role, contact_email, contact_phone, channel (`email|phone|meeting|portal|other`), frequency (`daily|weekly|biweekly|monthly|quarterly|adhoc`), responsible_user_id, last_contact_at, notes

**Neu `project_lessons_learned`** (1:1 mit Projektabschluss; mehrere Einträge möglich)
- went_well text, went_wrong text, recommendations text, overall_rating int (1–5), follow_up_actions text, created_by, related_weekly_review_ids uuid[] (für Auto-Import)

Alle Tabellen: RLS analog `project_milestones` (Master oder Projektmitglieder per `is_project_member` / `has_project_role`). GRANTs für `authenticated` + `service_role`.

---

## UI-/UX-Vorschläge

**Governance-Tab** (`ProjectGovernanceTab.tsx`)
- Sub-Tabs (shadcn Tabs), Standard: „Änderungen".
- **Change Requests**: vertikale Timeline (chronologisch, neueste oben), Status-Badges, „Neuer Antrag"-Dialog mit Auswirkungs-Feldern. Genehmigung inline durch berechtigte User.
- **Entscheidungen**: Listenansicht mit Suchfeld + Statusfilter, Aufklapp-Detail, „Ersetzt durch"-Link.
- **Stakeholder & Kommunikation**: kompakte Tabelle (sortierbar), Inline-„Letzter Kontakt aktualisieren".
- **Lessons Learned**: Karten pro Eintrag, Button „Aus Weekly Reviews vorbefüllen" (zieht Highlights/Risks der letzten 4 Reviews).

**Budget-Integration**
- In Projekt-Stammdaten/Übersicht: Budget-Felder editierbar (nur Leader/Owner/Master).
- Im **Kosten-Tab** drei Karten oben: *Budget*, *Ist-Kosten (Personal+Material)*, *Restbudget + %*. Fortschrittsbalken, rot bei Überschreitung Schwellwert. Burn-Rate = Ist-Kosten / verstrichene Projektwochen.

**Lessons-Learned-Kopplung an Projektabschluss**
- Bestehender „Projekt abschließen"-Button öffnet zusätzlich Retro-Dialog (optional ausfüllbar, abschließen geht auch ohne).

---

## Berechtigungen
- Erstellen/Bearbeiten: `projects.edit` ODER Projektrolle Owner/Leader (über `has_project_role`).
- Lesen: Projektmitglieder + `projects.view`.
- Genehmigung Change Request: nur Owner/Leader oder `master`.
- Budgetfelder editieren: nur Owner/Leader/`master`.

---

## Umsetzungsreihenfolge
1. **Migration**: Tabellen + RLS + Budget-Felder auf `projects`.
2. **API-Layer** (`src/lib/api/projectGovernance.ts`, Budget-Erweiterung in `projects.ts`).
3. **Hooks** (`useProjectChangeRequests`, `useProjectDecisions`, `useProjectStakeholders`, `useProjectLessonsLearned`).
4. **UI**: `ProjectGovernanceTab` + Sub-Komponenten, Budget-Karten im Kosten-Tab, Budget-Felder in Übersicht, Retro-Dialog beim Abschluss.
5. **i18n** DE/EN.

---

**Bestätige bitte den Plan**, dann lege ich los. Falls du einzelne Bereiche weglassen oder priorisieren willst (z. B. nur Change Log + Budget zuerst), sag Bescheid.
