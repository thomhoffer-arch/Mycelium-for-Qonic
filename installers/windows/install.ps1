#Requires -Version 5.1
# Mycelium-for-Qonic — Windows installer script (run by the NSIS .exe)
$ErrorActionPreference = 'Stop'
$REPO   = 'https://github.com/thomhoffer-arch/Mycelium-for-Qonic.git'
$DEST   = "$env:USERPROFILE\Mycelium-for-Qonic"

function Write-Step($msg) { Write-Host "  -> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  !! $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  Mycelium-for-Qonic installer" -ForegroundColor White
Write-Host "  ==============================" -ForegroundColor DarkGray
Write-Host ""

# ── Node.js >= 18 ─────────────────────────────────────────────────────────────
$nodeOk = $false
try {
    $v = (& node --version 2>$null).Trim()
    if ($v -match '^v(\d+)' -and [int]$Matches[1] -ge 18) {
        $nodeOk = $true
        Write-Ok "Node $v"
    } else {
        Write-Step "Node $v found but v18+ required — upgrading..."
    }
} catch { Write-Step "Node.js not found — installing..." }

if (-not $nodeOk) {
    # Try winget (Windows 10 1709+ / Windows 11)
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Step "Installing Node.js LTS via winget..."
        winget install --id OpenJS.NodeJS.LTS -e --silent `
            --accept-source-agreements --accept-package-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('Path','User')
        Write-Ok "Node.js installed"
    } else {
        Write-Fail "winget not available. Install Node 18+ from https://nodejs.org then re-run this installer."
    }
}

# ── git ───────────────────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Step "Installing Git via winget..."
    winget install --id Git.Git -e --silent `
        --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')
    Write-Ok "Git installed"
} else {
    Write-Ok "Git $(git --version)"
}

# ── clone / update ────────────────────────────────────────────────────────────
if (Test-Path "$DEST\.git") {
    Write-Step "Updating existing install in $DEST..."
    git -C $DEST pull --ff-only
} else {
    Write-Step "Cloning into $DEST..."
    git clone $REPO $DEST
}

Set-Location $DEST

# ── npm install ───────────────────────────────────────────────────────────────
Write-Step "Installing npm dependencies..."
npm install --prefer-offline 2>&1 | Select-String -NotMatch 'npm warn'
Write-Ok "Dependencies installed"

# ── setup wizard ─────────────────────────────────────────────────────────────
Write-Host ""
node setup.mjs

Write-Host ""
Write-Host "  Done! To run the connector:" -ForegroundColor Green
Write-Host "    cd `"$DEST`"" -ForegroundColor White
Write-Host "    node connector.mjs" -ForegroundColor White
Write-Host ""
