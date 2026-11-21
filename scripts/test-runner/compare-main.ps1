# Fuehrt einzelne Testdateien auf origin/main aus, ohne den Arbeitsbaum anzufassen.
# Gebraucht vom Subagent test-runner, um "durch die Aenderung kaputt" von "schon auf main kaputt" zu unterscheiden.
#
# Aufruf (auch aus Git Bash):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-runner/compare-main.ps1 `
#     -Scratch <Scratch-Verzeichnis> -Files src/test/a.test.ts,src/test/b.test.tsx
#
# Ablauf: Worktree von origin/main im Scratch-Verzeichnis, node_modules per Junction aus dem Repo,
# vitest auf den Dateien. Danach ZUERST die Junction loesen und pruefen, dass sie weg ist, erst dann den Worktree
# entfernen. Aufgeraeumt wird nur, was dieser Lauf selbst angelegt hat.
# Exit-Code: 0 = auf main gruen, 1 = auf main rot, 2 = Skriptfehler (Ergebnis nicht verwertbar).
# Meldungen bewusst ohne Umlaute (Windows PowerShell 5.1 liest die Datei sonst falsch).

param(
  [Parameter(Mandatory = $true)][string]$Scratch,
  [Parameter(Mandatory = $true)][string[]]$Files
)

$ErrorActionPreference = 'Stop'

# Mit -File kommt "a,b" als ein String an: selbst aufteilen.
$Files = @($Files | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($Files.Count -eq 0) { Write-Output "compare-main: keine Dateien angegeben"; exit 2 }

$repo = (git rev-parse --show-toplevel).Trim() -replace '/', '\'
$wt = Join-Path $Scratch 'main-wt'
$junction = Join-Path $wt 'node_modules'
$createdWorktree = $false
$createdJunction = $false
$code = 2

try {
  if (Test-Path -LiteralPath $wt) {
    throw "$wt existiert schon (Rest eines frueheren Laufs?). Nichts wird angefasst - bitte von Hand pruefen."
  }
  New-Item -ItemType Directory -Force -Path $Scratch | Out-Null
  git fetch -q origin main
  if ($LASTEXITCODE -ne 0) { throw "git fetch origin main fehlgeschlagen" }
  git worktree add -q $wt origin/main
  if ($LASTEXITCODE -ne 0) { throw "git worktree add fehlgeschlagen" }
  $createdWorktree = $true
  New-Item -ItemType Junction -Path $junction -Target (Join-Path $repo 'node_modules') | Out-Null
  $createdJunction = $true

  $missing = @($Files | Where-Object { -not (Test-Path -LiteralPath (Join-Path $wt $_)) })
  if ($missing.Count -gt 0) { Write-Output ("compare-main: auf origin/main nicht vorhanden (neue Datei?): " + ($missing -join ', ')) }
  $Files = @($Files | Where-Object { $missing -notcontains $_ })
  if ($Files.Count -eq 0) { throw "keine der Dateien existiert auf origin/main" }

  Push-Location $wt
  try {
    $ErrorActionPreference = 'Continue'   # vitest schreibt auf stderr; es zaehlt nur der Exit-Code
    npx vitest run @Files
    $code = if ($LASTEXITCODE -eq 0) { 0 } else { 1 }
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }
} catch {
  Write-Output "compare-main: Skriptfehler: $($_.Exception.Message)"
  $code = 2
}

# Aufraeumen: nur Selbst-Angelegtes; jeder Fehler hier macht das Ergebnis unbrauchbar (Exit 2).
try {
  if ($createdJunction -and (Test-Path -LiteralPath $junction)) {
    $item = Get-Item -LiteralPath $junction -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "$junction ist keine Junction - Worktree bleibt stehen, nichts wird geloescht."
    }
    $item.Delete()   # entfernt nur den Verweis, nicht den Inhalt von node_modules
    if (Test-Path -LiteralPath $junction) { throw "Junction $junction besteht noch - Worktree bleibt stehen." }
  }
  if ($createdWorktree) {
    if (Test-Path -LiteralPath $junction) { throw "$junction existiert noch - Worktree bleibt stehen." }
    git worktree remove --force $wt
    if ($LASTEXITCODE -ne 0) { throw "git worktree remove fehlgeschlagen" }
    git worktree prune
  }
} catch {
  Write-Output "compare-main: Fehler beim Aufraeumen: $($_.Exception.Message)"
  $code = 2
}

Write-Output "compare-main: Exit-Code = $code (0 = main gruen, 1 = main rot, 2 = Skriptfehler)"
exit $code
