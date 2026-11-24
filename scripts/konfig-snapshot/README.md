# Konfigurations-Schnappschuss (`konfig-snapshot.ps1`)

Stefan ändert in Prod über die App Konfiguration (Formulare, Dienstleistungen, Workflows, Vorlagen …). Das wird nicht
versioniert. Dieses Skript liest die Konfiguration **täglich nur lesend** aus der Datenbank, legt sie als sortierte
JSON-Dateien in einem Git-Ordner ab und committet nur, wenn sich etwas geändert hat. Wer sich die Commits ansieht,
sieht genau, **was sich wann geändert hat**.

Grundlage: `tasks/029b-konfig-tabellen.md`, Abschnitte 1–5. Passende Prüfregeln: `CLAUDE.md` (Abschnitt „Konfig-Diff aus Gitea prüfen“) und `docs/konfig-abhaengigkeiten.md`.

## Was passiert bei einem Lauf

1. Prüft, dass Docker läuft und der Container erreichbar ist, und dass `psql` im Nur-Lese-Modus arbeitet (`default_transaction_read_only=on`). Sonst Abbruch, es wird nichts gelesen.
2. Fragt ab, welche der erwarteten Tabellen es gibt. **Fehlende Tabellen werden übersprungen und im Log vermerkt** (und in `_uebersprungen.txt` im Export).
3. Schreibt je Tabelle eine JSON-Datei (Zeilen nach `id` sortiert, Schlüssel alphabetisch, eingerückt). Dafür legt `psql` im Container kurz den Ordner `/tmp/konfig-snapshot` an; er wird am Ende gelöscht.
4. Holt die Dateien mit `docker cp` ab (Bytes bleiben unverändert, keine Umleitung über PowerShell).
5. Erzeugt mit `pg_dump --schema-only --schema=public --no-owner` die Datei `schema.sql`. So fallen Strukturänderungen auf, die an den Migrationen vorbei gemacht wurden. Die zufälligen `\restrict`-Zeilen neuerer `pg_dump`-Versionen werden entfernt, sonst gäbe es täglich einen Scheinunterschied.
6. Ersetzt den Inhalt des Git-Ordners durch den neuen Stand, `git add -A`, Commit nur bei Änderungen (Text: `Konfig-Schnappschuss <Datum> (<Container>)` plus Dateistatistik).
7. Mit `-RemoteUrl`: danach `git push`. Schlägt der Push fehl, bleibt der lokale Commit und der Fehler steht im Log.

Es gibt **kein** INSERT/UPDATE/DELETE/DDL und keinen neuen Datenbankbenutzer. Der Zugang läuft nur über `docker exec <Container> psql` und `pg_dump`.

## Aufbau des Git-Ordners

```
konfig-historie/
  schema.sql                     Struktur von Schema public
  _uebersprungen.txt             Tabellen, die es in dieser DB nicht gibt
  1-dienstleistungen/
    dienstleistungen/<name>__<id>.json   je Dienstleistung eine Datei (mit ihren Feldern, Blöcken, Regeln …)
    _ohne-zuordnung/<tabelle>.json       Zeilen ohne zugehörige Dienstleistung
    <tabelle>.json                       übrige Tabellen (Workflows, Prozesse, Pakete …)
  2-formulare/
    formulare/<name>__<id>.json          je Formular eine Datei (mit Feldern, Berechnungen, Rechten, Rollenansichten)
    _ohne-zuordnung/<tabelle>.json
    <tabelle>.json                       globale Felder, Listen, Prüfregeln …
  3-vorlagen/                            Messvorlagen, Etiketten, Symbole
  4-rohstoffe-rezepturen/                Rohstoffe, Lagerorte, Verbrauchsmaterial, Rezepturen
  5-einstellungen/                       Firmendaten, Synchronisierung, Arbeitsplätze, Prüfmittel …
```

Der Dateiname enthält Name (kleingeschrieben, ohne Sonderzeichen) und `id`. Wird ein Formular umbenannt, ändert sich der Name nur im Dateiinhalt und im Dateinamen; Git zeigt das als Umbenennung bzw. neue Datei, die `id` bleibt gleich.

**Geheimnisse:** Spalten, deren Name `pass`, `secret`, `token`, `api_key`, `credential` oder `private_key` enthält, werden im Export durch `***` ersetzt. Trotzdem gehört der Ordner nur in ein **privates** Repository.

## Test gegen Dev (zuerst!)

Auf dem Server in PowerShell, im Ordner des Repos:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\konfig-snapshot\konfig-snapshot.ps1 `
  -Container supabase_db_ceram-rox-dev -Ziel C:\Temp\konfig-test
```

- Der erste Lauf legt `C:\Temp\konfig-test` an (`git init`) und macht den ersten Commit.
- Ein zweiter Lauf direkt danach muss „Keine Änderungen seit dem letzten Lauf, kein Commit.“ melden. Wenn nicht, sortiert eine Tabelle nicht stabil: das Log nennen.
- Prüfen: `git -C C:\Temp\konfig-test log --stat`, ein paar JSON-Dateien öffnen, `_uebersprungen.txt` ansehen.
- Nur exportieren, ohne Git: zusätzlich `-KeinGit`.
- Log: `C:\Temp\konfig-snapshot.log` (liegt neben dem Zielordner; mit `-LogDatei` änderbar).

Erst wenn das passt, gegen Prod laufen lassen (Standard, ohne `-Container`).

## Parameter

| Parameter | Standard | Bedeutung |
|---|---|---|
| `-Container` | `supabase_db_vrzqlfovvdxofxqyslev` (Prod) | Datenbank-Container. Zum Testen `supabase_db_ceram-rox-dev`. |
| `-Ziel` | `C:\CeramRox_Backups\konfig-historie` | lokaler Git-Ordner (wird beim ersten Lauf angelegt) |
| `-RemoteUrl` | leer | Gitea-Adresse; wenn gesetzt, wird nach dem Commit gepusht |
| `-LogDatei` | `konfig-snapshot.log` neben `-Ziel` | Log (letzte 2000 Zeilen) |
| `-KeinGit` | aus | nur exportieren, nicht committen |

Rückgabewert: `0` ok · `1` Fehler (es wurde nichts committet; ein halber Export wird nie gespeichert) · `3` lokal committet, aber Push fehlgeschlagen.

## Geplanten Task anlegen (nachts, vor dem Dev-Auffrischen)

Als Benutzer, der Docker und Git benutzen darf (derselbe wie beim Task „Dev-Web Update“). Beispiel: täglich 02:00 Uhr; das Dev-Auffrischen (Aufgabe 031) soll **danach** laufen, z. B. 03:00 Uhr.

```powershell
$aktion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument `
  '-NoProfile -ExecutionPolicy Bypass -File "C:\<Pfad>\scripts\konfig-snapshot\konfig-snapshot.ps1" -RemoteUrl "https://<gitea>/<firma>/konfig-historie.git"'
$zeit   = New-ScheduledTaskTrigger -Daily -At 02:00
Register-ScheduledTask -TaskName "Konfig-Schnappschuss" -Action $aktion -Trigger $zeit `
  -Description "Taeglicher lesender Export der Prod-Konfiguration nach Git"
```

`-RemoteUrl` weglassen, wenn nur lokal gesichert werden soll. Den Task einmal von Hand starten (`Start-ScheduledTask -TaskName "Konfig-Schnappschuss"`) und das Log prüfen.

## Gitea einrichten (einmalig)

1. In Gitea ein **privates** leeres Repository anlegen, z. B. `konfig-historie`.
2. Anmeldung **nicht** in die URL schreiben (das Skript lehnt `https://benutzer:passwort@…` ab). Stattdessen einmal von Hand pushen, damit der Windows-Anmeldemanager die Zugangsdaten (Benutzer + Zugriffstoken) für den Task-Benutzer speichert:
   `git -C C:\CeramRox_Backups\konfig-historie remote add origin <URL>` und `git -C C:\CeramRox_Backups\konfig-historie push -u origin main`. Oder einen SSH-Schlüssel des Task-Benutzers verwenden.
3. Danach läuft der Push im Task ohne Rückfrage (`GIT_TERMINAL_PROMPT=0`; fehlen die Zugangsdaten, steht der Fehler im Log).

## Änderungen in Gitea ansehen

- Im Repository unter **Commits** steht pro Tag ein Eintrag „Konfig-Schnappschuss …“ mit der Liste der geänderten Dateien.
- Einen Commit öffnen zeigt den Unterschied je Datei. Hinzugefügte Zeilen sind grün, entfernte rot, z. B. ein neues Feld „Temperatur“ in der Formular-Datei.
- Die Commit-Adresse plus `.diff` am Ende liefert den ganzen Unterschied als Text, z. B.
  `https://<gitea>/<firma>/konfig-historie/commit/<hash>.diff`. Diesen Text kann man weitergeben; Claude gleicht ihn dann mit `docs/konfig-abhaengigkeiten.md` ab (Regel in `CLAUDE.md`).
- Strukturänderungen stehen in `schema.sql`.

## Grenzen

- Es wird gespeichert, **was** sich geändert hat und **an welchem Tag** (Zeitpunkt des Laufs), nicht **wer**. Die Tabellen haben meist kein „geändert von“.
- Zwischen zwei Läufen ist nur der Endstand sichtbar. Wird etwas am selben Tag geändert und zurückgenommen, erscheint nichts.
- Gelöschte Zeilen erscheinen als Löschung im Diff, aber erst beim nächsten Lauf.
- Nicht erfasst: Auftragsdaten, Messwerte, Benutzer, Rollen, Dateianhänge. Nur die Tabellen aus `tasks/029b-konfig-tabellen.md`.
- Tabellen aus 029b, die in Prod anders heißen oder fehlen, werden übersprungen und stehen in `_uebersprungen.txt`. Neue Konfigurationstabellen müssen in der Liste `$Bereiche` im Skript ergänzt werden.
