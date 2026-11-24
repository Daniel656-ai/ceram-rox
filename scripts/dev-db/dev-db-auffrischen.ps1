# ============================================================================
# Dev-Datenbank frisch aus der Firmen-DB (Prod) kopieren
#
# - Prod wird NUR GELESEN (pg_dump und SELECT). Dort aendert sich nichts.
# - In Dev werden das Schema "public" (Tabellen, Funktionen, Policies, Daten)
#   und die Benutzerkonten (auth.users / auth.identities) durch den Prod-Stand
#   ersetzt. Dazu kommen Trigger auf auth-Tabellen und die Storage-Policies.
# - Vorher wird die komplette Dev-DB gesichert (C:\CeramRox_Backups\dev\).
# - Alles in Dev laeuft in EINER Transaktion: bei einem Fehler bleibt Dev
#   unveraendert.
# - Temporaere Dateien (enthalten Passwort-Hashes) werden am Ende geloescht.
# - Datei-Anhaenge (Storage-Dateien) werden nicht kopiert.
#
# Aufruf (PowerShell am Server):
#   1) Ohne Parameter: zeigt die Datenbank-Container an
#        powershell -ExecutionPolicy Bypass -File .\dev-db-auffrischen.ps1
#   2) Mit dem Namen des Dev-Containers:
#        powershell -ExecutionPolicy Bypass -File .\dev-db-auffrischen.ps1 -DevContainer supabase_db_XXXX
# ============================================================================

param([string]$DevContainer)

$ErrorActionPreference = 'Stop'
$Prod   = 'supabase_db_vrzqlfovvdxofxqyslev'
$Ablage = 'C:\CeramRox_Backups\dev'
$Stamp  = Get-Date -Format 'yyyyMMdd_HHmm'
$Lokal  = "C:\CeramRox_Backups\dev\tmp-$Stamp"
$Utf8   = New-Object System.Text.UTF8Encoding $false

function D {
    & docker.exe @args
    if ($LASTEXITCODE -ne 0) { throw "Docker-Befehl fehlgeschlagen: docker $($args -join ' ')" }
}
function Wert([string]$Container, [string]$Sql) {
    $r = & docker.exe exec $Container psql -U postgres -d postgres -X -At -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "Abfrage in $Container fehlgeschlagen: $Sql" }
    return (($r | Out-String).Trim())
}
function Schreibe([string]$Pfad, [string]$Text) {
    [System.IO.File]::WriteAllText($Pfad, $Text, $Utf8)
}

# --- 0. Container anzeigen, wenn kein Dev-Container angegeben ---------------
if (-not $DevContainer) {
    Write-Host "Datenbank-Container auf diesem Server:" -ForegroundColor Cyan
    & docker.exe ps --format '{{.Names}}   {{.Ports}}' | Where-Object { $_ -like 'supabase_db_*' }
    Write-Host ""
    Write-Host "Prod ist $Prod (Port 54322). Den ANDEREN Namen als -DevContainer angeben." -ForegroundColor Yellow
    exit 0
}

# --- 1. Sicherheitspruefungen -------------------------------------------------
if ($DevContainer -eq $Prod) { throw "Abbruch: -DevContainer ist der Prod-Container!" }
if ($DevContainer -notlike 'supabase_db_*') { throw "Abbruch: '$DevContainer' ist kein supabase_db_-Container." }
$ErrorActionPreference = 'Continue'
& docker.exe inspect $DevContainer *> $null
$ok = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'
if (-not $ok) { throw "Abbruch: Container '$DevContainer' nicht gefunden." }

$vProd = Wert $Prod 'SHOW server_version'
$vDev  = Wert $DevContainer 'SHOW server_version'
if ($vProd -ne $vDev) {
    throw "Abbruch: unterschiedliche PostgreSQL-Versionen (Prod $vProd, Dev $vDev). Bitte melden."
}

$zaehl = "SELECT (SELECT count(*) FROM auth.users) || ' Benutzer, ' || " +
         "(SELECT count(*) FROM public.projects) || ' Projekte, ' || " +
         "(SELECT count(*) FROM public.measurement_orders) || ' Auftraege'"

Write-Host ""
Write-Host "PROD (wird nur gelesen): $Prod" -ForegroundColor Green
Write-Host "   $(Wert $Prod $zaehl)"
Write-Host "DEV  (wird ueberschrieben): $DevContainer" -ForegroundColor Red
Write-Host "   $(Wert $DevContainer $zaehl)"
Write-Host ""
Write-Host "In DEV werden Schema public und Benutzerkonten durch den Prod-Stand ersetzt."
Write-Host "Eigene Dev-Benutzer und Dev-Testdaten gehen verloren (Sicherung wird vorher erstellt)."
$a = Read-Host "Zum Fortfahren JA eingeben"
if ($a -ne 'JA') { Write-Host "Abgebrochen, nichts geaendert."; exit 0 }

try {
    # --- 2. Sicherung der Dev-DB ---------------------------------------------
    New-Item -ItemType Directory -Force -Path $Ablage | Out-Null
    Write-Host "Sichere Dev-DB ..." -ForegroundColor Cyan
    D exec $DevContainer pg_dump -U postgres -d postgres -Fc -f /tmp/dev-vorher.dump
    D cp "${DevContainer}:/tmp/dev-vorher.dump" "$Ablage\dev-vorher-$Stamp.dump"
    D exec $DevContainer rm -f /tmp/dev-vorher.dump
    Write-Host "   -> $Ablage\dev-vorher-$Stamp.dump"

    # --- 3. Aus Prod lesen -----------------------------------------------------
    Write-Host "Lese Prod (nur lesend) ..." -ForegroundColor Cyan
    D exec $Prod rm -rf /tmp/devsync
    D exec $Prod mkdir -p /tmp/devsync

    D exec $Prod pg_dump -U postgres -d postgres --schema=public --no-owner -f /tmp/devsync/d_public.sql
    D exec $Prod pg_dump -U postgres -d postgres --data-only --table=auth.users --table=auth.identities -f /tmp/devsync/c_auth.sql
    # Schema public wird in Dev selbst angelegt
    D exec $Prod sed -i 's/^CREATE SCHEMA public;$/-- CREATE SCHEMA public;/' /tmp/devsync/d_public.sql
    # Standardrechte fuer supabase_admin darf postgres nicht setzen (werden in g_abschluss neu gesetzt)
    D exec $Prod sed -i '/^ALTER DEFAULT PRIVILEGES/d' /tmp/devsync/d_public.sql

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
    D cp "$Lokal\erzeugen.sql" "${Prod}:/tmp/devsync/erzeugen.sql"
    D exec $Prod psql -U postgres -d postgres -X -q -At -v ON_ERROR_STOP=1 -f /tmp/devsync/erzeugen.sql

    # Prod-Dateien holen und Prod sofort aufraeumen
    Remove-Item -Recurse -Force $Lokal
    D cp "${Prod}:/tmp/devsync" $Lokal
    D exec $Prod rm -rf /tmp/devsync

    # --- 4. Dev-Skripte ergaenzen ---------------------------------------------
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

    # --- 5. In Dev einspielen (eine Transaktion) -----------------------------
    Write-Host "Spiele in Dev ein (eine Transaktion) ..." -ForegroundColor Cyan
    D exec $DevContainer rm -rf /tmp/devsync
    D cp $Lokal "${DevContainer}:/tmp/devsync"
    D exec $DevContainer psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -1 -o /dev/null `
        -f /tmp/devsync/a_vorbereiten.sql `
        -f /tmp/devsync/b_ext.sql `
        -f /tmp/devsync/c_auth.sql `
        -f /tmp/devsync/d_public.sql `
        -f /tmp/devsync/e_trigger.sql `
        -f /tmp/devsync/f_policies.sql `
        -f /tmp/devsync/g_abschluss.sql

    # --- 6. Kontrolle ---------------------------------------------------------
    $p = Wert $Prod $zaehl
    $d = Wert $DevContainer $zaehl
    Write-Host ""
    Write-Host "PROD: $p"
    Write-Host "DEV : $d"
    if ($p -eq $d) { Write-Host "FERTIG - Dev entspricht jetzt Prod." -ForegroundColor Green }
    else { Write-Host "Zahlen weichen ab (in Prod wurde evtl. gerade gearbeitet) - bitte melden." -ForegroundColor Yellow }
}
catch {
    Write-Host ""
    Write-Host "FEHLER: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Dev ist unveraendert, falls der Fehler beim Einspielen kam (Transaktion zurueckgerollt)." -ForegroundColor Yellow
    Write-Host "Bitte die Meldung oberhalb komplett schicken."
}
finally {
    # Temporaere Dateien enthalten Passwort-Hashes -> immer loeschen
    $ErrorActionPreference = 'Continue'
    & docker.exe exec $Prod rm -rf /tmp/devsync *> $null
    & docker.exe exec $DevContainer rm -rf /tmp/devsync *> $null
    if (Test-Path $Lokal) { Remove-Item -Recurse -Force $Lokal }
}