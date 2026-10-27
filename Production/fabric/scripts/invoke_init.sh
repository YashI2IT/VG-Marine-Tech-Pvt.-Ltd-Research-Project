#!/usr/bin/env bash
set -e

peer chaincode invoke \
  -o orderer.example.com:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "$ORDERER_CA" \
  -C bmschannel \
  -n trustsense-provenance \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles "$CORE_PEER_TLS_ROOTCERT_FILE" \
  -c '{"function":"InitLedger","Args":[]}'

echo "InitLedger invocation complete."
