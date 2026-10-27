#!/usr/bin/env bash
set -e

BATCH_ID="${1:-batch_fabric_verify_1792846457999}"

peer chaincode query \
  -C bmschannel \
  -n trustsense-provenance \
  -c "{\"function\":\"GetBatch\",\"Args\":[\"$BATCH_ID\"]}"
