# Taeglicher Konfigurations-Schnappschuss (nur lesend)
#
# Exportiert die Konfigurationstabellen (Formulare, Dienstleistungen, Workflows, Vorlagen, Rohstoffe, Einstellungen;
# siehe tasks/029b-konfig-tabellen.md, Abschnitte 1-5) als sortierte JSON-Dateien und das Schema "public" als schema.sql
# in einen lokalen Git-Ordner. Pro Lauf gibt es nur dann einen Commit, wenn sich etwas geaendert hat.
#
#   powershell -ExecutionPolicy Bypass -File konfig-snapshot.ps1                                   # Prod (Standard)
#   powershell -ExecutionPolicy Bypass -File konfig-snapshot.ps1 -Container supabase_db_ceram-rox-dev   # Test gegen Dev
#   ... -RemoteUrl https://gitea.example.local/firma/konfig-historie.git                           # danach git push
#
# Sicherheit:
#  - Die Datenbank wird nur per "docker exec ... psql" (SELECT, \o) und "pg_dump --schema-only" gelesen.
#    psql laeuft mit default_transaction_read_only=on; jeder Schreibversuch scheitert. Kein neuer DB-Benutzer.
#  - Im Container entsteht kurz der Ordner /tmp/konfig-snapshot (keine DB-Aenderung); er wird am Ende geloescht.
#  - Spalten, deren Name nach Passwort/Token/Schluessel klingt, werden im Export durch "***" ersetzt.
#  - Keine Zugangsdaten im Skript. Eine -RemoteUrl mit Benutzer:Passwort wird abgelehnt (Anmeldung ueber
#    Windows-Anmeldeinformationen oder SSH-Schluessel des ausfuehrenden Benutzers).
#
# Rueckgabewert: 0 = ok, 1 = Fehler (nichts committet), 3 = lokal committet, aber Push fehlgeschlagen.

[CmdletBinding()]
param(
    [string]$Container = "supabase_db_vrzqlfovvdxofxqyslev",   # Standard: Prod. Zum Testen: supabase_db_ceram-rox-dev
    [string]$Ziel      = "C:\CeramRox_Backups\konfig-historie",
    [string]$RemoteUrl = "",
    [string]$LogDatei  = "",                                   # Standard: konfig-snapshot.log neben dem Zielordner
    [switch]$KeinGit,                                          # nur exportieren, nicht committen (Test)
    [string]$AusOrdner = ""                                    # Test: fertigen Export aus diesem Ordner verwenden (keine DB)
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------
$Stamp        = Get-Date -Format "yyyyMMdd_HHmmss"
$ContainerTmp = "/tmp/konfig-snapshot"
$HostTmp      = Join-Path ([System.IO.Path]::GetTempPath()) "konfig-snapshot-$Stamp"
$MaxLogLines  = 2000
$MaskPattern  = "pass|secret|token|api_?key|credential|private_key"
$Utf8NoBom    = New-Object System.Text.UTF8Encoding $false
if (-not $LogDatei) { $LogDatei = Join-Path (Split-Path -Parent $Ziel) "konfig-snapshot.log" }

# Bereiche und Tabellen laut tasks/029b-konfig-tabellen.md (Abschnitte 1-5).
# Elternobjekt: je Eintrag eine eigene Datei (Name + id); Kindtabellen mit passender Fremdschluessel-Spalte
# stehen in dieser Datei, alle uebrigen Tabellen des Bereichs als <Tabelle>.json.
$Bereiche = @(
    @{ Ordner = "1-dienstleistungen"; Eltern = "measurement_services"; NameSpalte = "service_name"; EntitaetenOrdner = "dienstleistungen"; FkSpalten = @("service_id", "measurement_service_id")
       Tabellen = @("measurement_services","service_data_fields","service_blocks","service_field_templates","service_forms","service_form_links","service_form_layouts","service_document_templates","service_rules","service_versions","service_workflows","service_workflow_definitions","service_workflow_steps","service_workflow_step_services","service_parameter_definitions","mdl_service_permissions","process_templates","process_steps","process_step_raw_materials","service_packages","service_package_items") },
    @{ Ordner = "2-formulare"; Eltern = "form_definitions"; NameSpalte = "name"; EntitaetenOrdner = "formulare"; FkSpalten = @("form_id", "form_definition_id")
       Tabellen = @("form_definitions","form_fields","form_calculations","form_field_permissions","form_role_views","order_kind_form_templates","global_objects","global_fields","global_lists","global_list_items","global_list_attributes","global_validations","global_calculations","form_definition_versions") },
    @{ Ordner = "3-vorlagen"; Eltern = ""; Tabellen = @("measurement_templates","measurement_template_items","label_templates","custom_symbols") },
    @{ Ordner = "4-rohstoffe-rezepturen"; Eltern = ""; Tabellen = @("raw_materials","raw_material_analyses","storage_locations","consumables","mixtures","mixture_recipe_items","mixture_recipe_versions","mixture_process_sections","mixture_process_steps","mixture_planned_measurements") },
    @{ Ordner = "5-einstellungen"; Eltern = ""; Tabellen = @("company_settings","sync_settings","hazard_notification_recipients","work_package_categories","project_expense_categories","production_release_settings","test_equipment","workstations","workstation_tasks") }
)

# ---------------------------------------------------------------------------
# Log
# ---------------------------------------------------------------------------
function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    try {
        $dir = Split-Path -Parent $LogDatei
        if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Add-Content -LiteralPath $LogDatei -Value $line -Encoding UTF8
        $all = @(Get-Content -LiteralPath $LogDatei -Encoding UTF8)
        if ($all.Count -gt $MaxLogLines) { $all | Select-Object -Last $MaxLogLines | Set-Content -LiteralPath $LogDatei -Encoding UTF8 }
    } catch { }   # Logging darf den Lauf nie verhindern
}

function Stop-Lauf([string]$Message) {
    Write-Log "FEHLER: $Message"
    throw "KONFIG_ABBRUCH"
}

# ---------------------------------------------------------------------------
# Programme aufrufen (stderr wird nicht zum PowerShell-Fehler)
# ---------------------------------------------------------------------------
function Invoke-Native([string]$Exe, [string[]]$CmdArgs) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & $Exe @CmdArgs 2>&1 | ForEach-Object { "$_" } | Out-String
        $code = $LASTEXITCODE
    } catch {
        # Programm nicht gefunden o. ae.: wie ein fehlgeschlagener Aufruf behandeln, nicht abstuerzen
        $out = "$($_.Exception.Message)"
        $code = 127
    } finally { $ErrorActionPreference = $old }
    return [pscustomobject]@{ ExitCode = $code; Output = $out.TrimEnd() }
}

# psql im Container, ausschliesslich lesend (read-only-Transaktionen erzwungen).
function Invoke-Psql([string[]]$PsqlArgs) {
    $a = @("exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on", $Container,
           "psql", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1") + $PsqlArgs
    return Invoke-Native "docker" $a
}

function Get-Lines([string]$Text) {
    return @($Text -split "`r?`n" | Where-Object { $_ -ne "" })
}

# ---------------------------------------------------------------------------
# SQL-Bausteine
# ---------------------------------------------------------------------------
function Test-Ident([string]$Name) {
    if ($Name -notmatch '^[a-z][a-z0-9_]*$') { Stop-Lauf "Ungueltiger Bezeichner: $Name" }
}

# Zeile als JSON, Spalten mit Passwort/Token-Namen maskiert.
function Get-MaskSql([string]$Alias) {
    return "(SELECT jsonb_object_agg(e.key, CASE WHEN e.key ~* '$MaskPattern' THEN to_jsonb('***'::text) ELSE e.value END) FROM jsonb_each(to_jsonb($Alias)) e)"
}

function Get-OrderSql([string]$Alias, [bool]$HasId) {
    if ($HasId) { return "$Alias.id" }
    return "to_jsonb($Alias)::text"
}

# Ersetzt Umlaute ohne Sonderzeichen im Befehl (chr-Codes), damit die Kodierung keine Rolle spielt.
function Get-SlugSql([string]$Col) {
    $e = "lower($Col)"
    foreach ($p in @(@(228,'ae'),@(246,'oe'),@(252,'ue'),@(223,'ss'),@(196,'ae'),@(214,'oe'),@(220,'ue'))) {
        $e = "replace($e, chr($($p[0])), '$($p[1])')"
    }
    return "left(trim(both '-' from regexp_replace($e, '[^a-z0-9]+', '-', 'g')), 60)"
}

# ---------------------------------------------------------------------------
# Export aus der Datenbank in $HostTmp
# ---------------------------------------------------------------------------
function Export-Datenbank {
    $docker = Invoke-Native "docker" @("version", "--format", "{{.Server.Version}}")
    if ($docker.ExitCode -ne 0) { Stop-Lauf "Docker nicht erreichbar: $($docker.Output)" }

    if ($Container -notmatch '^supabase_db_[A-Za-z0-9_.-]+$') { Stop-Lauf "Unerwarteter Containername: $Container" }
    $info = Invoke-Native "docker" @("inspect", "--format", "{{.State.Running}}", $Container)
    if ($info.ExitCode -ne 0 -or $info.Output -ne "true") { Stop-Lauf "Container '$Container' nicht gefunden oder nicht gestartet: $($info.Output)" }

    $ro = Invoke-Psql @("-c", "SHOW default_transaction_read_only")
    if ($ro.ExitCode -ne 0 -or $ro.Output.Trim() -ne "on") { Stop-Lauf "Read-only-Modus nicht aktiv (Antwort: $($ro.Output)). Abbruch, es wird nichts gelesen." }
    $ver = Invoke-Psql @("-c", "SHOW server_version")
    Write-Log "Container $Container, PostgreSQL $($ver.Output.Trim()), nur lesend."

    # --- vorhandene Tabellen und Spalten ------------------------------------
    $alle = @($Bereiche | ForEach-Object { $_.Tabellen } | ForEach-Object { $_ })
    foreach ($t in $alle) { Test-Ident $t }
    $arr = "ARRAY[" + (($alle | ForEach-Object { "'$_'" }) -join ",") + "]"
    $r = Invoke-Psql @("-c", "SELECT t FROM unnest($arr) AS t WHERE to_regclass('public.' || t) IS NOT NULL ORDER BY 1")
    if ($r.ExitCode -ne 0) { Stop-Lauf "Tabellenliste konnte nicht gelesen werden: $($r.Output)" }
    $vorhanden = @(Get-Lines $r.Output)
    $fehlen = @($alle | Where-Object { $vorhanden -notcontains $_ })
    foreach ($t in $fehlen) { Write-Log "UEBERSPRUNGEN: Tabelle public.$t gibt es in dieser Datenbank nicht." }
    if ($vorhanden.Count -eq 0) { Stop-Lauf "Keine der erwarteten Tabellen gefunden. Falscher Container?" }

    $r = Invoke-Psql @("-c", "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($arr)")
    if ($r.ExitCode -ne 0) { Stop-Lauf "Spalten konnten nicht gelesen werden: $($r.Output)" }
    $spalten = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($l in (Get-Lines $r.Output)) { [void]$spalten.Add($l.Trim()) }

    # --- Skript fuer psql und Ordner im Container aufbauen -------------------
    $sql = New-Object System.Text.StringBuilder
    [void]$sql.AppendLine("SET default_transaction_read_only = on;")
    $dirs = New-Object System.Collections.Generic.List[string]
    $erwartet = New-Object System.Collections.Generic.List[string]   # relative Dateipfade (/)
    $dirs.Add($ContainerTmp)

    function Add-Abfrage([string]$RelPfad, [string]$Select) {
        [void]$sql.AppendLine("\o $ContainerTmp/$RelPfad")
        [void]$sql.AppendLine("$Select;")
        [void]$sql.AppendLine("\o")
        $erwartet.Add($RelPfad)
    }

    foreach ($b in $Bereiche) {
        $tabs = @($b.Tabellen | Where-Object { $vorhanden -contains $_ })
        if ($tabs.Count -eq 0) { continue }
        $dirs.Add("$ContainerTmp/$($b.Ordner)")
        $beanspracht = @{}

        $eltern = $b.Eltern
        $entitaeten = @()
        if ($eltern -and ($vorhanden -contains $eltern) -and $spalten.Contains("$eltern.id") -and $spalten.Contains("$eltern.$($b.NameSpalte)")) {
            $nameCol = $b.NameSpalte
            $q = "SELECT id::text || '|' || coalesce($(Get-SlugSql $nameCol), '') FROM public.$eltern ORDER BY id"
            $r = Invoke-Psql @("-c", $q)
            if ($r.ExitCode -ne 0) { Stop-Lauf "Liste $eltern fehlgeschlagen: $($r.Output)" }
            $entitaeten = @(Get-Lines $r.Output)

            # Kindtabellen mit passender Fremdschluessel-Spalte
            $kinder = @()
            foreach ($t in $tabs) {
                if ($t -eq $eltern) { continue }
                foreach ($fk in $b.FkSpalten) {
                    if ($spalten.Contains("$t.$fk")) { $kinder += @{ Tabelle = $t; Fk = $fk }; $beanspracht[$t] = $true; break }
                }
            }
            $beanspracht[$eltern] = $true
            $dirs.Add("$ContainerTmp/$($b.Ordner)/$($b.EntitaetenOrdner)")
            if ($kinder.Count -gt 0) { $dirs.Add("$ContainerTmp/$($b.Ordner)/_ohne-zuordnung") }

            foreach ($zeile in $entitaeten) {
                $teile = $zeile -split '\|', 2
                $id = $teile[0].Trim()
                $slug = if ($teile.Count -gt 1 -and $teile[1].Trim()) { $teile[1].Trim() } else { "ohne-name" }
                if ($id -notmatch '^[0-9a-f-]{36}$') { Stop-Lauf "Unerwartete id in ${eltern}: $id" }
                $teile2 = @("'$eltern', $(Get-MaskSql 'f')")
                foreach ($k in $kinder) {
                    $ord = Get-OrderSql 'x' ($spalten.Contains("$($k.Tabelle).id"))
                    $teile2 += "'$($k.Tabelle)', (SELECT coalesce(jsonb_agg($(Get-MaskSql 'x') ORDER BY $ord), '[]'::jsonb) FROM public.$($k.Tabelle) x WHERE x.$($k.Fk) = f.id)"
                }
                $select = "SELECT jsonb_pretty(jsonb_build_object($($teile2 -join ', '))) FROM public.$eltern f WHERE f.id = '$id'"
                Add-Abfrage "$($b.Ordner)/$($b.EntitaetenOrdner)/${slug}__$id.json" $select
            }
            foreach ($k in $kinder) {
                $ord = Get-OrderSql 'x' ($spalten.Contains("$($k.Tabelle).id"))
                $select = "SELECT jsonb_pretty(coalesce(jsonb_agg($(Get-MaskSql 'x') ORDER BY $ord), '[]'::jsonb)) FROM public.$($k.Tabelle) x WHERE NOT EXISTS (SELECT 1 FROM public.$eltern p WHERE p.id = x.$($k.Fk))"
                Add-Abfrage "$($b.Ordner)/_ohne-zuordnung/$($k.Tabelle).json" $select
            }
        }

        foreach ($t in $tabs) {
            if ($beanspracht.ContainsKey($t)) { continue }
            $ord = Get-OrderSql 't' ($spalten.Contains("$t.id"))
            $select = "SELECT jsonb_pretty(coalesce(jsonb_agg($(Get-MaskSql 't') ORDER BY $ord), '[]'::jsonb)) FROM public.$t t"
            Add-Abfrage "$($b.Ordner)/$t.json" $select
        }
    }

    New-Item -ItemType Directory -Force -Path $HostTmp | Out-Null
    $scriptLokal = Join-Path $HostTmp "export.sql"
    [System.IO.File]::WriteAllText($scriptLokal, ($sql.ToString() -replace "`r`n", "`n"), $Utf8NoBom)

    # --- im Container ausfuehren ---------------------------------------------
    [void](Invoke-Native "docker" @("exec", $Container, "rm", "-rf", $ContainerTmp))
    $mk = Invoke-Native "docker" (@("exec", $Container, "mkdir", "-p") + @($dirs))
    if ($mk.ExitCode -ne 0) { Stop-Lauf "Arbeitsordner im Container nicht anlegbar: $($mk.Output)" }
    $cp = Invoke-Native "docker" @("cp", $scriptLokal, "${Container}:$ContainerTmp/export.sql")
    if ($cp.ExitCode -ne 0) { Stop-Lauf "docker cp (Skript) fehlgeschlagen: $($cp.Output)" }

    Write-Log "Exportiere $($erwartet.Count) JSON-Dateien ..."
    $run = Invoke-Psql @("-q", "-f", "$ContainerTmp/export.sql")
    if ($run.ExitCode -ne 0) { Stop-Lauf "Export fehlgeschlagen (nichts wird committet): $($run.Output)" }

    # --- Schema-Dump (nur public, nur Struktur) ------------------------------
    $dump = Invoke-Native "docker" @("exec", $Container, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--schema=public", "--no-owner", "-f", "$ContainerTmp/schema.sql")
    if ($dump.ExitCode -ne 0) { Stop-Lauf "pg_dump --schema-only fehlgeschlagen: $($dump.Output)" }

    # --- zurueckholen --------------------------------------------------------
    $neu = Join-Path $HostTmp "export"
    $cp = Invoke-Native "docker" @("cp", "${Container}:$ContainerTmp", $neu)
    if ($cp.ExitCode -ne 0) { Stop-Lauf "docker cp (Export) fehlgeschlagen: $($cp.Output)" }
    Remove-Item -LiteralPath (Join-Path $neu "export.sql") -Force -ErrorAction SilentlyContinue

    # Pruefung: jede erwartete Datei da und nicht leer
    $fehler = @()
    foreach ($rel in $erwartet) {
        $f = Join-Path $neu ($rel -replace "/", "\")
        if (-not (Test-Path -LiteralPath $f) -or (Get-Item -LiteralPath $f).Length -eq 0) { $fehler += $rel }
    }
    if ($fehler.Count -gt 0) { Stop-Lauf "Export unvollstaendig, fehlende/leere Dateien: $($fehler -join ', ')" }
    $schemaFile = Join-Path $neu "schema.sql"
    if (-not (Test-Path -LiteralPath $schemaFile) -or (Get-Item -LiteralPath $schemaFile).Length -eq 0) { Stop-Lauf "schema.sql fehlt oder ist leer." }

    # Neuere pg_dump-Versionen schreiben zufaellige \restrict-Zeilen; die wuerden jeden Tag einen Scheinunterschied erzeugen.
    $zeilen = [System.IO.File]::ReadAllLines($schemaFile, $Utf8NoBom) | Where-Object { $_ -notmatch '^\\(un)?restrict\s' }
    [System.IO.File]::WriteAllText($schemaFile, (($zeilen -join "`n") + "`n"), $Utf8NoBom)

    $liste = @("Tabellen, die in dieser Datenbank nicht vorhanden sind (uebersprungen):") + @($fehlen)
    if ($fehlen.Count -eq 0) { $liste = @("Keine uebersprungenen Tabellen.") }
    [System.IO.File]::WriteAllText((Join-Path $neu "_uebersprungen.txt"), (($liste -join "`n") + "`n"), $Utf8NoBom)

    Write-Log "Export fertig: $($erwartet.Count) Dateien + schema.sql, $($fehlen.Count) Tabellen uebersprungen."
    return $neu
}

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------
function Invoke-Git([string[]]$GitArgs) {
    $r = Invoke-Native "git" (@("-C", $Ziel) + $GitArgs)
    return $r
}

function Update-Repo([string]$Neu) {
    if (-not (Test-Path -LiteralPath $Ziel)) { New-Item -ItemType Directory -Path $Ziel -Force | Out-Null }
    $istRepo = Test-Path -LiteralPath (Join-Path $Ziel ".git")
    if ($istRepo -eq $false -and -not $KeinGit) {
        $r = Invoke-Git @("init")
        if ($r.ExitCode -ne 0) { Stop-Lauf "git init fehlgeschlagen: $($r.Output)" }
        [void](Invoke-Git @("symbolic-ref", "HEAD", "refs/heads/main"))
        Write-Log "Neues Git-Repository angelegt: $Ziel"
    }
    if (-not $KeinGit) {
        [void](Invoke-Git @("config", "core.autocrlf", "false"))   # Bytes unveraendert halten
        [System.IO.File]::WriteAllText((Join-Path $Ziel ".gitattributes"), "* -text`n", $Utf8NoBom)
    }

    # Alten Inhalt (ausser .git und .gitattributes) ersetzen, damit geloeschte Formulare als Loeschung erscheinen.
    Get-ChildItem -LiteralPath $Ziel -Force | Where-Object { $_.Name -notin @(".git", ".gitattributes") } | Remove-Item -Recurse -Force
    Copy-Item -Path (Join-Path $Neu "*") -Destination $Ziel -Recurse -Force
    if ($KeinGit) { Write-Log "Export liegt in $Ziel (ohne Git)."; return 0 }

    $r = Invoke-Git @("add", "-A")
    if ($r.ExitCode -ne 0) { Stop-Lauf "git add fehlgeschlagen: $($r.Output)" }
    $st = Invoke-Git @("status", "--porcelain")
    if (-not $st.Output.Trim()) { Write-Log "Keine Aenderungen seit dem letzten Lauf, kein Commit."; $changed = $false }
    else {
        $stat = (Invoke-Git @("diff", "--cached", "--stat")).Output
        $msg = "Konfig-Schnappschuss {0} ({1})`n`n{2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm"), $Container, $stat
        $msgFile = Join-Path $HostTmp "commitmsg.txt"
        [System.IO.File]::WriteAllText($msgFile, $msg, $Utf8NoBom)
        $c = Invoke-Git @("-c", "user.name=konfig-snapshot", "-c", "user.email=konfig-snapshot@localhost", "commit", "-q", "-F", $msgFile)
        if ($c.ExitCode -ne 0) { Stop-Lauf "git commit fehlgeschlagen: $($c.Output)" }
        $h = (Invoke-Git @("rev-parse", "--short", "HEAD")).Output
        Write-Log "Commit $h mit Aenderungen:`n$stat"
        $changed = $true
    }

    if ($RemoteUrl) {
        if ($RemoteUrl -match '://[^/@]*:[^/@]*@') {
            Write-Log "PUSH-FEHLER: -RemoteUrl enthaelt Zugangsdaten (Benutzer:Passwort). Nicht erlaubt. Lokaler Commit bleibt."
            return 3
        }
        $rem = Invoke-Git @("remote", "get-url", "origin")
        if ($rem.ExitCode -ne 0) { [void](Invoke-Git @("remote", "add", "origin", $RemoteUrl)) }
        elseif ($rem.Output.Trim() -ne $RemoteUrl) { [void](Invoke-Git @("remote", "set-url", "origin", $RemoteUrl)) }
        $env:GIT_TERMINAL_PROMPT = "0"   # nie auf eine Eingabe warten
        $p = Invoke-Git @("push", "-u", "origin", "main")
        if ($p.ExitCode -ne 0) {
            Write-Log "PUSH-FEHLER (lokaler Commit bleibt): $($p.Output)"
            return 3
        }
        Write-Log "Push nach $($RemoteUrl -replace '://[^/@]*@', '://') erfolgreich."
    }
    return 0
}

# ---------------------------------------------------------------------------
# Hauptablauf
# ---------------------------------------------------------------------------
$exit = 1
try {
    Write-Log "=== Konfig-Schnappschuss gestartet (Container $Container, Ziel $Ziel) ==="
    if (-not $KeinGit) {
        $g = Invoke-Native "git" @("--version")
        if ($g.ExitCode -ne 0) { Stop-Lauf "git nicht gefunden: $($g.Output)" }
    }
    if ($AusOrdner) {
        if (-not (Test-Path -LiteralPath $AusOrdner)) { Stop-Lauf "-AusOrdner nicht gefunden: $AusOrdner" }
        New-Item -ItemType Directory -Force -Path $HostTmp | Out-Null
        $neu = $AusOrdner
    } else {
        $neu = @(Export-Datenbank)[-1]
    }
    $exit = @(Update-Repo $neu)[-1]
    Write-Log "=== fertig (Rueckgabewert $exit) ==="
}
catch {
    if ($_.Exception.Message -ne "KONFIG_ABBRUCH") { Write-Log "FEHLER: $($_.Exception.Message)" }
    Write-Log "=== abgebrochen, es wurde nichts committet ==="
    $exit = 1
}
finally {
    # Aufraeumen: Arbeitsordner im Container und lokaler Temp-Ordner
    if (-not $AusOrdner) { [void](Invoke-Native "docker" @("exec", $Container, "rm", "-rf", $ContainerTmp)) }
    if (Test-Path -LiteralPath $HostTmp) { Remove-Item -Recurse -Force -LiteralPath $HostTmp -ErrorAction SilentlyContinue }
}
exit $exit
