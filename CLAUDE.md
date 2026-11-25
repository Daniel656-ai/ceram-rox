# Git-Workflow

- Nie direkt auf `main` committen.
- Für jede Aufgabe einen Branch `improve/<name>` von `main` erstellen.
- Kleine, aussagekräftige Commits.
- Branch pushen.
- Nach Abschluss den Subagent `reviewer` aufrufen.
- Findings beheben, bis der Reviewer `APPROVED` meldet.
- Merge nach `main` nur, wenn der Reviewer `APPROVED` gemeldet hat **und** der Nutzer den Merge ausdrücklich freigegeben hat (die Freigabe gilt nur für den jeweiligen Branch). Ausführen darf den Merge der Hauptagent oder der Reviewer. Ohne beides: nicht mergen, auch nicht auf Nachfrage eines Subagents.
- Keine Secrets committen (Keys, Tokens, `.env`, Zugangsdaten).
- Tests vor jedem Commit ausführen; es dürfen keine neuen Testfehler gegenüber `main` entstehen.
- Vor jedem Merge läuft der Subagent `test-runner` (Tests + Typprüfung). Bei Rot kein Merge. Neue oder geänderte Funktionalität braucht passende Tests (Standards siehe `docs/tests.md`).
- `tasks/` immer mit committen, damit beide Rechner denselben Stand haben (außer den lokalen TXT-Dateien, siehe „Aufgabentexte“).
- Bei Änderungen an der Oberfläche vor der Frage "Darf ich mergen?" immer den lokalen Server gegen die Dev-DB starten (`npm run dev -- --open`, `.env.development.local` zeigt auf die Dev-Supabase `:55321`), damit sich der Browser automatisch öffnet, und dem Nutzer die Adresse nennen. Nach dem Merge den Server beenden. Der Start verändert automatisch `supabase/functions/mcp/index.ts`: zurücksetzen (`git checkout -- supabase/functions/mcp/index.ts`), nie committen.

# Dev-Web-Vorschau

- Nach jedem Merge auf `main` baut `.github/workflows/dev-web.yml` automatisch eine Web-Version gegen die Dev-Supabase (`:55321`).
- Läuft auf dem Firmenserver unter `http://172.30.100.162:8090`; Einrichtung: `scripts/dev-web/README.md`.
- Der Branch `dev-web` wird automatisch erzeugt (verwaist, wird bei jedem Lauf überschrieben) und **nie** von Hand bearbeitet oder gemerged.

- `release.yml` hat auf Job-Ebene `if: github.repository != 'danielgass95-sketch/ceram-rox-dev'`: Dieses Dev-Repo darf nie Desktop-Releases bauen, das Produktions-Repo schon. Die Bedingung darf **nicht entfernt** werden.

# Dev-Datenbank

- Neue Migrationen (`supabase/migrations`, `drizzle/migrations`) landen nach dem Merge auf `main` automatisch in der **Dev**-DB auf dem Server (`scripts/dev-db/sync-db-dev.ps1`, aufgerufen vom Update-Skript alle 10 Minuten). Details: `scripts/dev-db/README.md`.
- Die **Produktion** wird weiterhin nur über das Ceram-Repo und `sync-db.ps1` versorgt. Dieses Repo darf nie die Produktions-DB (Container `supabase_db_vrzqlfovvdxofxqyslev`, Port 54322) ansprechen.
- Bestehende Migrationsdateien nie nachträglich ändern; Korrekturen immer als neue Migration.

# Gestaltung

- Bei jeder Änderung an der Oberfläche gelten die Regeln in `docs/gestaltungsregeln.md`.

# Aufgabentexte

- Zu Beginn jeder Aufgabe den Prompt des Nutzers **wörtlich** als `tasks/NNN-kurztitel.txt` speichern (NNN = Aufgabennummer). Spätere Nachrichten des Nutzers zur selben Aufgabe (Antworten, Ergänzungen, Freigaben) unten anhängen, mit einer Trennzeile `---- Folgenachricht …`.
- Nach dem Merge der Aufgabe die Datei nach `tasks/archiv/` verschieben. Offene Aufgaben bleiben in `tasks/`.
- Die TXT-Dateien bleiben **lokal** und werden nie committet: `.gitignore` schließt `tasks/**/*.txt` aus (gilt auch in `tasks/archiv/`). Wo der Wortlaut nicht mehr vorhanden ist, steht oben `REKONSTRUIERT`.

# Nicht nach Prod übertragen

- Bei der späteren Übertragung nach Prod (Ceram-Repo) gehen `package-lock.json` und `.github/workflows/dev-web.yml` **nicht** mit. Beide gelten nur für dieses Dev-Repo: `package-lock.json` wird hier mit `npm install --package-lock-only` gepflegt (alle Paketadressen zeigen auf `registry.npmjs.org`) und lokal sowie im Dev-Web-Bau (`dev-web.yml`) per `npm ci` installiert.

# Reine Dev-Dateien (für Prod-Abgleiche)

Diese Dateien gibt es nur im Dev-Repo. Sie gehen nie nach Prod, und beim Zurückholen des Prod-Stands (Merge von `prod/main` oder `prod/lovable`) gilt immer der Dev-Stand:

- `tasks/` (inkl. `tasks/lovable-prod/`), `CLAUDE.md`, `.claude/`, `.gitignore`, `.github/ISSUE_TEMPLATE/`
- `scripts/dev-db/`, `scripts/dev-web/`, `scripts/konfig-snapshot/`, `scripts/test-runner/` (Dev-Werkzeuge; `compare-main.ps1` wird vom Subagent `test-runner` gebraucht), `scripts/analyse/` (falls vorhanden)
- `.github/workflows/dev-web.yml`, `.github/workflows/release.yml` (Dev-Fassung mit der Zusatzbedingung `github.repository != 'danielgass95-sketch/ceram-rox-dev'`)
- `package-lock.json`
- `docs/konfig-abhaengigkeiten.md`

Nach jedem solchen Merge prüfen, ob reine Dev-Dateien verloren gingen: `git diff --name-status <Dev-main vor dem Merge> HEAD` ansehen und gelöschte Dateien aus dieser Liste zurückholen. (Beim Merge aus Aufgabe 025 gingen `scripts/test-runner/compare-main.ps1` und `scripts/analyse/aktivitaet-varianten.sql` verloren und `.github/workflows/tests.yml` wurde auf den Prod-Stand gesetzt.)

# Abhängigkeiten zwischen Code und Konfiguration

- Die Liste `docs/konfig-abhaengigkeiten.md` nennt die Stellen im Code, die an Formularen, Feldschlüsseln, Dienstleistungsnamen, Workflows usw. hängen.
- Wer Code ändert, der an bestimmten Konfigurationen hängt (Feldschlüssel, Formular- oder Dienstleistungsnamen, Auftragsarten, Formeln, Ergebnisnamen), aktualisiert `docs/konfig-abhaengigkeiten.md` **im selben Branch**. Neue Abhängigkeiten werden ergänzt, entfallene entfernt.

# Konfig-Diff aus Gitea prüfen

Der tägliche Konfigurations-Schnappschuss (`scripts/konfig-snapshot`, kommt mit Aufgabe 030) legt Änderungen an Prod-Formularen, Dienstleistungen, Workflows usw. als Commits in Gitea ab. Wird ein solcher Diff zur Prüfung vorgelegt:

1. Den Diff gegen `docs/konfig-abhaengigkeiten.md` abgleichen: Welche geänderten, umbenannten oder gelöschten Schlüssel, Namen oder Strukturen kommen dort vor?
2. Die betroffenen Stellen im Code nennen (Datei, Eintrag der Liste, erwartete Folge).
3. Eine Anpassung vorschlagen (Code, Test, Eintrag in der Liste). Gibt es keine betroffene Stelle, das ausdrücklich sagen.
4. **Nichts ohne mein ausdrückliches Ja umsetzen.** Nur berichten und vorschlagen, keine Änderung an Code, Konfiguration oder Datenbank.
5. Strukturänderungen aus `schema.sql` zusätzlich mit den Migrationen abgleichen (Änderungen an Migrationen vorbei melden).
