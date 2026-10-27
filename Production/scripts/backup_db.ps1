<#
.SYNOPSIS
    ECUlytics / TrustSense-BMS: Production & Staging Database Backup Script (PowerShell)
.DESCRIPTION
    Creates a compressed, timestamped PostgreSQL backup with SHA-256 verification.
    Automatically detects active Docker database containers or connects to a specified database URL.
.EXAMPLE
    .\backup_db.ps1 -ContainerName "trustsense-staging-postgres"
#>
param(
    [string]$BackupDir = "Production/backups",
    [string]$ContainerName = "",
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "eculytics_backup_$Timestamp.dump"
$ChecksumFile = "$BackupFile.sha256"

Write-Host "=== [1/4] Starting PostgreSQL Backup ===" -ForegroundColor Cyan
Write-Host "Destination: $BackupFile"

if ($DatabaseUrl) {
    Write-Host "Connecting via Database URL..."
    & pg_dump $DatabaseUrl -Fc --no-owner --no-acl -f $BackupFile
} elseif ($ContainerName) {
    Write-Host "Connecting via specified container: $ContainerName..."
    $User = if ($ContainerName -like "*staging*") { "eculytics_staging" } else { "postgres" }
    $Db   = if ($ContainerName -like "*staging*") { "eculytics_staging" } else { "eculytics" }
    docker exec $ContainerName pg_dump -U $User -d $Db -Fc --no-owner --no-acl -f /tmp/backup.dump
    docker cp "${ContainerName}:/tmp/backup.dump" $BackupFile
    docker exec $ContainerName rm -f /tmp/backup.dump
} else {
    # Auto-detect running container
    $runningContainers = docker ps --format "{{.Names}}"
    if ($runningContainers -match "trustsense-staging-postgres") {
        Write-Host "Auto-detected running container: trustsense-staging-postgres"
        docker exec trustsense-staging-postgres pg_dump -U eculytics_staging -d eculytics_staging -Fc --no-owner --no-acl -f /tmp/backup.dump
        docker cp "trustsense-staging-postgres:/tmp/backup.dump" $BackupFile
        docker exec trustsense-staging-postgres rm -f /tmp/backup.dump
    } elseif ($runningContainers -match "trustsense-postgres") {
        Write-Host "Auto-detected running container: trustsense-postgres"
        docker exec trustsense-postgres pg_dump -U postgres -d eculytics -Fc --no-owner --no-acl -f /tmp/backup.dump
        docker cp "trustsense-postgres:/tmp/backup.dump" $BackupFile
        docker exec trustsense-postgres rm -f /tmp/backup.dump
    } else {
        Write-Host "Connecting to localhost:5432 as postgres..."
        $env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }
        & pg_dump -h "localhost" -p 5432 -U "postgres" -d "eculytics" -Fc --no-owner --no-acl -f $BackupFile
    }
}

if (-not (Test-Path $BackupFile) -or (Get-Item $BackupFile).Length -eq 0) {
    Write-Error "Backup file was not created or is empty!"
    exit 1
}

$FileSize = (Get-Item $BackupFile).Length
Write-Host "=== [2/4] Backup Created Successfully ($FileSize bytes) ===" -ForegroundColor Green

Write-Host "=== [3/4] Calculating SHA-256 Checksum ===" -ForegroundColor Cyan
$Hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
Set-Content -Path $ChecksumFile -Value "$Hash  $(Split-Path $BackupFile -Leaf)"
Write-Host "SHA-256: $Hash" -ForegroundColor Yellow

Write-Host "=== [4/4] Verifying Archive Catalog Integrity ===" -ForegroundColor Cyan
if (Get-Command pg_restore -ErrorAction SilentlyContinue) {
    & pg_restore -l $BackupFile | Out-Null
    Write-Host "Archive integrity verified: Table catalog parsed successfully." -ForegroundColor Green
} else {
    Write-Host "pg_restore not found on host PATH; skipping catalog parse." -ForegroundColor Yellow
}

Write-Host "=== SUCCESS: Backup complete: $BackupFile ===" -ForegroundColor Green
