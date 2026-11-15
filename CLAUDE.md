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
