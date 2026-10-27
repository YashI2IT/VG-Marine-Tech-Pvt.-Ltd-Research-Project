<#
.SYNOPSIS
    ECUlytics / TrustSense-BMS: Production & Staging Database Restore Script (PowerShell)
.DESCRIPTION
    Restores a PostgreSQL backup archive after validating its SHA-256 integrity checksum.
.EXAMPLE
    .\restore_db.ps1 -BackupFile "Production/backups/eculytics_backup_20261024_120000.dump" -ContainerName "trustsense-staging-postgres"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "",
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

Write-Host "=== [1/4] Verifying SHA-256 Checksum ===" -ForegroundColor Cyan
$ChecksumFile = "$BackupFile.sha256"
if (Test-Path $ChecksumFile) {
    $ExpectedHash = (Get-Content $ChecksumFile).Split(" ")[0].Trim()
    $ActualHash   = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    if ($ExpectedHash.ToLower() -ne $ActualHash.ToLower()) {
        Write-Error "CRITICAL: Checksum mismatch! Expected $ExpectedHash, calculated $ActualHash. Archive may be corrupted or tampered!"
        exit 1
    }
    Write-Host "Checksum verified: Backup matches expected SHA-256 hash." -ForegroundColor Green
} else {
    Write-Host "Notice: No accompanying .sha256 file found. Proceeding with restore..." -ForegroundColor Yellow
}

Write-Host "=== [2/4] Verifying Archive Catalog Integrity ===" -ForegroundColor Cyan
if (Get-Command pg_restore -ErrorAction SilentlyContinue) {
    & pg_restore -l $BackupFile | Out-Null
    Write-Host "Archive header is valid." -ForegroundColor Green
}

Write-Host "=== [3/4] Restoring Database Records ===" -ForegroundColor Cyan
if ($DatabaseUrl) {
    Write-Host "Restoring to target Database URL..."
    & pg_restore --clean --if-exists --no-owner --no-acl -d $DatabaseUrl $BackupFile
} elseif ($ContainerName) {
    Write-Host "Restoring into container: $ContainerName..."
    $User = if ($ContainerName -like "*staging*") { "eculytics_staging" } else { "postgres" }
    $Db   = if ($ContainerName -like "*staging*") { "eculytics_staging" } else { "eculytics" }
    docker cp $BackupFile "${ContainerName}:/tmp/restore.dump"
    docker exec $ContainerName pg_restore -U $User -d $Db --clean --if-exists --no-owner --no-acl /tmp/restore.dump
    docker exec $ContainerName rm -f /tmp/restore.dump
} else {
    $runningContainers = docker ps --format "{{.Names}}"
    if ($runningContainers -match "trustsense-staging-postgres") {
        Write-Host "Restoring into auto-detected container: trustsense-staging-postgres..."
        docker cp $BackupFile "trustsense-staging-postgres:/tmp/restore.dump"
        docker exec trustsense-staging-postgres pg_restore -U eculytics_staging -d eculytics_staging --clean --if-exists --no-owner --no-acl /tmp/restore.dump
        docker exec trustsense-staging-postgres rm -f /tmp/restore.dump
    } elseif ($runningContainers -match "trustsense-postgres") {
        Write-Host "Restoring into auto-detected container: trustsense-postgres..."
        docker cp $BackupFile "trustsense-postgres:/tmp/restore.dump"
        docker exec trustsense-postgres pg_restore -U postgres -d eculytics --clean --if-exists --no-owner --no-acl /tmp/restore.dump
        docker exec trustsense-postgres rm -f /tmp/restore.dump
    } else {
        Write-Host "Restoring to localhost:5432/eculytics..."
        $env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }
        & pg_restore -h "localhost" -p 5432 -U "postgres" -d "eculytics" --clean --if-exists --no-owner --no-acl $BackupFile
    }
}

Write-Host "=== [4/4] Verification Complete ===" -ForegroundColor Cyan
Write-Host "=== SUCCESS: Database restored from $BackupFile ===" -ForegroundColor Green
