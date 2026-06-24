# R&D Project Weekly Review

Neues Feature zur wöchentlichen Statuserfassung pro Projekt – mit Verlaufschart, Dashboard-Integration und automatischen Erinnerungen.

## 1. Datenbank (Migration)

Neue Tabelle `project_weekly_reviews`:
- `project_id` (FK projects)
- `author_user_id` (FK auth.users)
- `author_role_snapshot` (text, eingefrorene Rolle im Projekt)
- `iso_year`, `iso_week` (int, ISO-8601)
- `review_date` (date)
- `completed_this_week`, `currently_working_on`, `next_steps`, `help_needed`, `risks`, `other_comments` (text)
- `overall_rating` (smallint, 1–3, CHECK)
- Unique-Constraint: `(project_id, author_user_id, iso_year, iso_week)` → ein Review pro Mitarbeiter/Projekt/Woche; bestehende werden NICHT überschrieben (Insert-only, kein Update)
- RLS:
  - SELECT: Projektmitglieder + `projects.view_all`-Permission
  - INSERT: Projektmitglieder (nur eigene `author_user_id`)
  - UPDATE/DELETE: **nicht erlaubt** (immutable Snapshot)
- GRANTs für `authenticated` und `service_role`

Optional View `project_weekly_review_compliance` für KPI (erwartete vs. eingereichte Reviews je Woche/Projekt).

## 2. API-Layer

`src/lib/api/weeklyReviews.ts` (über zentralen `dbClient`):
- `list(projectId)`, `listForUser(userId)`, `listOpen()` (Projekte ohne Review in aktueller KW für aktuellen User)
- `create(payload)`
- `compliance({ from, to })`

Hook: `src/hooks/useWeeklyReviews.ts` mit React-Query.

## 3. UI – Projektdetail

In `ProjectDetailPage.tsx` neuer Tab/Abschnitt **„Weekly Reviews"**:
- Button **„Weekly Review erstellen"** (sichtbar nur für Projektmitglieder; deaktiviert wenn Review für aktuelle KW bereits existiert, mit Tooltip)
- `WeeklyReviewDialog.tsx`:
  - Read-only Felder: Datum (heute, lokal formatiert), Mitarbeiter (Name), Projektrolle (aus `project_members`, Fallback „Mitglied")
  - 6 Textarea-Felder gemäß Spezifikation
  - Flaggen-Auswahl 🚩 / 🚩🚩 / 🚩🚩🚩 (rot/gelb/grün) mit klickbaren Buttons → speichert 1/2/3
  - Validierung via Zod
- `WeeklyReviewList.tsx`: chronologisch (neueste zuerst), Karten mit Datum, Mitarbeiter, Rolle, farbiger Flaggen-Badge, ausklappbare Antworten
- Suche/Filter nach Datum (Range) und Mitarbeiter (Select)
- `WeeklyReviewTrendChart.tsx` (Recharts LineChart):
  - X: review_date, Y: 1–3
  - Punkte farbcodiert (rot/gelb/grün), Linie neutral
  - Tooltip mit Datum, Mitarbeiter, Kommentar-Snippet
  - Responsive (`ResponsiveContainer`)

## 4. Projektübersicht & Dashboard

- `ProjectsPage.tsx`: neue Spalte **Status** mit aktuellster Flagge je Projekt (rot/gelb/grün, „–" wenn kein Review)
- `Dashboard.tsx` (Projektleiter-Sicht via `projects.manage`-Permission): Widget **„Offene Weekly Reviews"** mit Projekt, Mitarbeiter, Rolle, Status (offen/überfällig/erledigt) + KPI-Karten (Quote %, überfällig, ⌀ Bewertung)

## 5. Automatische Reminder (Edge Function + pg_cron)

Edge Function `weekly-review-reminders`:
- Ermittelt aktive Projektmitglieder laufender Projekte
- Prüft pro Mitarbeiter/Projekt, ob in aktueller ISO-KW ein Review existiert
- Erstellt In-App-`notifications` (bestehende Tabelle) mit Direktlink `/projekte/<id>?weekly=1`
- Falls Lovable Emails konfiguriert: zusätzlich E-Mail über `send-transactional-email`
- Modus per Query-Param: `?mode=friday` (Erstreminder) / `?mode=monday` (Eskalation an Mitarbeiter + Projektleiter)

pg_cron-Jobs (Europe/Vienna):
- Freitag 14:00 → `mode=friday`
- Montag 09:00 → `mode=monday`

Reminder-Inhalt gemäß Spezifikation (Betreff, Nachricht, CTA-Button-Link).

## 6. Berechtigungen

Neue Permission-Keys in `usePermissions.ts` & `role_permissions`:
- `weekly_reviews.create` (alle Projektmitglieder per Default)
- `weekly_reviews.view` (Projektmitglieder + Leitung)
- `weekly_reviews.view_all` (Master/Admin/PMO)

## 7. i18n

Neue Keys in `de/projects.json` und `en/projects.json` (Felder, Buttons, Reminder-Texte, Statuslabels).

## Technische Details

- ISO-Wochen über `date-fns` `getISOWeek` / `getISOWeekYear`
- Snapshots immutable: keine Update/Delete-Policy, UI bietet kein Bearbeiten
- Charts: bestehendes `recharts` aus Projekt
- Design-Tokens aus `index.css` (rot/gelb/grün als semantische Klassen via `text-destructive`, `text-warning`, `text-success` falls vorhanden – sonst neue Tokens)
- API-Aufrufe ausschließlich über `src/lib/api/*` (kein direktes `supabase.from` in Hooks/Pages)

## Offene Fragen

1. **E-Mail-Reminder**: Soll ich Lovable Emails einrichten (Domain-Setup nötig) oder reichen In-App-Notifications zunächst?
2. **Eskalation Montag**: Projektleiter automatisch CC, oder nur bei expliziter Konfiguration?
3. **Dashboard-Widget**: Auch für normale Mitarbeiter „meine offenen Reviews" anzeigen, oder nur für Projektleiter?
