#!/usr/bin/env bash
# Production Deployment Automation Script
set -e

echo "=== [1/4] Pulling latest production commit ==="
git pull origin main

echo "=== [2/4] Installing backend & frontend production dependencies ==="
cd Development/backend && npm ci --production=false
cd ../frontend && npm ci --production=false
cd ../..

echo "=== [3/4] Running production TypeScript verification ==="
cd Development/backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
cd ../..

echo "=== [4/4] Restarting systemd production services ==="
sudo systemctl restart eculytics-backend.service
sudo systemctl restart eculytics-frontend.service

echo "=== SUCCESS: Production release deployed and operational ==="
