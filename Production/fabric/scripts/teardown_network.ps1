# -----------------------------------------------------------------------------
# TrustSense-BMS: Hyperledger Fabric Network Teardown Script (PowerShell)
# -----------------------------------------------------------------------------
param (
    [switch]$CleanVolumes = $true
)

$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
    if ($env:Path -notlike "*$dockerBin*") {
        $env:Path = "$dockerBin;$env:Path"
    }
}

$fabricDir = Split-Path -Parent $PSScriptRoot
Set-Location $fabricDir

Write-Host "Tearing down Hyperledger Fabric containers..." -ForegroundColor Yellow
if ($CleanVolumes) {
    docker compose -f docker-compose.fabric.yml down -v --remove-orphans
} else {
    docker compose -f docker-compose.fabric.yml down
}

Write-Host "Hyperledger Fabric network stopped cleanly." -ForegroundColor Green
