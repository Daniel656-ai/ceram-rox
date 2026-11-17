# Dev-Datenbank: Migrationen automatisch einspielen

`sync-db-dev.ps1` spielt neue Migrationsdateien aus `supabase/migrations` und `drizzle/migrations`
in die **Dev-Datenbank** auf dem Server ein. Es wird alle 10 Minuten von `scripts/dev-web/update-dev-web.ps1`
aufgerufen (Reihenfolge dort: Projektordner → DB-Sync → Web-Vorschau).

Die **Produktion** wird davon nie berührt: Sie wird weiterhin nur über das Ceram-Repo und `sync-db.ps1` versorgt.

## Sicherheit

Zu Beginn jedes Laufs (auch bei `-Baseline` und `-DryRun`) prüft das Skript und bricht bei jeder Abweichung ab:

- Der Container heißt exakt `supabase_db_ceram-rox-dev` und läuft.
- Der Name enthält nicht `vrzqlfovvdxofxqyslev`; am Container hängt nicht der Produktions-Port 54322.
- `docker port` zeigt den Dev-Port 55322; die Datenbank antwortet im Container.
- Das Skript liegt in einem Ordner namens `ceram-rox-dev`.

Der Containername ist im Skript eine Konstante (kein Parameter). Alle DB-Zugriffe laufen per `docker exec`
im Container, ohne Passwörter und ohne Verbindung über Ports.

## Zustand (außerhalb des Repos)

Ordner: `C:\Users\Daniel.Gass\Ceram_Rox\dev-state\`

| Datei | Inhalt |
|---|---|
| `applied-migrations.txt` | bereits eingespielte Dateien, eine pro Zeile, z. B. `supabase/migrations/2026…_xyz.sql` |
| `ignore-migrations.txt` | Dateien, die nie eingespielt werden sollen (gleiches Format) |
| `sync-db-dev.log` | Log, letzte ca. 1000 Zeilen |

## Einrichtung (einmalig, am Server)

Die Dev-DB wurde am 16.11.2026 per `pg_dump --schema-only` aus der Produktion aufgebaut; alle bis dahin
vorhandenen Migrationen sind also schon enthalten. Deshalb:

```powershell
cd "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev"
git pull --ff-only

# 1. Alle vorhandenen Migrationen als "eingespielt" eintragen (führt nichts aus)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db\sync-db-dev.ps1 -Baseline

# 2. Kontrolle: muss "keine neuen Migrationen" melden
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db\sync-db-dev.ps1 -DryRun
```

Ohne vorhandene `applied-migrations.txt` bricht jeder Lauf ab (Schutz davor, alle Altmigrationen einzuspielen).
`-Baseline` mit bereits gefüllter Liste wird nur mit zusätzlichem `-Force` ausgeführt.

## Ablauf eines Laufs

1. Sicherheitsprüfung (siehe oben).
2. Neue Dateien ermitteln: alles, was weder in `applied` noch in `ignore` steht. Sortiert wird nach dem
   Zeitpunkt, an dem die Datei ins Repo kam (`git log --diff-filter=A`, ältester Add-Commit), bei Gleichstand
   nach Dateiname – über beide Ordner hinweg. Lässt sich der Zeitpunkt nicht ermitteln (z. B. flacher Klon),
   bricht der Lauf ab, ohne etwas einzuspielen. Hinweis: Maßgeblich ist der Commit-Zeitpunkt auf dem Weg nach `main`.
3. Keine neuen Dateien: eine Log-Zeile, fertig.
4. Sonst Sicherung per `pg_dump -Fc` nach `C:\CeramRox_Backups\dev\vor_migration\`
   (`dev_vor_migration_<Zeit>.dump`, die letzten 5 bleiben). Schlägt die Sicherung fehl, wird nichts eingespielt.
5. Jede Datei einzeln: `docker cp` in den Container, `psql -v ON_ERROR_STOP=1 -1 -f` (eine Transaktion),
   danach wird die temporäre Datei im Container gelöscht.
   - Enthält die Datei Befehle, die nicht in einer Transaktion laufen dürfen (`CREATE/DROP INDEX CONCURRENTLY`,
     `REINDEX … CONCURRENTLY`, `DETACH PARTITION … CONCURRENTLY`, `VACUUM`, `CREATE/DROP DATABASE`,
     `CREATE/DROP TABLESPACE`, `ALTER SYSTEM`), läuft sie **ohne** `-1`. Das steht im Log
     („OHNE Transaktion (erkannt: …)“). Kommentare werden bei der Erkennung ignoriert.
6. Erfolg: Eintrag in `applied-migrations.txt`. Fehler: **kein** Eintrag, Fehlermeldung im Log, sofortiger
   Stopp (keine weiteren Dateien). Eine Datei ohne Transaktion kann dabei teilweise ausgeführt sein – dann
   Zustand prüfen oder aus der Sicherung zurückspielen.
7. Am Ende (wenn etwas eingespielt wurde): `NOTIFY pgrst, 'reload schema';`.

Es läuft immer nur ein Lauf gleichzeitig (zweiter Aufruf meldet „Anderer Lauf aktiv“).

## Vorschau mit `-DryRun`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db\sync-db-dev.ps1 -DryRun
```

Zeigt die Dateien in der Reihenfolge, in der sie eingespielt würden, samt Transaktionsmodus. Es wird nichts
ausgeführt und keine Sicherung angelegt (die Sicherheitsprüfung läuft trotzdem).

## Fehlerhafte Migration überspringen

Schlägt eine Migration dauerhaft fehl, blockiert sie alle folgenden (der Lauf stoppt bei jedem Versuch an ihr).
Entweder die Migration im Repo korrigieren (neue Migration) oder die Datei bewusst auf die Ignorierliste setzen:

```powershell
Add-Content "C:\Users\Daniel.Gass\Ceram_Rox\dev-state\ignore-migrations.txt" "supabase/migrations/<datei>.sql"
```

Danach läuft der nächste Lauf mit der folgenden Datei weiter. Wurde die Änderung von Hand schon in der DB
gemacht, trägt man sie stattdessen in `applied-migrations.txt` ein.

## Aus einer Sicherung zurückspielen

Sicherungen liegen in `C:\CeramRox_Backups\dev\vor_migration\`. Nur für den **Dev**-Container
(`supabase_db_ceram-rox-dev`) – den Namen vor dem Ausführen prüfen:

```powershell
$dump = "C:\CeramRox_Backups\dev\vor_migration\dev_vor_migration_<Zeit>.dump"
docker cp $dump supabase_db_ceram-rox-dev:/tmp/restore.dump
docker exec supabase_db_ceram-rox-dev pg_restore -U postgres -d postgres --clean --if-exists --no-owner /tmp/restore.dump
docker exec supabase_db_ceram-rox-dev rm -f /tmp/restore.dump
docker exec supabase_db_ceram-rox-dev psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

Meldet `pg_restore` Fehler zu Supabase-eigenen Objekten (Rollen, Erweiterungen), sind diese meist harmlos;
die Anwendungsdaten im Schema `public` danach prüfen. Danach die zurückgespielten Migrationen aus
`applied-migrations.txt` entfernen (oder die fehlerhafte auf die Ignorierliste setzen), sonst ist der Stand
inkonsistent.

## Log

`C:\Users\Daniel.Gass\Ceram_Rox\dev-state\sync-db-dev.log`; das Update-Log (`scripts\dev-web\update-dev-web.log`)
enthält pro Lauf nur eine Zeile zum DB-Sync.
