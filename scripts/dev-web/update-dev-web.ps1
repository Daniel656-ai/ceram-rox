# Holt den neuesten Stand des Branches dev-web aus Gitea in den Web-Ordner.
$TargetDir = "C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev-web"
$Branch    = "dev-web"
$LogFile   = Join-Path $PSScriptRoot "update-dev-web.log"
$MaxLines  = 500

function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    $all = Get-Content -Path $LogFile -Encoding UTF8
    if ($all.Count -gt $MaxLines) {
        $all | Select-Object -Last $MaxLines | Set-Content -Path $LogFile -Encoding UTF8
    }
}

if (-not (Test-Path -LiteralPath $TargetDir)) {
    Write-Log "FEHLER: Zielordner existiert nicht: $TargetDir (siehe README, einmaliges Klonen)"
    exit 1
}

Push-Location $TargetDir
try {
    $out = & git fetch origin $Branch 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Log "FEHLER git fetch: $($out.Trim())"; exit 1 }

    $out = & git reset --hard "origin/$Branch" 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Log "FEHLER git reset: $($out.Trim())"; exit 1 }

    Write-Log "OK: $($out.Trim())"
}
finally {
    Pop-Location
}
