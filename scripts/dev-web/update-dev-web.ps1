# Haelt die Dev-Umgebung auf dem Server aktuell (Aufgabenplanung "Dev-Web Update", alle 10 Min.):
#   1. Projektordner ceram-rox-dev aktualisieren (git pull --ff-only, nie zuruecksetzen)
#   2. Aufgabe "Dev-Web Server" neu starten, wenn sich serve-dev-web.py geaendert hat
#   3. Dev-Datenbank synchronisieren (scripts\dev-db\sync-db-dev.ps1, nur Dev-DB)
#   4. Web-Vorschau ceram-rox-dev-web auf origin/dev-web setzen
# Ein Fehler in einem Schritt verhindert die anderen nicht. Die Produktion (ceram-rox) wird nie angefasst.

$BaseDir     = "C:\Users\Daniel.Gass\Ceram_Rox"
$ProjectDir  = Join-Path $BaseDir "ceram-rox-dev"
$WebDir      = Join-Path $BaseDir "ceram-rox-dev-web"
$WebBranch   = "dev-web"
$ServerTask  = "Dev-Web Server"
$RemotePattern = 'daniel\.gass/ceram-rox-dev(\.git)?/?$'
$LogFile     = Join-Path $PSScriptRoot "update-dev-web.log"
$MaxLines    = 500
$script:HadError = $false

function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    try {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
        $all = @(Get-Content -Path $LogFile -Encoding UTF8)
        if ($all.Count -gt $MaxLines) {
            $all | Select-Object -Last $MaxLines | Set-Content -Path $LogFile -Encoding UTF8
        }
    } catch {
        # Logging darf das Update nie verhindern
    }
}

function Write-StepError([string]$Message) {
    $script:HadError = $true
    Write-Log "FEHLER: $Message"
}

# Fuehrt git im angegebenen Ordner aus. Liefert Text und Exit-Code.
function Invoke-Git([string]$Dir, [string[]]$GitArgs) {
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & git -C $Dir @GitArgs 2>&1 | Out-String
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPref
    }
    return [pscustomobject]@{ Output = $out.Trim(); ExitCode = $code }
}

# Sicherheitspruefung vor jedem Git-Befehl: richtiger Ordner, richtiger Remote.
# Gibt $null bei Erfolg zurueck, sonst den Grund fuer den Abbruch.
function Test-GitTarget([string]$Dir, [string]$ExpectedName) {
    if (-not (Test-Path -LiteralPath $Dir -PathType Container)) {
        return "Ordner existiert nicht: $Dir (siehe README)"
    }
    $full = (Get-Item -LiteralPath $Dir).FullName.TrimEnd('\')
    $expectedFull = Join-Path $BaseDir $ExpectedName
    if ($full -ine $expectedFull -or (Split-Path $full -Leaf) -ine $ExpectedName) {
        return "Ordner '$full' ist nicht '$expectedFull' - Abbruch"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $full ".git"))) {
        return "'$full' ist kein Git-Ordner"
    }
    $remote = Invoke-Git $full @("remote", "get-url", "origin")
    if ($remote.ExitCode -ne 0) {
        return "Remote 'origin' nicht lesbar: $($remote.Output)"
    }
    if ($remote.Output -notmatch $RemotePattern) {
        return "Remote zeigt nicht auf daniel.gass/ceram-rox-dev: $($remote.Output)"
    }
    return $null
}

# ---------------------------------------------------------------------------
# Schritt 1: Projektordner aktualisieren (nur fetch + pull --ff-only, nie zuruecksetzen)
# ---------------------------------------------------------------------------
$ServeScript = Join-Path $ProjectDir "scripts\dev-web\serve-dev-web.py"
$HashBefore  = $null
$HashAfter   = $null
try {
    $problem = Test-GitTarget $ProjectDir "ceram-rox-dev"
    if ($problem) {
        Write-StepError "Projektordner uebersprungen: $problem"
    } else {
        if (Test-Path -LiteralPath $ServeScript) {
            $HashBefore = (Get-FileHash -LiteralPath $ServeScript -Algorithm SHA256).Hash
        }
        $fetch = Invoke-Git $ProjectDir @("fetch", "origin")
        if ($fetch.ExitCode -ne 0) {
            Write-StepError "Projektordner: git fetch fehlgeschlagen: $($fetch.Output)"
        } else {
            $pull = Invoke-Git $ProjectDir @("pull", "--ff-only")
            if ($pull.ExitCode -ne 0) {
                $hint = "Pull fehlgeschlagen (nichts wurde zurueckgesetzt)."
                if ($pull.Output -match "config\.toml") {
                    $hint = "config.toml hat sich im Repo geaendert - Dev-Ports bitte manuell uebertragen (siehe README)."
                }
                Write-StepError "Projektordner: $hint Git: $($pull.Output)"
            } else {
                Write-Log "OK Projektordner: $($pull.Output)"
            }
        }
        if (Test-Path -LiteralPath $ServeScript) {
            $HashAfter = (Get-FileHash -LiteralPath $ServeScript -Algorithm SHA256).Hash
        }
    }
} catch {
    Write-StepError "Projektordner: $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# Schritt 2: Webserver neu starten, wenn sich serve-dev-web.py geaendert hat
# ---------------------------------------------------------------------------
try {
    if ($HashBefore -and $HashAfter -and $HashBefore -ne $HashAfter) {
        Stop-ScheduledTask -TaskName $ServerTask -ErrorAction Stop
        Start-Sleep -Seconds 2
        Start-ScheduledTask -TaskName $ServerTask -ErrorAction Stop
        Write-Log "OK Server: serve-dev-web.py hat sich geaendert - Aufgabe '$ServerTask' neu gestartet"
    } else {
        Write-Log "OK Server: kein Neustart noetig"
    }
} catch {
    Write-StepError "Server-Neustart ('$ServerTask'): $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# Schritt 3: Dev-Datenbank synchronisieren (neue Migrationen nur in die DEV-DB)
# Eigener Prozess: ein Fehler oder Abbruch dort stoppt die Web-Vorschau nicht.
# Details und Log: scripts\dev-db\README.md, C:\Users\Daniel.Gass\Ceram_Rox\dev-state\sync-db-dev.log
# ---------------------------------------------------------------------------
try {
    $SyncScript = Join-Path $ProjectDir "scripts\dev-db\sync-db-dev.ps1"
    if (-not (Test-Path -LiteralPath $SyncScript)) {
        Write-StepError "DB-Sync uebersprungen: $SyncScript nicht gefunden"
    } else {
        $syncOut = & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $SyncScript 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            Write-StepError "DB-Sync fehlgeschlagen (Exit $LASTEXITCODE), Web-Vorschau wird trotzdem aktualisiert. Siehe sync-db-dev.log. $($syncOut.Trim())"
        } else {
            $lastLine = ($syncOut.Trim() -split "\r?\n" | Select-Object -Last 1)
            Write-Log "OK DB-Sync: $lastLine"
        }
    }
} catch {
    Write-StepError "DB-Sync: $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# Schritt 4: Web-Vorschau aktualisieren (reset --hard nur hier, im Web-Ordner)
# ---------------------------------------------------------------------------
try {
    $problem = Test-GitTarget $WebDir "ceram-rox-dev-web"
    if ($problem) {
        Write-StepError "Web-Vorschau uebersprungen: $problem"
    } else {
        $fetch = Invoke-Git $WebDir @("fetch", "origin", $WebBranch)
        if ($fetch.ExitCode -ne 0) {
            Write-StepError "Web-Vorschau: git fetch fehlgeschlagen: $($fetch.Output)"
        } else {
            $reset = Invoke-Git $WebDir @("reset", "--hard", "origin/$WebBranch")
            if ($reset.ExitCode -ne 0) {
                Write-StepError "Web-Vorschau: git reset fehlgeschlagen: $($reset.Output)"
            } else {
                Write-Log "OK Web-Vorschau: $($reset.Output)"
            }
        }
    }
} catch {
    Write-StepError "Web-Vorschau: $($_.Exception.Message)"
}

if ($script:HadError) { exit 1 }
exit 0
