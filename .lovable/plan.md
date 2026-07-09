
# Modul „Projektportfolio"

Umfangreiches neues Hauptmodul. Ich schlage eine **inkrementelle Umsetzung in 4 Phasen** vor — jede Phase ist eigenständig lauffähig. So bleibt der Aufwand pro Schritt beherrschbar und Sie können nach jeder Phase testen und priorisieren.

---

## Phase 1 – Fundament (Datenmodell, Rechte, CRUD, Zuordnung)

**Datenmodell (Migration)**
- `project_portfolios` — name, short_code, description, category, funding_program, funding_body, start_date, end_date, status, responsible_user_id, planned_budget, approved_budget, notes
- `project_portfolio_members` (M:N Projekt ↔ Portfolio) — portfolio_id, project_id, contribution_goal, contribution_summary, current_status, key_results
- `project_portfolio_periods` (Förderperioden) — portfolio_id, name, start_date, end_date
- `project_portfolio_milestones` — portfolio_id, title, type (Antrag/Genehmigung/Zwischenbericht/Review/Abschluss), due_date, completed_at, status
- `project_portfolio_documents` — portfolio_id, category (Antrag/Vertrag/Bericht/…), file_path, version, uploaded_by
- Volle GRANTs + RLS über neue Security-Definer-Funktion `can_access_portfolio(uid, portfolio_id, action)` gestützt auf `has_permission`.

**Berechtigungen** (in `role_permissions` einpflegbar, kein Hardcode)
- `nav.portfolios` (Navigations-Sichtbarkeit)
- `portfolios.view`, `portfolios.create`, `portfolios.edit`, `portfolios.delete`
- `portfolios.assign_projects`, `portfolios.remove_projects`
- `portfolios.export`, `portfolios.documents.manage`, `portfolios.dashboard.view`
- Seed: Rolle **Administrator** und neue Rolle **PMO** erhalten alle Rechte per Default.

**API-Layer** — `src/lib/api/projectPortfolios.ts` (list/get/create/update/delete, members, periods, milestones, documents). Kein direkter Supabase-Zugriff außerhalb.

**UI**
- Sidebar-Eintrag „Projektportfolio" (nur bei `nav.portfolios`)
- Route `/portfolios` — Liste, Suche, Filter (Kategorie, Förderprogramm, Status, Periode)
- Route `/portfolios/:id` — Detail mit Tabs (Stammdaten, Projekte, Meilensteine, Dokumente, Auswertungen, Dashboard)
- Tab **Projekte**: Zuordnen/Entfernen (M:N), Anzeige Anzahl / aktiv / abgeschlossen + Projektliste (Leiter, Status, Laufzeit)

## Phase 2 – Auswertungen (Aggregation über verknüpfte Projekte)

Server-seitige RPCs (`security definer`) aggregieren über Portfolio-Mitgliedschaften — nutzt vorhandene `project_time_entries`, `project_expenses`, `project_consumables`, `project_knetung_materials`, Personalkosten (Stunden × Rate).

- Stundenübersicht: gesamt / pro Projekt / pro Mitarbeiter / pro Monat / pro Arbeitspaket
- Personenauswertung mit Filter Zeitraum/Mitarbeiter/Projekt/Portfolio
- Kostenübersicht: Personal + Rohstoff + Material + Dienstleistung + sonstige → Gesamt, plus Budget / Verbrauch / Rest
- Ressourcenübersicht (Mitarbeiter × Stunden × Kosten × Projektzahl)
- Zeitliche Entwicklung: Stunden/Kosten/Budgetverbrauch pro Monat (Recharts)
- Filter „Förderperiode" auf allen Auswertungen
- **Personenjournal** + **Kostenjournal** (chronologisch, filterbar) für Audit/FFG

## Phase 3 – Dokumente, Meilensteine, Dashboard, Ampel

- Versionierter Dokumentenbereich (Kategorien: Antrag/Vertrag/Zwischenbericht/Endbericht/Präsentation/Publikation/Patent/Sonstige), Upload via bestehende Storage-Infrastruktur
- Meilensteinliste mit Status (offen/erledigt/überfällig)
- Portfolio-Dashboard mit KPIs (Projekte, Mitarbeiter, Stunden, Kosten, Budgetverbrauch, offene/abgeschlossene Meilensteine)
- **Ampelstatus** (🟢/🟡/🔴) automatisch berechnet für Budget, Stunden, Fortschritt, Meilensteine anhand konfigurierbarer Schwellwerte (default 80%/100%)

## Phase 4 – Exporte

- Excel (SheetJS): Übersicht, Personen, Stunden, Kosten, Budget, Meilensteine, Dokumentenliste, Personen-/Kostenjournal
- PDF (bestehende Print-Infrastruktur): identische Sektionen, druckoptimiert

---

## Technische Hinweise

- Rein additiv — bestehende Projekte, Zeiterfassung, Kosten bleiben unverändert.
- Alle Zugriffe über `src/lib/api/*` (verbindliche Architekturregel).
- i18n DE/EN, Datentyp-Locales konsistent.
- Neue Rolle **PMO** wird als `custom_role` angelegt; keine Änderung der Basisrollen (`master`/`auftraggeber`/`durchfuehrer`).
- ESLint-Regel „no direct supabase" wird eingehalten.

---

## Frage vor Umsetzung

Soll ich mit **Phase 1** starten (Datenmodell + Rechte + CRUD + Projektzuordnung + Sidebar/Navigation) und die Auswertungen/Dokumente/Exports in den Folgephasen nachziehen? Oder möchten Sie eine andere Reihenfolge / eine engere Reduktion des ersten Wurfs (z. B. ohne Förderperioden oder ohne PMO-Rollenseed)?
