# Nachtlauf: Dev-Datenbank aus der Firmen-DB (Prod) auffrischen
#
# Grundlage: dev-db-auffrischen.ps1 (Handlauf). Dieses Skript ist die automatische Fassung fuer die Aufgabenplanung.
#
# Ablauf:
#   1. Abbruch ohne Aenderung, wenn "dev-auffrischen.STOP" im Skriptordner oder im dev-state-Ordner liegt.
#   2. Task "Dev-Web Update" pausieren; am Ende IMMER wieder einschalten (auch bei Fehler).
#   3. (entfaellt: keine Sicherung der Dev-DB mehr; vorhandene dev-vorher-*.dump bleiben unberuehrt)
#   4. Prod -> Dev kopieren. Prod wird NUR GELESEN (pg_dump, SELECT). Container fest geprueft, bei Vertauschung Abbruch.
#   5. dev-statepplied-migrations.txt = Prod-Listen PLUS alle Migrationsdateien im Prod-Code-Ordner (vorher Kopie der alten Liste).
#   0. Zusaetzlich Abbruch ohne Aenderung, wenn sync-db.STOP im Prod-Ordner liegt (Prod evtl. nicht auf Stand).
#   6. sync-db-dev.ps1 spielt die reinen Dev-Migrationen ein.
#   7. Testbenutzer neu anlegen (scripts\dev-db\testuser-dev.sql, nur Dev).
#   8. dev-state\auffrischen-status.txt: Datum, OK/Fehler, Anzahl eingespielter Dev-Migrationen.
#
# Aufruf:
#   -Trockenlauf            nur pruefen und den Plan anzeigen; aendert nichts (auch keinen Task)
#   (ohne Parameter)        Handstart mit Rueckfrage "JA"
#   -OhneRueckfrage         fuer die Aufgabenplanung (Nachtlauf)
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db\dev-auffrischen-nacht.ps1 -Trockenlauf
#
# Rueckgabewert: 0 = ok (oder STOP-Datei / Trockenlauf), 1 = Fehler.

[CmdletBinding()]
param(
    [switch]$OhneRueckfrage,
    [switch]$Trockenlauf,
    [string]$ProdMigrationenDatei = "C:\Users\Daniel.Gass\Ceram_Rox\applied-migrations.txt",          # Prod: Supabase-Migrationen (<14 Ziffern>_<uuid>.sql, ohne Ordner)
    [string]$ProdDrizzleDatei     = "C:\Users\Daniel.Gass\Ceram_Rox\applied-drizzle-migrations.txt",  # Prod: drizzle-Migrationen (NNNN_name.sql, ohne Ordner)
    [string]$ProdCodeOrdner       = "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox",                       # Prod-Code (drizzle/migrations, supabase/migrations)
    [string]$ProdStopDatei        = "C:\Users\Daniel.Gass\Ceram_Rox\sync-db.STOP",                    # existiert sie, ist Prod evtl. nicht auf Stand: Abbruch
    [string]$DevContainer         = "supabase_db_ceram-rox-dev",   # nur zum Testen gegen eine Kopie aendern (siehe README)
    [string]$StateDir             = "C:\Users\Daniel.Gass\Ceram_Rox\dev-state",
    [string]$TaskName             = "Dev-Web Update"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

# ---------------------------------------------------------------------------
# Feste Konfiguration
# ---------------------------------------------------------------------------
$Prod            = "supabase_db_vrzqlfovvdxofxqyslev"
$ProdMarker      = "vrzqlfovvdxofxqyslev"
$DevStandard     = "supabase_db_ceram-rox-dev"
$DevPgPort       = "55322"
$ProdPgPort      = "54322"
$Stamp           = Get-Date -Format "yyyyMMdd_HHmmss"
$Lokal           = "C:\CeramRox_Backups\dev\tmp-$Stamp"        # eigener Tmp-Pfad (kein Kurzpfad), wird am Ende geloescht
$ScriptDir       = $PSScriptRoot
$RepoRoot        = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$StopName        = "dev-auffrischen.STOP"
$LogFile         = Join-Path $StateDir "dev-auffrischen.log"
$StatusFile      = Join-Path $StateDir "auffrischen-status.txt"
$AppliedFile     = Join-Path $StateDir "applied-migrations.txt"
$IgnoreFile      = Join-Path $StateDir "ignore-migrations.txt"
$SyncScript      = Join-Path $ScriptDir "sync-db-dev.ps1"
$TestuserSql     = Join-Path $ScriptDir "testuser-dev.sql"
$MaxLogLines     = 2000
$BakToKeep       = 7
$Utf8NoBom       = New-Object System.Text.UTF8Encoding $false
$IstStandardDev  = ($DevContainer -eq $DevStandard)

$script:Ergebnis        = "Fehler"
$script:Meldung         = "Lauf nicht abgeschlossen"
$script:DevMigrationen  = 0
$script:TaskPausiert    = $false
$script:StatusSchreiben = $true

# ---------------------------------------------------------------------------
# Log / Hilfen
# ---------------------------------------------------------------------------
function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    try {
        if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
        Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
        $all = @(Get-Content -LiteralPath $LogFile -Encoding UTF8)
        if ($all.Count -gt $MaxLogLines) { $all | Select-Object -Last $MaxLogLines | Set-Content -LiteralPath $LogFile -Encoding UTF8 }
    } catch { }
}

function Stop-Lauf([string]$Message) {
    Write-Log "FEHLER: $Message"
    $script:Meldung = $Message
    throw "AUFFRISCHEN_ABBRUCH"
}

function Invoke-Native([string]$Exe, [string[]]$CmdArgs) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & $Exe @CmdArgs 2>&1 | ForEach-Object { "$_" } | Out-String
        $code = $LASTEXITCODE
    } catch {
        $out = "$($_.Exception.Message)"; $code = 127
    } finally { $ErrorActionPreference = $old }
    return [pscustomobject]@{ ExitCode = $code; Output = $out.TrimEnd() }
}

# Docker-Aufruf, bei Fehler Abbruch (Ausgabe wird verworfen, ausser bei -Rueckgabe)
function D([string[]]$DockerArgs) {
    $r = Invoke-Native "docker" $DockerArgs
    if ($r.ExitCode -ne 0) { Stop-Lauf "docker $($DockerArgs -join ' ') fehlgeschlagen: $($r.Output)" }
    return $r.Output
}

function Wert([string]$Container, [string]$Sql) {
    $r = Invoke-Native "docker" @("exec", "-e", "PGCLIENTENCODING=UTF8", $Container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-c", $Sql)
    if ($r.ExitCode -ne 0) { Stop-Lauf "Abfrage in $Container fehlgeschlagen: $Sql ($($r.Output))" }
    return $r.Output.Trim()
}

function Schreibe([string]$Pfad, [string]$Text) {
    [System.IO.File]::WriteAllText($Pfad, ($Text -replace "`r`n", "`n"), $Utf8NoBom)
}

function Read-List([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    return @(Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" -and -not $_.StartsWith("#") })
}

# Migrationsdateien eines Code-Ordners (Dev-Repo oder Prod-Code) im Schluesselformat der Dev-Liste.
function Get-CodeKeys([string]$Root) {
    if (-not $Root -or -not (Test-Path -LiteralPath $Root)) { Stop-Lauf "Prod-Code-Ordner nicht gefunden: $Root (-ProdCodeOrdner)" }
    if ((Resolve-Path -LiteralPath $Root).Path.TrimEnd("\") -ieq $RepoRoot.TrimEnd("\")) { Stop-Lauf "-ProdCodeOrdner darf nicht das Dev-Repo sein." }
    $keys = @()
    foreach ($rel in @("supabase/migrations", "drizzle/migrations")) {
        $dir = Join-Path $Root ($rel -replace "/", "\")
        if (-not (Test-Path -LiteralPath $dir)) { Stop-Lauf "Im Prod-Code fehlt der Ordner $rel ($Root)" }
        $keys += @(Get-ChildItem -LiteralPath $dir -Filter "*.sql" -File | ForEach-Object { "$rel/$($_.Name)" })
    }
    return $keys
}

function Get-RepoKeys {
    $keys = @()
    foreach ($rel in @("supabase/migrations", "drizzle/migrations")) {
        $dir = Join-Path $RepoRoot ($rel -replace "/", "\")
        if (Test-Path -LiteralPath $dir) {
            $keys += @(Get-ChildItem -LiteralPath $dir -Filter "*.sql" -File | ForEach-Object { "$rel/$($_.Name)" })
        }
    }
    return $keys
}

# ---------------------------------------------------------------------------
# Prod-Migrationslisten einlesen (Formate unterscheiden sich; unbekanntes Format = Abbruch)
# ---------------------------------------------------------------------------
# Supabase: "supabase/migrations/<14 Ziffern>_<name>.sql" | "<14 Ziffern>_<name>[.sql]" | nur "<14 Ziffern>" (Version)
function ConvertTo-SupabaseKey([string]$Line, [string[]]$RepoKeys) {
    $n = $Line.Trim() -replace "\\", "/"
    $n = $n -replace "^supabase/migrations/", ""
    $n = $n -replace "\.sql$", ""
    if ($n -match '^\d{14}_[A-Za-z0-9_.-]+$') { return "supabase/migrations/$n.sql" }
    if ($n -match '^\d{14}$') {
        $m = @($RepoKeys | Where-Object { $_ -like "supabase/migrations/${n}_*" })
        if ($m.Count -eq 1) { return $m[0] }
        return "UNBEKANNT:$Line"
    }
    return "UNBEKANNT:$Line"
}

# drizzle: "drizzle/migrations/<NNNN>_<name>.sql" | "<NNNN>_<name>[.sql]"
function ConvertTo-DrizzleKey([string]$Line) {
    $n = $Line.Trim() -replace "\\", "/"
    $n = $n -replace "^drizzle/migrations/", ""
    $n = $n -replace "\.sql$", ""
    if ($n -match '^\d{4}_[A-Za-z0-9_]+$') { return "drizzle/migrations/$n.sql" }
    return "UNBEKANNT:$Line"
}

function Read-ProdListe([string]$Pfad, [string]$Art, [string[]]$RepoKeys) {
    if (-not $Pfad) { Stop-Lauf "Pfad der Prod-Liste fuer $Art nicht angegeben (-ProdMigrationenDatei / -ProdDrizzleDatei)." }
    if (-not (Test-Path -LiteralPath $Pfad)) { Stop-Lauf "Prod-Liste fuer $Art nicht gefunden: $Pfad" }
    $zeilen = @(Read-List $Pfad)
    if ($zeilen.Count -eq 0) { Stop-Lauf "Prod-Liste fuer $Art ist leer: $Pfad (kein Ueberschreiben mit einer leeren Liste)" }
    $keys = @()
    $unbekannt = @()
    foreach ($z in $zeilen) {
        $k = if ($Art -eq "supabase") { ConvertTo-SupabaseKey $z $RepoKeys } else { ConvertTo-DrizzleKey $z }
        if ($k.StartsWith("UNBEKANNT:")) { $unbekannt += $z } else { $keys += $k }
    }
    if ($unbekannt.Count -gt 0) {
        Stop-Lauf "Prod-Liste $Art ($Pfad): $($unbekannt.Count) Zeile(n) im unbekannten Format, z. B. '$($unbekannt[0])'. Nichts geaendert. Bitte Format melden."
    }
    return @($keys | Sort-Object -Unique)
}

# ---------------------------------------------------------------------------
# Task "Dev-Web Update"
# ---------------------------------------------------------------------------
function Suspend-DevWebTask {
    $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -eq $t) { Write-Log "HINWEIS: Task '$TaskName' nicht gefunden - nichts zu pausieren."; return }
    # laeuft er gerade, bis zu 15 Minuten warten
    $deadline = (Get-Date).AddMinutes(15)
    while ($t.State -eq "Running") {
        if ((Get-Date) -gt $deadline) { Stop-Lauf "Task '$TaskName' laeuft seit ueber 15 Minuten - Abbruch ohne Aenderung." }
        Write-Log "Task '$TaskName' laeuft gerade - warte ..."
        Start-Sleep -Seconds 15
        $t = Get-ScheduledTask -TaskName $TaskName
    }
    try { Disable-ScheduledTask -TaskName $TaskName | Out-Null }
    catch { Stop-Lauf "Task '$TaskName' konnte nicht pausiert werden (Administratorrechte noetig): $($_.Exception.Message)" }
    $script:TaskPausiert = $true
    Write-Log "Task '$TaskName' pausiert."
}

function Resume-DevWebTask {
    if (-not $script:TaskPausiert) { return }
    try {
        Enable-ScheduledTask -TaskName $TaskName | Out-Null
        Write-Log "Task '$TaskName' wieder eingeschaltet."
        $script:TaskPausiert = $false
    } catch {
        Write-Log "WARNUNG: Task '$TaskName' konnte NICHT wieder eingeschaltet werden: $($_.Exception.Message). BITTE VON HAND EINSCHALTEN."
    }
}

# ---------------------------------------------------------------------------
# Sicherheitspruefungen (vor jeder Aenderung)
# ---------------------------------------------------------------------------
function Assert-Container {
    if ($DevContainer -eq $Prod -or $DevContainer -like "*$ProdMarker*") { Stop-Lauf "Sicherheitsabbruch: -DevContainer ist der Prod-Container." }
    if ($DevContainer -notmatch '^supabase_db_[A-Za-z0-9_.-]+$')           { Stop-Lauf "Sicherheitsabbruch: '$DevContainer' ist kein supabase_db_-Container." }
    if ($Prod -ne "supabase_db_vrzqlfovvdxofxqyslev")                       { Stop-Lauf "Sicherheitsabbruch: Prod-Containername in der Konfiguration veraendert." }

    $docker = Invoke-Native "docker" @("version", "--format", "{{.Server.Version}}")
    if ($docker.ExitCode -ne 0) { Stop-Lauf "Docker nicht erreichbar: $($docker.Output)" }

    foreach ($c in @($Prod, $DevContainer)) {
        $i = Invoke-Native "docker" @("inspect", "--format", "{{.Name}}|{{.State.Running}}", $c)
        if ($i.ExitCode -ne 0) { Stop-Lauf "Container '$c' nicht gefunden: $($i.Output)" }
        $p = $i.Output.Split("|")
        if ($p.Count -ne 2 -or $p[0] -ne "/$c") { Stop-Lauf "Sicherheitsabbruch: Containername weicht ab ($($i.Output))" }
        if ($p[1] -ne "true") { Stop-Lauf "Container '$c' laeuft nicht." }
    }

    # Ports: Prod muss auf 54322 laufen, Dev darf NIE auf 54322 haengen (Vertauschung erkennen)
    $pp = Invoke-Native "docker" @("port", $Prod)
    if ($pp.ExitCode -ne 0 -or $pp.Output -notmatch (":$ProdPgPort(\s|$)")) {
        Stop-Lauf "Sicherheitsabbruch: Prod-Container hat nicht den erwarteten Port $ProdPgPort ($($pp.Output))"
    }
    $dp = Invoke-Native "docker" @("port", $DevContainer)
    if ($dp.ExitCode -ne 0) { Stop-Lauf "docker port fehlgeschlagen: $($dp.Output)" }
    if ($dp.Output -match (":$ProdPgPort(\s|$)")) { Stop-Lauf "Sicherheitsabbruch: Dev-Container haengt am Prod-Port $ProdPgPort (Vertauschung?)" }
    if ($IstStandardDev -and $dp.Output -notmatch (":$DevPgPort(\s|$)")) {
        Stop-Lauf "Sicherheitsabbruch: Dev-Port $DevPgPort nicht gefunden ($($dp.Output))"
    }

    $vProd = Wert $Prod "SHOW server_version"
    $vDev  = Wert $DevContainer "SHOW server_version"
    if ($vProd -ne $vDev) { Stop-Lauf "Abbruch: unterschiedliche PostgreSQL-Versionen (Prod $vProd, Dev $vDev)." }
}

# ---------------------------------------------------------------------------
# Hauptablauf
# ---------------------------------------------------------------------------
$script:Exit = 1
$script:mutex = $null
$script:hasLock = $false
function Invoke-Hauptablauf {
    Write-Log "=== Dev-Auffrischen gestartet (Dev: $DevContainer, Trockenlauf: $($Trockenlauf.IsPresent)) ==="

    # 1. STOP-Datei (vor allem anderen)
    foreach ($d in @($ScriptDir, $StateDir)) {
        if (Test-Path -LiteralPath (Join-Path $d $StopName)) {
            Write-Log "STOP-Datei gefunden ($d\$StopName) - Abbruch ohne Aenderung."
            $script:Ergebnis = "UEBERSPRUNGEN"; $script:Meldung = "STOP-Datei gefunden"; $script:StatusSchreiben = $false   # Status bleibt unveraendert
            $script:Exit = 0
            return
        }
    }

    # STOP-Datei des Prod-Abgleichs: Prod ist evtl. nicht auf Stand
    if (Test-Path -LiteralPath $ProdStopDatei) {
        Write-Log "Prod-STOP-Datei gefunden ($ProdStopDatei) - Prod evtl. nicht auf Stand. Abbruch ohne Aenderung."
        $script:Ergebnis = "UEBERSPRUNGEN"; $script:Meldung = "sync-db.STOP gefunden"; $script:StatusSchreiben = $false
        $script:Exit = 0
        return
    }

    # nur ein Lauf gleichzeitig
    $script:mutex = New-Object System.Threading.Mutex($false, "Global\ceram-rox-dev-auffrischen")
    try { $script:hasLock = $script:mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $script:hasLock = $true }
    if (-not $script:hasLock) {
        Write-Log "Anderer Lauf aktiv - uebersprungen."
        $script:StatusSchreiben = $false; $script:Exit = 0
        return
    }

    # Vorpruefungen (nichts wird geaendert)
    Assert-Container
    $repoKeys = @(Get-RepoKeys)
    if ($repoKeys.Count -eq 0) { Stop-Lauf "Keine Migrationsdateien im Repo gefunden ($RepoRoot)." }
    $prodSupabase = @(Read-ProdListe $ProdMigrationenDatei "supabase" $repoKeys)
    $prodDrizzle  = @(Read-ProdListe $ProdDrizzleDatei "drizzle" $repoKeys)
    $prodAlle     = @($prodSupabase + $prodDrizzle | Sort-Object -Unique)
    # Migrationsdateien, die auch im Prod-Code liegen, gelten ebenfalls als eingespielt (schliesst Luecken der Prod-Listen,
    # z. B. Seed-Migrationen). Nachgespielt wird nur, was ausschliesslich im Dev-Repo liegt.
    $codeKeys     = @(Get-CodeKeys $ProdCodeOrdner)
    $neueListe    = @($prodAlle + $codeKeys | Sort-Object -Unique)
    $ignored      = @(Read-List $IgnoreFile)
    $nurDev       = @($repoKeys | Where-Object { ($neueListe -notcontains $_) -and ($ignored -notcontains $_) })
    $nurProd      = @($neueListe | Where-Object { $repoKeys -notcontains $_ })
    $nurCode      = @($codeKeys | Where-Object { $prodAlle -notcontains $_ })
    Write-Log ("Prod-Listen: {0} Supabase- und {1} drizzle-Migrationen. Prod-Code: {2} Dateien, davon {3} nicht in den Listen (werden ergaenzt). Neue Dev-Liste: {4}. Im Dev-Repo: {5}, davon nur in Dev: {6}. In Prod-Liste/-Code, aber nicht im Dev-Repo: {7}." -f `
        $prodSupabase.Count, $prodDrizzle.Count, $codeKeys.Count, $nurCode.Count, $neueListe.Count, $repoKeys.Count, $nurDev.Count, $nurProd.Count)
    foreach ($k in $nurCode) { Write-Log "  ergaenzt aus Prod-Code (nicht in den Prod-Listen): $k" }
    if ($IstStandardDev) {
        foreach ($f in @($SyncScript, $TestuserSql)) { if (-not (Test-Path -LiteralPath $f)) { Stop-Lauf "Datei fehlt: $f" } }
    }

    $zaehl = "SELECT (SELECT count(*) FROM auth.users) || ' Benutzer, ' || " +
             "(SELECT count(*) FROM public.projects) || ' Projekte, ' || " +
             "(SELECT count(*) FROM public.measurement_orders) || ' Auftraege'"
    Write-Log "PROD (wird nur gelesen): $Prod - $(Wert $Prod $zaehl)"
    Write-Log "DEV  (wird ueberschrieben): $DevContainer - $(Wert $DevContainer $zaehl)"

    if ($Trockenlauf) {
        Write-Log "TROCKENLAUF - es wuerde passieren:"
        Write-Log "  1. Task '$TaskName' pausieren (am Ende wieder einschalten)"
        Write-Log "  2. Schema public + Benutzerkonten aus $Prod nach $DevContainer kopieren (Prod nur lesend)"
        if ($IstStandardDev) {
            Write-Log "  3. $AppliedFile (Kopie der alten Liste) neu setzen: $($neueListe.Count) Eintraege (Prod-Listen + Prod-Code), bisher $(@(Read-List $AppliedFile).Count)"
            Write-Log "  4. sync-db-dev.ps1: $($nurDev.Count) reine Dev-Migrationen einspielen:"
            foreach ($k in $nurDev) { Write-Log "       $k" }
            Write-Log "  5. Testbenutzer aus testuser-dev.sql anlegen"
            Write-Log "  6. Status nach $StatusFile"
        } else {
            Write-Log "  (Nicht-Standard-Dev-Container: Schritte Migrationsliste, sync-db-dev, Testbenutzer und Status wuerden uebersprungen)"
        }
        $script:Ergebnis = "TROCKENLAUF"; $script:Meldung = "keine Aenderung"; $script:StatusSchreiben = $false
        $script:Exit = 0
        return
    }

    if (-not $OhneRueckfrage) {
        Write-Host ""
        Write-Host "In DEV ($DevContainer) werden Schema public und Benutzerkonten durch den Prod-Stand ersetzt." -ForegroundColor Yellow
        $a = Read-Host "Zum Fortfahren JA eingeben"
        if ($a -cne "JA") { Write-Log "Abgebrochen durch Benutzer, nichts geaendert."; $script:StatusSchreiben = $false; $script:Exit = 0; return }
    }

    # 2. Task pausieren
    Suspend-DevWebTask

    # 4. Prod -> Dev (Prod nur lesend)
    Write-Log "Lese Prod (nur lesend) ..."
    [void](D @("exec", $Prod, "rm", "-rf", "/tmp/devsync"))
    [void](D @("exec", $Prod, "mkdir", "-p", "/tmp/devsync"))
    [void](D @("exec", $Prod, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema=public", "--no-owner", "-f", "/tmp/devsync/d_public.sql"))
    [void](D @("exec", $Prod, "pg_dump", "-U", "postgres", "-d", "postgres", "--data-only", "--table=auth.users", "--table=auth.identities", "-f", "/tmp/devsync/c_auth.sql"))
    # Schema public wird in Dev selbst angelegt; Standardrechte fuer supabase_admin darf postgres nicht setzen
    [void](D @("exec", $Prod, "sed", "-i", 's/^CREATE SCHEMA public;$/-- CREATE SCHEMA public;/', "/tmp/devsync/d_public.sql"))
    [void](D @("exec", $Prod, "sed", "-i", '/^ALTER DEFAULT PRIVILEGES/d', "/tmp/devsync/d_public.sql"))

    New-Item -ItemType Directory -Force -Path $Lokal | Out-Null
    Schreibe "$Lokal\erzeugen.sql" @'
SET search_path = '';
\o /tmp/devsync/b_ext.sql
SELECT format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA public;', e.extname)
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE n.nspname = 'public';
\o /tmp/devsync/e_trigger.sql
SELECT format('DROP TRIGGER IF EXISTS %I ON %s;', t.tgname, t.tgrelid::regclass)
       || E'\n' || pg_get_triggerdef(t.oid) || ';'
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c      ON c.oid  = t.tgrelid
JOIN pg_catalog.pg_namespace n  ON n.oid  = c.relnamespace
JOIN pg_catalog.pg_proc p       ON p.oid  = t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname <> 'public' AND pn.nspname = 'public';
\o /tmp/devsync/f_policies.sql
SELECT format('DROP POLICY IF EXISTS %I ON %I.%I;', policyname, schemaname, tablename)
       || E'\n'
       || format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                 policyname, schemaname, tablename, permissive, cmd,
                 (SELECT string_agg(quote_ident(r), ', ') FROM unnest(roles) r))
       || coalesce(' USING (' || qual || ')', '')
       || coalesce(' WITH CHECK (' || with_check || ')', '')
       || ';'
FROM pg_catalog.pg_policies
WHERE schemaname = 'storage';
\o
'@
    [void](D @("cp", "$Lokal\erzeugen.sql", "${Prod}:/tmp/devsync/erzeugen.sql"))
    [void](D @("exec", $Prod, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/devsync/erzeugen.sql"))

    # Prod-Dateien holen
    Remove-Item -Recurse -Force $Lokal
    [void](D @("cp", "${Prod}:/tmp/devsync", $Lokal))

    Schreibe "$Lokal\a_vorbereiten.sql" @'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
TRUNCATE auth.users CASCADE;
'@
    Schreibe "$Lokal\g_abschluss.sql" @'
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
'@

    Write-Log "Spiele in Dev ein (eine Transaktion) ..."
    [void](D @("exec", $DevContainer, "rm", "-rf", "/tmp/devsync"))
    [void](D @("cp", $Lokal, "${DevContainer}:/tmp/devsync"))
    [void](D @("exec", $DevContainer, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-1", "-o", "/dev/null",
        "-f", "/tmp/devsync/a_vorbereiten.sql", "-f", "/tmp/devsync/b_ext.sql", "-f", "/tmp/devsync/c_auth.sql", "-f", "/tmp/devsync/d_public.sql",
        "-f", "/tmp/devsync/e_trigger.sql", "-f", "/tmp/devsync/f_policies.sql", "-f", "/tmp/devsync/g_abschluss.sql"))
    $p = Wert $Prod $zaehl
    $d = Wert $DevContainer $zaehl
    Write-Log "Kontrolle - PROD: $p | DEV: $d"
    if ($p -ne $d) { Write-Log "HINWEIS: Zahlen weichen ab (in Prod wurde evtl. gerade gearbeitet)." }

    if ($IstStandardDev) {
        # 5. Migrationsliste = Prod-Stand
        if (Test-Path -LiteralPath $AppliedFile) {
            $bak = Join-Path $StateDir ("applied-migrations.bak-{0}.txt" -f $Stamp)
            Copy-Item -LiteralPath $AppliedFile -Destination $bak
            Write-Log "Kopie der alten Liste: $bak"
            # nur Dateien mit genau diesem Namensmuster aufraeumen, die neuesten behalten
            $alt = @(Get-ChildItem -LiteralPath $StateDir -File | Where-Object { $_.Name -match '^applied-migrations\.bak-\d{8}_\d{6}\.txt$' } | Sort-Object Name -Descending)
            if ($alt.Count -gt $BakToKeep) { $alt | Select-Object -Skip $BakToKeep | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force } }
        }
        $kopf = "# Von dev-auffrischen-nacht.ps1 am {0} aus den Prod-Listen gesetzt" -f (Get-Date -Format "yyyy-MM-dd HH:mm")
        Schreibe $AppliedFile ($kopf + "`n" + ($neueListe -join "`n") + "`n")
        Write-Log "applied-migrations.txt gesetzt: $($neueListe.Count) Eintraege."
        $vorher = @(Read-List $AppliedFile).Count

        # 6. reine Dev-Migrationen einspielen
        Write-Log "Rufe sync-db-dev.ps1 auf ($($nurDev.Count) erwartet) ..."
        $sync = Invoke-Native "powershell" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $SyncScript)
        foreach ($l in @($sync.Output -split "`r?`n" | Where-Object { $_ -ne "" })) { Write-Log "  sync-db-dev: $l" }
        $nachher = @(Read-List $AppliedFile).Count
        $script:DevMigrationen = $nachher - $vorher
        if ($sync.ExitCode -ne 0) { Stop-Lauf "sync-db-dev.ps1 meldet Fehler (Rueckgabewert $($sync.ExitCode)); eingespielt: $($script:DevMigrationen) von $($nurDev.Count)." }
        Write-Log "Dev-Migrationen eingespielt: $($script:DevMigrationen) (erwartet $($nurDev.Count))."
        if ($script:DevMigrationen -ne $nurDev.Count) { Write-Log "HINWEIS: Anzahl weicht von der Erwartung ab - Log von sync-db-dev pruefen." }

        # 7. Testbenutzer (nur Dev)
        Write-Log "Lege Testbenutzer neu an ..."
        [void](D @("cp", $TestuserSql, "${DevContainer}:/tmp/devsync/testuser-dev.sql"))
        [void](D @("exec", $DevContainer, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", "nur_dev=ja", "-f", "/tmp/devsync/testuser-dev.sql"))
        Write-Log "Testbenutzer angelegt."
    } else {
        Write-Log "Nicht-Standard-Dev-Container: Migrationsliste, sync-db-dev und Testbenutzer uebersprungen."
        $script:StatusSchreiben = $false
    }

    $script:Ergebnis = "OK"; $script:Meldung = "Dev entspricht Prod, Dev-Migrationen eingespielt"
    $script:Exit = 0
}

try { Invoke-Hauptablauf }
catch {
    if ($_.Exception.Message -ne "AUFFRISCHEN_ABBRUCH") {
        $script:Meldung = "Unerwartet: $($_.Exception.Message)"
        Write-Log "FEHLER (unerwartet): $($_.Exception.Message)"
    }
    $script:Ergebnis = "Fehler"
    $script:Exit = 1
}
finally {
    # Task IMMER wieder einschalten
    Resume-DevWebTask
    # temporaere Dateien (enthalten Passwort-Hashes) immer loeschen
    $ErrorActionPreference = "Continue"
    if ($script:hasLock -and -not $Trockenlauf) {
        [void](Invoke-Native "docker" @("exec", $Prod, "rm", "-rf", "/tmp/devsync"))
        [void](Invoke-Native "docker" @("exec", $DevContainer, "rm", "-rf", "/tmp/devsync"))
    }
    if (Test-Path -LiteralPath $Lokal) { Remove-Item -Recurse -Force -LiteralPath $Lokal -ErrorAction SilentlyContinue }
    # 8. Statusdatei
    if ($script:StatusSchreiben -and $IstStandardDev) {
        try {
            $status = @(
                ("Datum: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")),
                ("Ergebnis: {0}" -f $script:Ergebnis),
                ("Dev-Migrationen eingespielt: {0}" -f $script:DevMigrationen),
                ("Meldung: {0}" -f $script:Meldung)
            )
            if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
            Schreibe $StatusFile (($status -join "`n") + "`n")
        } catch { Write-Log "WARNUNG: Statusdatei nicht schreibbar: $($_.Exception.Message)" }
    }
    if ($script:mutex -ne $null) {
        if ($script:hasLock) { try { $script:mutex.ReleaseMutex() } catch { } }
        $script:mutex.Dispose()
    }
    Write-Log "=== beendet: $($script:Ergebnis) (Rueckgabewert $script:Exit) ==="
}
exit $script:Exit
