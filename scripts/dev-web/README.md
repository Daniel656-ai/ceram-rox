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

```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev\scripts\dev-web\update-dev-web.ps1"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "Dev-Web Update" -Action $action -Trigger $trigger
```

Log: `scripts\dev-web\update-dev-web.log` (letzte ca. 500 Zeilen).

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
