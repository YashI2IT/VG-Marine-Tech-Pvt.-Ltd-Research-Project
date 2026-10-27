# -----------------------------------------------------------------------------
# TrustSense-BMS: Hyperledger Fabric v2.5 Network Bootstrap Script (PowerShell)
# -----------------------------------------------------------------------------
param (
    [switch]$ForceRecreate = $false
)

$ErrorActionPreference = "Stop"

# Auto-add Docker Desktop bin to PATH if installed but not in current session PATH
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
    if ($env:Path -notlike "*$dockerBin*") {
        $env:Path = "$dockerBin;$env:Path"
    }
}

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " TrustSense-BMS: Hyperledger Fabric v2.5 Network Bootstrap" -ForegroundColor Cyan
Write-Host " Target Channel:   bmschannel" -ForegroundColor Cyan
Write-Host " Target Chaincode: trustsense-provenance" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Check Docker prerequisite
$dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "`n[PREREQUISITE BLOCKER DETECTED]" -ForegroundColor Red
    Write-Host "Docker is not installed or not in PATH." -ForegroundColor Yellow
    exit 1
}

# 2. Check Docker daemon running
try {
    docker ps -q 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not responding"
    }
} catch {
    Write-Host "`n[DOCKER DAEMON OFFLINE]" -ForegroundColor Red
    Write-Host "Docker CLI is installed, but Docker Desktop daemon is not responding." -ForegroundColor Yellow
    exit 1
}

$fabricDir = Split-Path -Parent $PSScriptRoot
Set-Location $fabricDir

# 3. Teardown existing if requested
if ($ForceRecreate) {
    Write-Host "`nTearing down existing containers and volumes..." -ForegroundColor Yellow
    docker compose -f docker-compose.fabric.yml down -v --remove-orphans
    if (Test-Path "crypto-config") { Remove-Item -Recurse -Force "crypto-config" }
    if (Test-Path "channel-artifacts") { Remove-Item -Recurse -Force "channel-artifacts" }
}

# 4. Generate crypto-config if not present
if (-not (Test-Path "crypto-config/peerOrganizations")) {
    Write-Host "`nGenerating organization cryptographic identities (cryptogen)..." -ForegroundColor Green
    docker run --rm -v "${PWD}:/workspace" -w /workspace hyperledger/fabric-tools:2.5.9 cryptogen generate --config=crypto-config.yaml --output=crypto-config
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cryptogen generation failed." -ForegroundColor Red
        exit 1
    }
}

# 5. Generate channel genesis block if not present
if (-not (Test-Path "channel-artifacts/bmschannel.block")) {
    Write-Host "`nGenerating channel genesis block (configtxgen)..." -ForegroundColor Green
    if (-not (Test-Path "channel-artifacts")) { New-Item -ItemType Directory -Path "channel-artifacts" | Out-Null }
    docker run --rm -v "${PWD}:/workspace" -w /workspace -e FABRIC_CFG_PATH=/workspace hyperledger/fabric-tools:2.5.9 configtxgen -profile BMSChannel -outputBlock ./channel-artifacts/bmschannel.block -channelID bmschannel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Configtxgen block creation failed." -ForegroundColor Red
        exit 1
    }
}

# 6. Start Fabric containers
Write-Host "`nStarting Hyperledger Fabric v2.5 containers..." -ForegroundColor Green
docker compose -f docker-compose.fabric.yml up -d

Write-Host "`nWaiting for orderer and peer nodes to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 7. Channel Participation (Orderer & Peer)
Write-Host "`nJoining Orderer to channel 'bmschannel' via osnadmin..." -ForegroundColor Green
docker exec trustsense-fabric-cli bash -c "
  osnadmin channel join --channelID bmschannel --config-block ./channel-artifacts/bmschannel.block -o orderer.example.com:7053 --ca-file \$ORDERER_CA --client-cert \$ORDERER_ADMIN_TLS_CLIENTCERT --client-key \$ORDERER_ADMIN_TLS_CLIENTKEY || true
"

Write-Host "`nJoining peer0.org1 to channel 'bmschannel'..." -ForegroundColor Green
docker exec trustsense-fabric-cli bash -c "
  peer channel join -b ./channel-artifacts/bmschannel.block || true
"

Start-Sleep -Seconds 3

# 8. Chaincode Packaging & Deployment
Write-Host "`nPackaging and deploying chaincode 'trustsense-provenance'..." -ForegroundColor Green
docker exec trustsense-fabric-cli bash -c "
  cd /opt/gopath/src/github.com/hyperledger/fabric/peer && \
  peer lifecycle chaincode package trustsense-provenance.tar.gz --path ./chaincode/provenance --lang golang --label trustsense-provenance_1.0 && \
  peer lifecycle chaincode install trustsense-provenance.tar.gz >& install.log && \
  cat install.log && \
  export CC_PACKAGE_ID=\$(sed -n 's/.*Identifier: \\(.*\\)/\\1/p' install.log) && \
  echo \"Installed Package ID: \$CC_PACKAGE_ID\" && \
  peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID bmschannel --name trustsense-provenance --version 1.0 --package-id \$CC_PACKAGE_ID --sequence 1 --tls --cafile \$ORDERER_CA && \
  peer lifecycle chaincode commit -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID bmschannel --name trustsense-provenance --version 1.0 --sequence 1 --tls --cafile \$ORDERER_CA --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles \$CORE_PEER_TLS_ROOTCERT_FILE && \
  peer lifecycle chaincode querycommitted --channelID bmschannel --name trustsense-provenance && \
  echo 'Initializing ledger state with InitLedger...' && \
  peer chaincode invoke -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile \$ORDERER_CA -C bmschannel -n trustsense-provenance --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles \$CORE_PEER_TLS_ROOTCERT_FILE -c '{\"function\":\"InitLedger\",\"Args\":[]}'
"

# 9. Sync credentials for Gateway client
Write-Host "`nSyncing client credentials for Fabric Gateway..." -ForegroundColor Green
$userKeyDir = "crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore"
if (Test-Path $userKeyDir) {
    $keyFile = Get-ChildItem -Path $userKeyDir -Filter "*_sk" | Select-Object -First 1
    if ($keyFile) {
        Copy-Item -Path $keyFile.FullName -Destination "test-crypto/user.key" -Force
    }
}
$userCert = "crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem"
if (Test-Path $userCert) {
    Copy-Item -Path $userCert -Destination "test-crypto/user.crt" -Force
}
$caCert = "crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"
if (Test-Path $caCert) {
    Copy-Item -Path $caCert -Destination "test-crypto/ca.crt" -Force
}

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host " Hyperledger Fabric v2.5 Network Bootstrap Complete!" -ForegroundColor Green
Write-Host " Endpoint: localhost:7051" -ForegroundColor Green
Write-Host " Channel:  bmschannel" -ForegroundColor Green
Write-Host " Contract: trustsense-provenance" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
