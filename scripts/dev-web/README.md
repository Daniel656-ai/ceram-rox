# Dev-Web-Vorschau – Einrichtung am Server

Nach jedem Merge auf `main` baut GitHub Actions (`.github/workflows/dev-web.yml`) die Web-App
gegen die Dev-Supabase und schreibt das Ergebnis in den Branch `dev-web`. Gitea spiegelt den
Branch; der Server holt ihn alle 10 Minuten und liefert ihn auf Port 8090 aus.

Vorschau: `http://172.30.100.162:8090` (aktueller Stand: `/build-info.json`)

Alle Befehle in PowerShell auf dem Server (172.30.100.162).

## 0. Voraussetzung (einmalig, in GitHub)

Repository-Variablen unter Settings → Secrets and variables → Actions → **Variables**:

- `DEV_SUPABASE_URL` = `http://172.30.100.162:55321`
- `DEV_SUPABASE_PUBLISHABLE_KEY` = Publishable Key der Dev-Instanz

## 1. Branch `dev-web` einmalig klonen

```powershell
git clone --branch dev-web --single-branch http://atfrt-git:3000/daniel.gass/ceram-rox-dev.git "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev-web"
```

(Der Branch existiert erst nach dem ersten erfolgreichen Workflow-Lauf; ggf. in GitHub unter
Actions → "Build Dev Web" manuell starten und Gitea-Mirror abwarten.)

## 2. Aufgabe: Update alle 10 Minuten

`update-dev-web.ps1` hält die komplette Dev-Umgebung aktuell. Reihenfolge pro Lauf:

1. **Projektordner** `ceram-rox-dev`: `git fetch` + `git pull --ff-only` (es wird nie etwas zurückgesetzt
   oder überschrieben; lokale Anpassungen bleiben erhalten).
2. **Webserver neu starten**, falls sich `serve-dev-web.py` geändert hat (Aufgabe „Dev-Web Server“
   wird gestoppt und wieder gestartet).
3. **Dev-Datenbank synchronisieren**: `scripts\dev-db\sync-db-dev.ps1` spielt neue Migrationen nur in die
   Dev-DB ein (Einrichtung und Ablauf: `scripts/dev-db/README.md`). Ein Fehler dort stoppt Schritt 4 nicht.
4. **Web-Vorschau** `ceram-rox-dev-web`: `git fetch` + `git reset --hard origin/dev-web`
   (`reset --hard` nur in diesem Ordner).

Ein Fehler in einem Schritt verhindert die anderen nicht. Vor jedem Git-Befehl prüft das Skript, dass
der Ordner wirklich `ceram-rox-dev` bzw. `ceram-rox-dev-web` ist und `origin` auf
`daniel.gass/ceram-rox-dev` zeigt. Die Produktion (`ceram-rox`) wird nie angefasst.

```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev\scripts\dev-web\update-dev-web.ps1"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "Dev-Web Update" -Action $action -Trigger $trigger
```

Log: `scripts\dev-web\update-dev-web.log` (letzte ca. 500 Zeilen, wird von Git ignoriert).

## 3. Aufgabe: Webserver bei Anmeldung (wie Extruder-/Staucher-App)

Statt `python.exe` den **vollen Pfad** zum selben Python wie bei der Extruder-App verwenden
(Pfad z. B. mit `(Get-Command python).Source` ermitteln):

```powershell
$python  = (Get-Command python).Source
$action  = New-ScheduledTaskAction -Execute $python `
  -Argument '"C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev\scripts\dev-web\serve-dev-web.py"'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "Daniel.Gass"
Register-ScheduledTask -TaskName "Dev-Web Server" -Action $action -Trigger $trigger
Start-ScheduledTask -TaskName "Dev-Web Server"
```

## 4. Netzwerk

Ports **8090** (Web-Vorschau) und **55321** (Dev-Supabase-API) müssen im Firmennetz erreichbar
sein (Windows-Firewall-Regeln eingehend). Port 54321 (Produktion) wird nie verwendet.

## 5. Wenn sich `supabase/config.toml` im Repo ändert

Im Projektordner ist `supabase/config.toml` lokal mit den Dev-Ports (553xx) angepasst und mit
`--skip-worktree` markiert. Ändert sich die Datei im Repo, schlägt `git pull --ff-only` fehl; im Log steht
dann „config.toml hat sich im Repo geändert – Dev-Ports bitte manuell übertragen“. Das Update der
Web-Vorschau läuft trotzdem weiter. So übernimmst du die Änderung:

```powershell
cd "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev"

# 1. Lokale Anpassung sichern
Copy-Item supabase\config.toml "$env:TEMP\config.toml.dev"

# 2. Markierung aufheben und lokale Änderung verwerfen (nur diese eine Datei)
git update-index --no-skip-worktree supabase/config.toml
git checkout -- supabase/config.toml

# 3. Neuen Stand holen
git pull --ff-only

# 4. Dev-Ports wieder eintragen: Datei öffnen und mit der gesicherten Version
#    ($env:TEMP\config.toml.dev) abgleichen (553xx statt 543xx), dann Markierung wieder setzen
notepad supabase\config.toml
git update-index --skip-worktree supabase/config.toml

# 5. Prüfen: config.toml darf nicht als geändert erscheinen
git status
```

Die Befehle `git checkout --` und `--no-skip-worktree` führst du bewusst von Hand aus; das Update-Skript
tut das nie. Danach Supabase nur neu starten, wenn sich Ports oder Dienste geändert haben.
