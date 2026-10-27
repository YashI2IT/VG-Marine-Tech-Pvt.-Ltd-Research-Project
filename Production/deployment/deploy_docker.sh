#!/usr/bin/env bash
# =====================================================================
# ECUlytics & TrustSense-BMS: Production Docker Zero-Downtime Deployment
# =====================================================================
set -euo pipefail

echo "=== [1/6] Validating production environment configuration ==="
if [ ! -f "Production/config/.env.production" ]; then
    echo "ERROR: Production/config/.env.production not found!"
    echo "Please copy Production/config/production.env.example to .env.production and populate required secrets."
    exit 1
fi

echo "=== [2/6] Building production container images ==="
docker compose -f Production/docker/docker-compose.prod.yml build --no-cache

echo "=== [3/6] Starting core infrastructure (PostgreSQL & Thermal AI) ==="
docker compose -f Production/docker/docker-compose.prod.yml up -d postgres thermal-ai

echo "=== [4/6] Awaiting core dependency readiness ==="
timeout 60 bash -c 'until docker compose -f Production/docker/docker-compose.prod.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-eculytics_admin}; do sleep 2; done'
timeout 60 bash -c 'until curl -fs http://127.0.0.1:8000/health > /dev/null 2>&1 || docker compose -f Production/docker/docker-compose.prod.yml exec -T thermal-ai curl -fs http://127.0.0.1:8000/health > /dev/null 2>&1; do sleep 2; done'

echo "=== [5/6] Starting backend gateway, frontend UI and edge Nginx ==="
docker compose -f Production/docker/docker-compose.prod.yml up -d backend frontend nginx

echo "=== [6/6] Verifying deep readiness probe ==="
timeout 60 bash -c 'until docker compose -f Production/docker/docker-compose.prod.yml exec -T backend node -e "require(\"http\").get(\"http://127.0.0.1:3001/ready\", (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on(\"error\", () => process.exit(1));" > /dev/null 2>&1; do sleep 2; done'

echo "=== SUCCESS: TrustSense-BMS Production Release successfully deployed and verified healthy ==="
