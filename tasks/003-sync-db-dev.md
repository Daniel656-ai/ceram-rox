# Aufgabe 004: Migrationen automatisch in die Dev-Datenbank einspielen

**Voraussetzung:** Aufgabe 003 ist erledigt (Update-Skript mit Platzhalter für den DB-Schritt).

## Ziel
Neue Migrationsdateien aus diesem Repo sollen automatisch in die **Dev-Datenbank** auf dem Server
eingespielt werden – analog zum Produktions-Skript `sync-db.ps1`, aber **ausschließlich** gegen die
Dev-Instanz. So passt die Dev-Datenbank immer zur Dev-Vorschau.

## Ausgangslage (bitte lesen, nicht ändern)
- Dev-Supabase auf dem Server: Container `supabase_db_ceram-rox-dev`, PostgreSQL-Port **55322**,
  API (Kong) **55321**.
- **Produktion** daneben: Container `supabase_db_vrzqlfovvdxofxqyslev`, Port **54322**.
  **Darf unter keinen Umständen angesprochen werden.**
- Die Dev-Datenbank wurde am 16.11.2026 **nicht** aus den Migrationen aufgebaut, sondern per
  `pg_dump --schema-only` aus der Produktion plus Datenkopie. Die Migrationsdateien, die es zu diesem
  Zeitpunkt gab, sind inhaltlich also **schon drin**.
- Migrationsordner im Repo: `supabase/migrations` und `drizzle/migrations`.
- So arbeitet das Produktions-Skript (als Vorbild, liegt nicht im Repo):
  - merkt sich eingespielte Dateien in Listen (`applied-drizzle-migrations.txt`), dazu eine Ignorierliste
  - macht vor dem Einspielen eine Sicherung (pg_dump)
  - spielt jede Datei per `docker cp` + `psql -f` ein (wegen korrekter UTF-8-Umlaute nicht per Pipe)
  - lädt danach den PostgREST-Schema-Cache neu (`NOTIFY pgrst, 'reload schema';`)
- Windows PowerShell 5.1, kein Internet am Server.

## Umfang

### 1. Neues Skript `scripts/dev-db/sync-db-dev.ps1`
- **Harte Sicherheitsprüfung am Anfang (Abbruch bei Abweichung):**
  - Zielcontainer ist exakt `supabase_db_ceram-rox-dev` und läuft
  - Der Name enthält **nicht** `vrzqlfovvdxofxqyslev`
  - Im Container ist die Datenbank über den Dev-Port erreichbar (Port 55322 in `docker port`)
- **Zustandsdateien außerhalb des Repos**, damit Git sie nie anfasst:
  `C:\Users\Daniel.Gass\Ceram_Rox\dev-state\` mit `applied-migrations.txt` und `ignore-migrations.txt`
  (ein Eintrag pro Zeile, Format `supabase/migrations/<datei>` bzw. `drizzle/migrations/<datei>`).
- **Baseline-Modus** (Parameter `-Baseline`): trägt alle aktuell vorhandenen Migrationsdateien als
  „bereits eingespielt“ ein, **ohne** etwas auszuführen. Wird einmalig bei der Einrichtung benutzt,
  weil die DB diese Stände schon enthält. Ohne vorhandene `applied-migrations.txt` und ohne `-Baseline`
  bricht das Skript mit Hinweis ab (Schutz vor versehentlichem Einspielen aller Altmigrationen).
- **Normaler Lauf:**
  1. Neue Dateien ermitteln (nicht in applied, nicht in ignore), sortiert nach Dateiname.
  2. Gibt es keine: kurze Log-Zeile, fertig.
  3. Sonst vorher Sicherung: `pg_dump` der Dev-DB nach `C:\CeramRox_Backups\dev\vor_migration\`,
     nur die letzten 5 Sicherungen behalten.
  4. Jede Datei einzeln: `docker cp` in den Container, `psql -v ON_ERROR_STOP=1 -1 -f` (eine
     Transaktion pro Datei), danach temporäre Datei im Container löschen.
  5. Erfolgreich → in `applied-migrations.txt` eintragen. Fehler → **nicht** eintragen, Fehlermeldung
     ins Log, **sofort stoppen** (keine weiteren Dateien).
  6. Am Ende `NOTIFY pgrst, 'reload schema';`.
- Log: `C:\Users\Daniel.Gass\Ceram_Rox\dev-state\sync-db-dev.log`, letzte ca. 1000 Zeilen behalten.
- Parameter `-DryRun`: zeigt nur, welche Dateien eingespielt würden.

### 2. Einbinden ins Update
- Im Update-Skript aus Aufgabe 003 den Platzhalter durch einen Aufruf von `sync-db-dev.ps1` ersetzen.
  Reihenfolge: Projektordner aktualisieren → **DB synchronisieren** → Web-Vorschau aktualisieren.
- Schlägt die DB-Synchronisation fehl, läuft das Update der Web-Vorschau trotzdem weiter, der Fehler steht im Log.

### 3. Doku
- `scripts/dev-db/README.md`: Einrichtung (einmalig `-Baseline`), Ablauf, `-DryRun`, wie man eine
  fehlerhafte Migration auf die Ignorierliste setzt, wie man aus einer Sicherung zurückspielt.
- Kurzer Abschnitt in `CLAUDE.md`: Migrationen landen nach dem Merge automatisch in der **Dev**-DB;
  die Produktion wird weiterhin nur über das Ceram-Repo und `sync-db.ps1` versorgt.

## Nicht ändern
- Bestehende Migrationsdateien, `src/`, `.env`, `release.yml`, `dev-web.yml`
- Nichts an der Produktion, kein Zugriff auf Port 54322 oder den Container `supabase_db_vrzqlfovvdxofxqyslev`
- Keine Passwörter in Dateien (Zugriff läuft über `docker exec` im Container)

## Fertig, wenn
- Skript ist PowerShell-5.1-kompatibel, Sicherheitsprüfungen sind am Anfang und nicht umgehbar
- Baseline-, DryRun- und Normalmodus sind beschrieben und im Code klar getrennt
- Reviewer hat APPROVED gemeldet (bitte besonders die Sicherheitsprüfung und die Fehlerbehandlung prüfen)
- Zusammenfassung enthält die Schritte, die Daniel am Server von Hand ausführen muss
  (insbesondere einmalig `-Baseline` und ein erster `-DryRun`)
