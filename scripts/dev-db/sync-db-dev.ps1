# Spielt neue Migrationen in die DEV-Datenbank auf dem Server ein (nie in die Produktion).
#
#   sync-db-dev.ps1 -Baseline   einmalig: alle vorhandenen Migrationen als "eingespielt" eintragen (fuehrt nichts aus)
#   sync-db-dev.ps1 -DryRun     zeigt nur, welche Dateien in welcher Reihenfolge eingespielt wuerden
#   sync-db-dev.ps1             normaler Lauf (Sicherung, einspielen, Schema-Cache neu laden)
#
# Alle Datenbankzugriffe laufen ausschliesslich per "docker exec" in den Dev-Container.
# Es gibt keine Passwoerter und keinen Zugriff ueber Ports.

[CmdletBinding()]
param(
    [switch]$Baseline,
    [switch]$DryRun,
    [switch]$Force   # nur fuer -Baseline: erlaubt Baseline, obwohl applied-migrations.txt schon Eintraege hat
)

# ---------------------------------------------------------------------------
# Feste Konfiguration (absichtlich Konstanten, keine Parameter)
# ---------------------------------------------------------------------------
$DevContainer        = "supabase_db_ceram-rox-dev"
$ProdMarker          = "vrzqlfovvdxofxqyslev"
$DevPgPort           = "55322"
$ProjectFolderName   = "ceram-rox-dev"
$StateDir            = "C:\Users\Daniel.Gass\Ceram_Rox\dev-state"
$AppliedFile         = Join-Path $StateDir "applied-migrations.txt"
$IgnoreFile          = Join-Path $StateDir "ignore-migrations.txt"
$LogFile             = Join-Path $StateDir "sync-db-dev.log"
$MaxLogLines         = 1000
$BackupDir           = "C:\CeramRox_Backups\dev\vor_migration"
$BackupsToKeep       = 5
$RepoRoot            = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MigrationDirs       = @("supabase/migrations", "drizzle/migrations")
$script:Applied      = 0

# Befehle, die nicht in einer Transaktion laufen duerfen (Pruefung nach Entfernen der Kommentare).
$NoTxPatterns = @(
    @{ Name = "CREATE INDEX CONCURRENTLY"; Regex = '\bCREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\b' },
    @{ Name = "DROP INDEX CONCURRENTLY";   Regex = '\bDROP\s+INDEX\s+CONCURRENTLY\b' },
    @{ Name = "REINDEX ... CONCURRENTLY";  Regex = '\bREINDEX\b[^;]*\bCONCURRENTLY\b' },
    @{ Name = "DETACH PARTITION CONCURRENTLY"; Regex = '\bDETACH\s+PARTITION\b[^;]*\bCONCURRENTLY\b' },
    @{ Name = "VACUUM";                    Regex = '(?im)^\s*VACUUM\b' },
    @{ Name = "CREATE/DROP DATABASE";      Regex = '\b(CREATE|DROP)\s+DATABASE\b' },
    @{ Name = "CREATE/DROP TABLESPACE";    Regex = '\b(CREATE|DROP)\s+TABLESPACE\b' },
    @{ Name = "ALTER SYSTEM";              Regex = '\bALTER\s+SYSTEM\b' }
)
# Absichtlich NICHT enthalten: ALTER TYPE ... ADD VALUE (ab PostgreSQL 12 in einer Transaktion erlaubt).

# ---------------------------------------------------------------------------
# Log
# ---------------------------------------------------------------------------
function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    try {
        if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
        $all = @(Get-Content -Path $LogFile -Encoding UTF8)
        if ($all.Count -gt $MaxLogLines) {
            $all | Select-Object -Last $MaxLogLines | Set-Content -Path $LogFile -Encoding UTF8
        }
    } catch {
        # Logging darf den Lauf nie verhindern
    }
}

function Stop-Sync([string]$Message) {
    Write-Log "FEHLER: $Message"
    throw "SYNC_ABORT"
}

# ---------------------------------------------------------------------------
# Docker: einziger Zugang zur Datenbank. Der Containername ist hart verdrahtet.
# ---------------------------------------------------------------------------
function Invoke-Native([string]$Exe, [string[]]$CmdArgs) {
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & $Exe @CmdArgs 2>&1 | Out-String
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPref
    }
    return [pscustomobject]@{ Output = $out.Trim(); ExitCode = $code }
}

function Invoke-DevExec([string[]]$ExecArgs) {
    # immer genau dieser Container, immer als Benutzer postgres in der Datenbank postgres
    return Invoke-Native "docker" (@("exec", "-e", "PGCLIENTENCODING=UTF8", $DevContainer) + $ExecArgs)
}

# ---------------------------------------------------------------------------
# Harte Sicherheitspruefung (laeuft immer zuerst; bei Abweichung Abbruch)
# ---------------------------------------------------------------------------
function Assert-DevTarget {
    # Konstanten-Selbsttest: schuetzt vor einem versehentlich geaenderten Containernamen
    if ($DevContainer -ne "supabase_db_ceram-rox-dev") { Stop-Sync "Sicherheitsabbruch: Containername in der Konfiguration ist nicht 'supabase_db_ceram-rox-dev'" }
    if ($DevContainer -like "*$ProdMarker*")           { Stop-Sync "Sicherheitsabbruch: Containername enthaelt die Produktions-Kennung" }

    if ((Split-Path $RepoRoot -Leaf) -ine $ProjectFolderName) {
        Stop-Sync "Sicherheitsabbruch: Skript liegt nicht im Projektordner '$ProjectFolderName' ($RepoRoot)"
    }

    $docker = Invoke-Native "docker" @("version", "--format", "{{.Server.Version}}")
    if ($docker.ExitCode -ne 0) { Stop-Sync "Docker nicht erreichbar: $($docker.Output)" }

    $info = Invoke-Native "docker" @("inspect", "--format", "{{.Name}}|{{.State.Running}}", $DevContainer)
    if ($info.ExitCode -ne 0) { Stop-Sync "Container '$DevContainer' nicht gefunden: $($info.Output)" }
    $parts = $info.Output.Split("|")
    if ($parts.Count -ne 2 -or $parts[0] -ne "/$DevContainer") { Stop-Sync "Sicherheitsabbruch: Containername weicht ab ($($info.Output))" }
    if ($parts[0] -like "*$ProdMarker*")                       { Stop-Sync "Sicherheitsabbruch: Produktions-Container erkannt" }
    if ($parts[1] -ne "true")                                  { Stop-Sync "Container '$DevContainer' laeuft nicht" }

    $ports = Invoke-Native "docker" @("port", $DevContainer)
    if ($ports.ExitCode -ne 0) { Stop-Sync "docker port fehlgeschlagen: $($ports.Output)" }
    if ($ports.Output -notmatch (":$DevPgPort(\s|$)")) {
        Stop-Sync "Sicherheitsabbruch: Dev-Port $DevPgPort nicht in 'docker port' gefunden ($($ports.Output))"
    }
    if ($ports.Output -match ":54322(\s|$)") { Stop-Sync "Sicherheitsabbruch: Produktions-Port 54322 am Container gefunden" }

    $db = Invoke-DevExec @("psql", "-U", "postgres", "-d", "postgres", "-tA", "-c", "SELECT 1")
    if ($db.ExitCode -ne 0 -or $db.Output -ne "1") { Stop-Sync "Datenbank im Container nicht erreichbar: $($db.Output)" }
}

# ---------------------------------------------------------------------------
# Zustand und Dateiliste
# ---------------------------------------------------------------------------
function Read-List([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    return @(Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" -and -not $_.StartsWith("#") })
}

function Get-AllMigrationKeys {
    $keys = @()
    foreach ($rel in $MigrationDirs) {
        $dir = Join-Path $RepoRoot ($rel -replace "/", "\")
        if (Test-Path -LiteralPath $dir) {
            $keys += @(Get-ChildItem -LiteralPath $dir -Filter "*.sql" -File | ForEach-Object { "$rel/$($_.Name)" })
        }
    }
    return $keys
}

# Liest Unix-Zeitstempel aus der Ausgabe von "git log --format=%ct". Leer = keine.
function Read-GitStamps($Result) {
    if ($Result.ExitCode -ne 0) { return @() }
    return @($Result.Output -split "\r?\n" | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int64]$_ })
}

# Zeitpunkt, an dem die Datei ins Repo kam. $null = nicht ermittelbar.
# 1. aeltester Add-Commit (-m: auch Merge-Commits zaehlen; --follow: Umbenennungen)
# 2. sonst aeltester Commit, der die Datei beruehrt (z. B. Datei kam durch Umnummerieren in einem Merge-Commit)
function Get-AddedTimestamp([string]$Key) {
    $stamps = Read-GitStamps (Invoke-Native "git" @("-C", $RepoRoot, "log", "-m", "--diff-filter=A", "--follow", "--format=%ct", "--", $Key))
    if ($stamps.Count -eq 0) {
        $stamps = Read-GitStamps (Invoke-Native "git" @("-C", $RepoRoot, "log", "--format=%ct", "--", $Key))
    }
    if ($stamps.Count -eq 0) { return $null }
    return ($stamps | Measure-Object -Minimum).Minimum
}

# Entfernt SQL-Kommentare (-- und /* */), damit Treffer in Kommentaren nicht zaehlen.
function Remove-SqlComments([string]$Sql) {
    $s = [regex]::Replace($Sql, '(?s)/\*.*?\*/', ' ')
    return [regex]::Replace($s, '--[^\r\n]*', ' ')
}

# Liefert die Namen der gefundenen Nicht-Transaktions-Befehle (leer = Transaktion ist ok).
function Get-NoTransactionReasons([string]$Sql) {
    $clean = Remove-SqlComments $Sql
    $found = @()
    foreach ($p in $NoTxPatterns) {
        if ([regex]::IsMatch($clean, $p.Regex, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) { $found += $p.Name }
    }
    return $found
}

function Get-PendingMigrations {
    $applied = Read-List $AppliedFile
    $ignored = Read-List $IgnoreFile
    $new = @(Get-AllMigrationKeys | Where-Object { ($applied -notcontains $_) -and ($ignored -notcontains $_) })
    $items = @()
    foreach ($key in $new) {
        $ts = Get-AddedTimestamp $key
        if ($null -eq $ts) {
            Stop-Sync "Zeitpunkt fuer '$key' nicht aus dem Git-Verlauf ermittelbar (Datei nicht eingecheckt oder flacher Klon?) - nichts wurde eingespielt"
        }
        $items += [pscustomobject]@{ Key = $key; Name = (Split-Path $key -Leaf); Time = $ts }
    }
    # drizzle-Migrationen: nie vor der Vorgaengernummer einspielen (Umnummerieren darf die Reihenfolge nicht drehen;
    # die Nummer entspricht dem idx in drizzle/migrations/meta/_journal.json).
    $prev = [int64]0
    foreach ($it in @($items | Where-Object { $_.Key -like "drizzle/*" } | Sort-Object -Property Name)) {
        if ($it.Time -lt $prev) { $it.Time = $prev }
        $prev = $it.Time
    }
    # nach Zeitpunkt im Repo, bei Gleichstand nach Dateiname
    return @($items | Sort-Object -Property @{ Expression = "Time"; Ascending = $true }, @{ Expression = "Name"; Ascending = $true })
}

# ---------------------------------------------------------------------------
# Sicherung
# ---------------------------------------------------------------------------
function New-DevBackup {
    if (-not (Test-Path -LiteralPath $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $target = Join-Path $BackupDir "dev_vor_migration_$stamp.dump"
    $inContainer = "/tmp/sync-dev-backup-$stamp.dump"
    try {
        $r = Invoke-DevExec @("pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "-f", $inContainer)
        if ($r.ExitCode -ne 0) { Stop-Sync "pg_dump fehlgeschlagen: $($r.Output)" }
        $cp = Invoke-Native "docker" @("cp", "${DevContainer}:$inContainer", $target)
        if ($cp.ExitCode -ne 0) { Stop-Sync "Sicherung konnte nicht aus dem Container kopiert werden: $($cp.Output)" }
    } finally {
        [void](Invoke-DevExec @("rm", "-f", $inContainer))
    }
    if (-not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -eq 0) {
        Stop-Sync "Sicherung ist leer oder fehlt: $target"
    }
    Write-Log "Sicherung erstellt: $target"
    Get-ChildItem -LiteralPath $BackupDir -Filter "dev_vor_migration_*.dump" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip $BackupsToKeep |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; Write-Log "Alte Sicherung entfernt: $($_.Name)" }
}

# ---------------------------------------------------------------------------
# Einzelne Migration einspielen
# ---------------------------------------------------------------------------
function Install-Migration($Item) {
    $local = Join-Path $RepoRoot ($Item.Key -replace "/", "\")
    $sql = [System.IO.File]::ReadAllText($local, [System.Text.Encoding]::UTF8)
    $reasons = @(Get-NoTransactionReasons $sql)
    $inContainer = "/tmp/sync-dev-" + [guid]::NewGuid().ToString("N") + ".sql"

    $psqlArgs = @("psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1")
    if ($reasons.Count -eq 0) {
        $psqlArgs += "-1"
        Write-Log "Spiele ein: $($Item.Key) (eine Transaktion)"
    } else {
        Write-Log "Spiele ein: $($Item.Key) OHNE Transaktion (erkannt: $($reasons -join ', '))"
    }
    $psqlArgs += @("-f", $inContainer)

    try {
        $cp = Invoke-Native "docker" @("cp", $local, "${DevContainer}:$inContainer")
        if ($cp.ExitCode -ne 0) { return [pscustomobject]@{ Ok = $false; Output = "docker cp fehlgeschlagen: $($cp.Output)"; NoTx = ($reasons.Count -gt 0) } }
        $r = Invoke-DevExec $psqlArgs
        return [pscustomobject]@{ Ok = ($r.ExitCode -eq 0); Output = $r.Output; NoTx = ($reasons.Count -gt 0) }
    } finally {
        [void](Invoke-DevExec @("rm", "-f", $inContainer))
    }
}

# ---------------------------------------------------------------------------
# Modi
# ---------------------------------------------------------------------------
function Invoke-BaselineMode {
    $existing = Read-List $AppliedFile
    if ($existing.Count -gt 0 -and -not $Force) {
        Stop-Sync "applied-migrations.txt hat schon $($existing.Count) Eintraege. -Baseline wuerde ausstehende Migrationen als erledigt markieren. Nur mit -Force wiederholen, wenn das gewollt ist."
    }
    $missing = @(Get-AllMigrationKeys | Where-Object { $existing -notcontains $_ })
    if ($DryRun) {
        Write-Log "DRYRUN Baseline: wuerde $($missing.Count) Dateien als eingespielt eintragen (nichts geschrieben, nichts ausgefuehrt)"
        return
    }
    if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $AppliedFile)) { Set-Content -LiteralPath $AppliedFile -Value @() -Encoding UTF8 }
    if (-not (Test-Path -LiteralPath $IgnoreFile))  { Set-Content -LiteralPath $IgnoreFile  -Value @() -Encoding UTF8 }
    if ($missing.Count -gt 0) { Add-Content -LiteralPath $AppliedFile -Value $missing -Encoding UTF8 }
    Write-Log "BASELINE: $($missing.Count) Migrationsdateien als eingespielt eingetragen (nichts ausgefuehrt). Zustand: $StateDir"
}

function Invoke-DryRunMode {
    $pending = @(Get-PendingMigrations)
    if ($pending.Count -eq 0) { Write-Log "DRYRUN: keine neuen Migrationen"; return }
    Write-Log "DRYRUN: $($pending.Count) Migration(en) wuerden eingespielt (nichts ausgefuehrt, keine Sicherung):"
    foreach ($item in $pending) {
        $sql = [System.IO.File]::ReadAllText((Join-Path $RepoRoot ($item.Key -replace "/", "\")), [System.Text.Encoding]::UTF8)
        $reasons = @(Get-NoTransactionReasons $sql)
        $mode = if ($reasons.Count -eq 0) { "Transaktion" } else { "OHNE Transaktion: $($reasons -join ', ')" }
        Write-Log ("  {0}  {1}  [{2}]" -f [DateTimeOffset]::FromUnixTimeSeconds([int64]$item.Time).LocalDateTime.ToString("yyyy-MM-dd HH:mm"), $item.Key, $mode)
    }
}

function Invoke-NormalMode {
    $pending = @(Get-PendingMigrations)
    if ($pending.Count -eq 0) { Write-Log "Keine neuen Migrationen"; return }
    Write-Log "$($pending.Count) neue Migration(en) gefunden"
    New-DevBackup
    try {
        foreach ($item in $pending) {
            $res = Install-Migration $item
            if (-not $res.Ok) {
                $extra = ""
                if ($res.NoTx) { $extra = " Datei lief ohne Transaktion und kann teilweise ausgefuehrt sein - Zustand pruefen oder aus der Sicherung zurueckspielen (siehe README)." }
                Write-Log "FEHLER in $($item.Key): $($res.Output)"
                Stop-Sync "Migration '$($item.Key)' fehlgeschlagen, nicht eingetragen, weitere Dateien uebersprungen.$extra"
            }
            Add-Content -LiteralPath $AppliedFile -Value $item.Key -Encoding UTF8
            $script:Applied++
            Write-Log "OK: $($item.Key) eingespielt und eingetragen"
        }
    } finally {
        if ($script:Applied -gt 0) {
            $n = Invoke-DevExec @("psql", "-U", "postgres", "-d", "postgres", "-c", "NOTIFY pgrst, 'reload schema';")
            if ($n.ExitCode -eq 0) { Write-Log "PostgREST-Schema-Cache neu geladen" }
            else { Write-Log "WARNUNG: Schema-Cache-Reload fehlgeschlagen: $($n.Output)" }
        }
    }
    Write-Log "Fertig: $($script:Applied) Migration(en) eingespielt"
}

# ---------------------------------------------------------------------------
# Hauptablauf
# ---------------------------------------------------------------------------
$exitCode = 0
$mutex = $null
$hasLock = $false
try {
    try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

    # nur ein Lauf gleichzeitig (Aufgabenplanung + manueller Aufruf)
    $mutex = New-Object System.Threading.Mutex($false, "Global\ceram-rox-dev-sync-db-dev")
    try { $hasLock = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $hasLock = $true }
    if (-not $hasLock) { Write-Log "Anderer Lauf aktiv - uebersprungen"; exit 0 }

    $mode = if ($Baseline) { "Baseline" } elseif ($DryRun) { "DryRun" } else { "Normal" }
    Write-Log "Start ($mode)"

    Assert-DevTarget

    if ($Baseline) {
        Invoke-BaselineMode
    } else {
        if (-not (Test-Path -LiteralPath $AppliedFile)) {
            Stop-Sync "applied-migrations.txt fehlt ($AppliedFile). Einmalig 'sync-db-dev.ps1 -Baseline' ausfuehren, sonst wuerden alle Altmigrationen eingespielt."
        }
        if ($DryRun) { Invoke-DryRunMode } else { Invoke-NormalMode }
    }
}
catch {
    $exitCode = 1
    if ($_.Exception.Message -ne "SYNC_ABORT") { Write-Log "FEHLER (unerwartet): $($_.Exception.Message)" }
}
finally {
    if ($mutex -ne $null) {
        if ($hasLock) { try { $mutex.ReleaseMutex() } catch { } }
        $mutex.Dispose()
    }
}
exit $exitCode
