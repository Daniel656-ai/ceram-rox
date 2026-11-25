# PR-Text: Übernahme Dev-Stand nach Prod (Aufgabe 036)

**Titel:** Übernahme Dev-Stand 2026-11-25: F-1, F-3, "Meine Aufgaben"

## Was ändert sich für die Benutzer

1. **F-1 – Ergebnisse veralten nicht mehr.** Fehlt später eine Eingabe oder ist eine Formel fehlerhaft, bleibt kein früher gespeicherter Ergebniswert mehr stehen. Das Ergebnis wird leer.
2. **F-3 – Runden mit leerem Feld.** Ist der zu rundende Wert leer, bleibt das Ergebnis leer. Vorher wurde fälschlich die Stellenzahl als Ergebnis angezeigt.
3. **"Meine Aufgaben" (Stefan):**
   - Neue Spalte "Probenbeschreibung" in den Tabellen "Mir zugewiesen" und "Verfügbar".
   - Die Suche findet jetzt auch über Probenbeschreibung, Versuchsnummer, Projekt und Auftrag. Groß-/Kleinschreibung und Leerzeichen/Zeilenumbrüche spielen keine Rolle.
   - Die Messdurchlauf-Auswahl ist eine Tabelle. Aufgaben lassen sich dort direkt bearbeiten bzw. mit "Übernehmen & bearbeiten" übernehmen.

## Technisch

- Neue Migrationen: keine. Datenbank-Änderungen: keine.
- Geändert: 14 Dateien unter `src/` (Code, Texte, Tests).
- Nicht enthalten: reine Dev-Dateien (`tasks/`, Dev-Skripte, `CLAUDE.md`, `.claude/`, `dev-web.yml`, Dev-Fassung `release.yml`, `package-lock.json`). Version und `release.yml` in Prod unverändert.
- Stefans Commit "Work in progress" (1c648470) ist bewusst nicht enthalten.
- `cancel_or_delete_order` behält `_confirm_number` in `types.ts`.
- Geprüft: Typprüfung grün, 206 Testdateien / 2143 Tests grün.
