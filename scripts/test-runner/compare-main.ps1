# Führt einzelne Testdateien auf origin/main aus, ohne den Arbeitsbaum anzufassen.
# Gebraucht vom Subagent test-runner, um "durch die Änderung kaputt" von "schon auf main kaputt" zu unterscheiden.
#
# Aufruf (auch aus Git Bash):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-runner/compare-main.ps1 `
#     -Scratch <Scratch-Verzeichnis> -Files src/test/a.test.ts,src/test/b.test.tsx
#
# Ablauf: Worktree von origin/main im Scratch-Verzeichnis, node_modules per Junction aus dem Repo,
# vitest auf den Dateien, danach ZUERST die Junction lösen und prüfen, dass sie weg ist, erst dann den Worktree entfernen.
# Exit-Code: der von vitest (0 = auf main grün, sonst rot); 2 = Skriptfehler.

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

function Remove-JunctionSafely {
  if (Test-Path -LiteralPath $junction) {
    $item = Get-Item -LiteralPath $junction -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "$junction ist keine Junction - Abbruch, nichts wird gelöscht."
    }
    $item.Delete()   # entfernt nur den Verweis, nicht den Inhalt von node_modules
  }
  if (Test-Path -LiteralPath $junction) { throw "Junction $junction besteht noch - Worktree wird NICHT entfernt." }
}

$code = 2
try {
  if (Test-Path -LiteralPath $wt) { throw "$wt existiert schon (Rest eines früheren Laufs?) - bitte prüfen und von Hand entfernen." }
  New-Item -ItemType Directory -Force -Path $Scratch | Out-Null
  git fetch -q origin main
  git worktree add -q $wt origin/main
  if ($LASTEXITCODE -ne 0) { throw "git worktree add fehlgeschlagen" }
  New-Item -ItemType Junction -Path $junction -Target (Join-Path $repo 'node_modules') | Out-Null

  $missing = @($Files | Where-Object { -not (Test-Path -LiteralPath (Join-Path $wt $_)) })
  if ($missing.Count -gt 0) { Write-Output ("compare-main: auf origin/main nicht vorhanden (neue Datei?): " + ($missing -join ', ')) }
  $Files = @($Files | Where-Object { $missing -notcontains $_ })
  if ($Files.Count -eq 0) { throw "keine der Dateien existiert auf origin/main" }

  Push-Location $wt
  try {
    $ErrorActionPreference = 'Continue'   # vitest schreibt auf stderr; Exit-Code zählt
    npx vitest run @Files
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }
} catch {
  Write-Output "compare-main: Skriptfehler: $($_.Exception.Message)"
  $code = 2
} finally {
  Remove-JunctionSafely
  if (Test-Path -LiteralPath $wt) { git worktree remove --force $wt }
  git worktree prune
}
Write-Output "compare-main: Exit-Code auf origin/main = $code"
exit $code
