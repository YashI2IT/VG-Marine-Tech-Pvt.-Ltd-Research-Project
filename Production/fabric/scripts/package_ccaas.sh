#!/usr/bin/env bash
set -e

DIR="/tmp/ccaas_pkg"
rm -rf "$DIR"
mkdir -p "$DIR/src"

cat << 'EOF' > "$DIR/src/connection.json"
{
  "address": "trustsense-chaincode:9999",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF

tar -czf "$DIR/code.tar.gz" -C "$DIR/src" connection.json

cat << 'EOF' > "$DIR/metadata.json"
{
  "type": "ccaas",
  "label": "trustsense-provenance_1.0"
}
EOF

OUT="/opt/gopath/src/github.com/hyperledger/fabric/peer/trustsense-provenance.tar.gz"
tar -czf "$OUT" -C "$DIR" metadata.json code.tar.gz

echo "Created CCaaS package at $OUT"
cat "$DIR/metadata.json"
echo ""

peer lifecycle chaincode install "$OUT"
