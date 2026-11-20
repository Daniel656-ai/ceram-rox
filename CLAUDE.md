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

# Nicht nach Prod übertragen

- Bei der späteren Übertragung nach Prod (Ceram-Repo) gehen `package-lock.json` und `.github/workflows/dev-web.yml` **nicht** mit. Beide gelten nur für dieses Dev-Repo: `package-lock.json` wird hier mit `npm install --package-lock-only` gepflegt (alle Paketadressen zeigen auf `registry.npmjs.org`) und lokal sowie im Dev-Web-Bau (`dev-web.yml`) per `npm ci` installiert.
