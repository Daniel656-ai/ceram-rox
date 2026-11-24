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
   Zeitpunkt, an dem die Datei ins Repo kam (`git log -m --diff-filter=A --follow`, ältester Add-Commit; findet sich keiner, z. B. weil die Datei durch Umnummerieren in einem Merge-Commit kam, gilt der älteste Commit, der die Datei berührt; drizzle-Dateien werden nie vor ihrer Vorgängernummer eingespielt), bei Gleichstand
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

## Nachtlauf: Dev aus Prod auffrischen (`dev-auffrischen-nacht.ps1`)

Kopiert jede Nacht Schema `public` und die Benutzerkonten aus der Firmen-DB (Prod) nach Dev, setzt die Migrationsliste auf den
Prod-Stand, spielt danach die reinen Dev-Migrationen ein (`sync-db-dev.ps1`) und legt die Testbenutzer neu an.
Grundlage ist `dev-db-auffrischen.ps1` (Handlauf, unverändert abgelegt). **Prod wird nur gelesen** (`pg_dump`, `SELECT`;
im Prod-Container liegt kurz `/tmp/devsync`, das am Ende gelöscht wird). Eine Sicherung der Dev-DB gibt es nicht mehr; vorhandene
`dev-vorher-*.dump` werden nicht angefasst.

Ablauf: STOP-Datei prüfen → Containernamen und Ports prüfen (Vertauschung = Abbruch), Prod-Listen einlesen → Task
„Dev-Web Update“ pausieren → Prod nach Dev kopieren (eine Transaktion) → `applied-migrations.txt` auf den Prod-Stand setzen
(Kopie der alten Liste als `applied-migrations.bak-<Datum>.txt`, die neuesten 7 bleiben) → `sync-db-dev.ps1` → Testbenutzer
(`testuser-dev.sql`) → Status. Der Task „Dev-Web Update“ wird **immer** wieder eingeschaltet, auch bei einem Fehler.

### Prod-Migrationslisten

Das Skript braucht die zwei Listen, die der Prod-Abgleich (`sync-db.ps1` im Ceram-Repo) führt:
`-ProdMigrationenDatei` (`applied-migrations.txt`, Supabase-Migrationen) und `-ProdDrizzleDatei` (`applied-drizzle-migrations.txt`).
Erkannt werden diese Zeilenformate (Kommentarzeilen mit `#` und Leerzeilen werden übersprungen):

| Liste | erkannte Zeilen |
|---|---|
| Supabase | `supabase/migrations/<14 Ziffern>_<name>.sql`, `<14 Ziffern>_<name>[.sql]`, nur `<14 Ziffern>` (Version, muss im Repo eindeutig sein) |
| drizzle | `drizzle/migrations/<NNNN>_<name>.sql`, `<NNNN>_<name>[.sql]` |

**Jede andere Zeile führt zum Abbruch vor jeder Änderung**, ebenso eine leere oder fehlende Liste. So kann ein unbekanntes Format
die Dev-Liste nicht verfälschen. Das Ergebnis (Schlüssel wie `supabase/migrations/<datei>.sql` und `drizzle/migrations/<datei>.sql`)
steht anschließend in `dev-state\applied-migrations.txt`. Einträge der Prod-Liste, die es im Repo nicht gibt (z. B. nur in Prod),
werden mitgeschrieben und im Log gezählt; `ignore-migrations.txt` bleibt unberührt.

### Zuerst: Trockenlauf

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db\dev-auffrischen-nacht.ps1 -Trockenlauf `
  -ProdMigrationenDatei "<Pfad>\applied-migrations.txt" -ProdDrizzleDatei "<Pfad>\applied-drizzle-migrations.txt"
```

Prüft Container, Ports, PostgreSQL-Versionen und beide Listen und zeigt den Plan samt den reinen Dev-Migrationen, die danach
eingespielt würden. Ändert nichts (auch nicht den Task). Erst wenn die Zahlen stimmen, einen Handlauf mit Rückfrage `JA` machen
(gleicher Aufruf ohne `-Trockenlauf`), danach die Aufgabenplanung einrichten.

Test gegen eine **Kopie** der Dev-DB: `-DevContainer <Name der Kopie>` (muss mit `supabase_db_` beginnen, darf nicht Prod sein und
nicht am Prod-Port 54322 hängen). Dann werden Kopieren und Prüfung ausgeführt, aber **nicht** die echte Migrationsliste, `sync-db-dev.ps1`,
die Testbenutzer und die Statusdatei angefasst.

### Geplanten Task anlegen (nachts, nach dem Konfig-Snapshot)

Mit höchsten Rechten, weil der Task „Dev-Web Update“ pausiert wird (`Disable-/Enable-ScheduledTask`). Der Konfig-Schnappschuss
läuft z. B. um 02:00, das Auffrischen um 03:00:

```powershell
$aktion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument `
  '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev\scripts\dev-db\dev-auffrischen-nacht.ps1" -OhneRueckfrage -ProdMigrationenDatei "<Pfad>\applied-migrations.txt" -ProdDrizzleDatei "<Pfad>\applied-drizzle-migrations.txt"'
$zeit = New-ScheduledTaskTrigger -Daily -At 03:00
$recht = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest
Register-ScheduledTask -TaskName "Dev-Auffrischen Nacht" -Action $aktion -Trigger $zeit -Principal $recht `
  -Description "Dev-DB nachts aus Prod auffrischen (Prod nur lesend)"
```

Der Task-Benutzer braucht Docker-Zugriff und Schreibrechte auf `C:\CeramRox_Backups\dev` und `dev-state`. Ohne `-OhneRueckfrage`
fragt das Skript nach `JA` (Handstart).

### STOP-Datei

Liegt eine Datei **`dev-auffrischen.STOP`** im Skriptordner (`scripts\dev-db\`) **oder** in `dev-state\`, bricht der Lauf sofort
ohne jede Änderung ab (Eintrag im Log, Status „UEBERSPRUNGEN“). Zum Anhalten einfach die Datei anlegen (leere Datei genügt), zum
Fortsetzen löschen. Sinnvoll, wenn in Dev gerade an etwas gearbeitet wird, das nicht überschrieben werden soll.

### Status und Log

- `dev-state\auffrischen-status.txt`: Datum, Ergebnis (`OK`, `Fehler`, `UEBERSPRUNGEN`), Anzahl eingespielter Dev-Migrationen, Meldung.
- `dev-state\dev-auffrischen.log`: ausführliches Log (letzte ca. 2000 Zeilen), dort auch die Ausgabe von `sync-db-dev.ps1`.
- Ist der Task „Dev-Web Update“ nach einem Lauf aus, steht im Log „BITTE VON HAND EINSCHALTEN“ (z. B. fehlende Rechte).

### Hinweise

- Das Repo auf dem Server (`C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev`) muss aktuell sein; das übernimmt das Update-Skript alle 10 Minuten
  (`git pull`). Das Auffrischen zieht selbst nichts nach.
- Nach einem Fehler **nach** dem Kopieren hat Dev den Prod-Stand und die gesetzte Liste; das nächste reguläre `sync-db-dev.ps1`
  spielt fehlende Dev-Migrationen nach.
- Die Datei `testuser-dev.sql` (früher `tasks/023-testuser-dev.sql`) läuft nur mit `-v nur_dev=ja` und enthält ein erfundenes
  Test-Passwort für Dev.
- Bei der STOP-Datei bleibt `auffrischen-status.txt` unverändert (nur das Log bekommt einen Eintrag).
- Das aufgerufene `sync-db-dev.ps1` legt bei anstehenden Dev-Migrationen weiterhin selbst eine Sicherung `dev_vor_migration_*.dump` an (die letzten 5 bleiben). Das ist unabhängig von der entfallenen Sicherung im Nachtlauf.
