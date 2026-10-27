#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# TrustSense-BMS: Hyperledger Fabric v2.5 Network Bootstrap Script (Bash)
# -----------------------------------------------------------------------------
set -e

echo "====================================================================="
echo " TrustSense-BMS: Hyperledger Fabric v2.5 Network Bootstrap"
echo " Channel:   bmschannel"
echo " Chaincode: trustsense-provenance"
echo "====================================================================="

# 1. Check Docker prerequisite
if ! command -v docker &> /dev/null; then
    echo "[PREREQUISITE BLOCKER DETECTED] Docker is not installed or not in PATH."
    echo "Hyperledger Fabric requires Docker (version 20.10+) and Docker Compose."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "[DOCKER DAEMON OFFLINE] Docker is installed but daemon is unreachable."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABRIC_DIR="$(dirname "$SCRIPT_DIR")"
cd "$FABRIC_DIR"

# 2. Generate crypto-config if not present
if [ ! -d "crypto-config/peerOrganizations" ]; then
    echo "Generating organization cryptographic identities (cryptogen)..."
    docker run --rm -v "${PWD}:/workspace" -w /workspace hyperledger/fabric-tools:2.5.9 cryptogen generate --config=crypto-config.yaml --output=crypto-config
fi

# 3. Generate channel genesis block if not present
if [ ! -f "channel-artifacts/bmschannel.block" ]; then
    echo "Generating channel genesis block (configtxgen)..."
    mkdir -p channel-artifacts
    docker run --rm -v "${PWD}:/workspace" -w /workspace -e FABRIC_CFG_PATH=/workspace hyperledger/fabric-tools:2.5.9 configtxgen -profile BMSChannel -outputBlock ./channel-artifacts/bmschannel.block -channelID bmschannel
fi

# 4. Boot containers
echo "Starting Hyperledger Fabric v2.5 containers..."
docker compose -f docker-compose.fabric.yml up -d

echo "Waiting for orderer and peer nodes to initialize..."
sleep 8

# 5. Channel Participation (Orderer & Peer)
echo "Joining Orderer to channel 'bmschannel' via osnadmin..."
docker exec trustsense-fabric-cli bash -c "
  osnadmin channel join --channelID bmschannel --config-block ./channel-artifacts/bmschannel.block -o orderer.example.com:7053 --ca-file \$ORDERER_CA --client-cert \$ORDERER_ADMIN_TLS_CLIENTCERT --client-key \$ORDERER_ADMIN_TLS_CLIENTKEY || true
"

echo "Joining peer0.org1 to channel 'bmschannel'..."
docker exec trustsense-fabric-cli bash -c "
  peer channel join -b ./channel-artifacts/bmschannel.block || true
"

sleep 3

# 6. Deploy chaincode
echo "Deploying chaincode 'trustsense-provenance'..."
docker exec trustsense-fabric-cli bash -c "
  cd /opt/gopath/src/github.com/hyperledger/fabric/peer && \
  peer lifecycle chaincode package trustsense-provenance.tar.gz --path ./chaincode/provenance --lang golang --label trustsense-provenance_1.0 && \
  peer lifecycle chaincode install trustsense-provenance.tar.gz >& install.log && \
  cat install.log && \
  export CC_PACKAGE_ID=\$(sed -n 's/.*Identifier: \\(.*\\)/\\1/p' install.log) && \
  peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID bmschannel --name trustsense-provenance --version 1.0 --package-id \$CC_PACKAGE_ID --sequence 1 --tls --cafile \$ORDERER_CA && \
  peer lifecycle chaincode commit -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --channelID bmschannel --name trustsense-provenance --version 1.0 --sequence 1 --tls --cafile \$ORDERER_CA --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles \$CORE_PEER_TLS_ROOTCERT_FILE && \
  peer lifecycle chaincode querycommitted --channelID bmschannel --name trustsense-provenance && \
  peer chaincode invoke -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile \$ORDERER_CA -C bmschannel -n trustsense-provenance --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles \$CORE_PEER_TLS_ROOTCERT_FILE -c '{\"function\":\"InitLedger\",\"Args\":[]}'
"

# 7. Sync credentials
echo "Syncing client credentials..."
USER_KEY=\$(ls crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/*_sk 2>/dev/null | head -n 1 || true)
if [ -n "\$USER_KEY" ]; then
    cp "\$USER_KEY" test-crypto/user.key
fi
if [ -f "crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem" ]; then
    cp crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem test-crypto/user.crt
fi
if [ -f "crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem" ]; then
    cp crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem test-crypto/ca.crt
fi

echo "====================================================================="
echo " Hyperledger Fabric v2.5 Network Bootstrap Complete!"
echo " Endpoint: localhost:7051"
echo " Channel:  bmschannel"
echo " Contract: trustsense-provenance"
echo "====================================================================="
