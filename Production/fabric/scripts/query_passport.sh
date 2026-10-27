#!/usr/bin/env bash
set -e

peer chaincode query \
  -C bmschannel \
  -n trustsense-provenance \
  -c '{"function":"GetBatteryPassport","Args":["BAT-PAN18650PF-001"]}'
