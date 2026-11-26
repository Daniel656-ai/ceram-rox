# Titel

Dev-Stand übernehmen: Temperaturen, Gase dynamisch, SV, stabiler Test (Aufgabe 044)

# Beschreibung

## Worum geht's

Übernahme der Änderungen, die seit PR #2 im Dev-Repo fertig wurden. Reine
Dev-Dateien (Werkzeuge, Aufgabenlisten, `CLAUDE.md` usw.) sind bewusst nicht
dabei. `.github/workflows/release.yml` ist unverändert und enthält weiter die
neue Versionierung aus PR #3.

## Änderungen

- **Temperaturen (Aufgabe 039):** Der Temperaturblock wird in der
  Aktivitätsmessung und in der Ergebnisdatenbank ausgewertet. Verschieben und
  Löschen sind gesperrt, sobald Messwerte je Stufe vorliegen. Die
  Erkennung von JSON-Werten in `hasStepMeasurementsForOrder` wurde korrigiert.
- **Gase dynamisch (Aufgabe 040):** Alle Verbindungen der Aktivitätsmessung
  kommen jetzt dynamisch aus dem Formular, nicht mehr aus einer festen Liste.
- **Temperaturliste (Aufgabe 040):** Sie steht auch außerhalb der
  Aktivitätsansicht, mit der Überschrift "Temperatur".
- **SV (Aufgabe 040):** Die Raumgeschwindigkeit (SV) erscheint als Spalte nach
  AV in den Messbedingungen.
- **Stabiler Test (Aufgabe 042):** Der Test `orderEditPage 3c` wartet auf die
  fertige Seite statt auf die Überschrift und fällt nicht mehr zufällig durch.
- Neue und angepasste Tests zu allen Punkten.

Insgesamt 18 Dateien unter `src/` (Quelltext und Tests).

## Was nicht dabei ist

- Keine Änderung an der Datenbank-Struktur (keine Migrationen). 039/040 sind
  reine Anzeige- und Auswertungsänderungen.
- Keine `.env`, keine CSV/TXT, nichts aus "protokoll changes".
- Keine reinen Dev-Dateien, `release.yml` und `package-lock.json` unverändert.

## Prüfung

- Test-Runner: GRÜN. 2186 von 2186 Tests bestanden, Typprüfung ohne Fehler.
- Reviewer: APPROVED. Der Diff gegen `main` besteht aus genau 18 Dateien
  unter `src/`. Keine Funde.
