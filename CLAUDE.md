# Git-Workflow

- Nie direkt auf `main` committen.
- Für jede Aufgabe einen Branch `improve/<name>` von `main` erstellen.
- Kleine, aussagekräftige Commits.
- Branch pushen.
- Nach Abschluss den Subagent `reviewer` aufrufen.
- Findings beheben, bis der Reviewer `APPROVED` meldet.
- Nur der Reviewer merged nach `main`.
- Keine Secrets committen (Keys, Tokens, `.env`, Zugangsdaten).
- Tests vor jedem Commit ausführen; es dürfen keine neuen Testfehler gegenüber `main` entstehen.

# Dev-Web-Vorschau

- Nach jedem Merge auf `main` baut `.github/workflows/dev-web.yml` automatisch eine Web-Version gegen die Dev-Supabase (`:55321`).
- Läuft auf dem Firmenserver unter `http://172.30.100.162:8090`; Einrichtung: `scripts/dev-web/README.md`.
- Der Branch `dev-web` wird automatisch erzeugt (verwaist, wird bei jedem Lauf überschrieben) und **nie** von Hand bearbeitet oder gemerged.

- `release.yml` hat auf Job-Ebene `if: github.repository != 'danielgass95-sketch/ceram-rox-dev'`: Dieses Dev-Repo darf nie Desktop-Releases bauen, das Produktions-Repo schon. Die Bedingung darf **nicht entfernt** werden.
