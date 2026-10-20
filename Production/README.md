# Production Environment & Deployment Architecture

> **ECUlytics & TrustSense-BMS Enterprise Battery Analytics Platform**  
> Target: High-Availability Marine Fleet Operations & BMS Telemetry

---

## 1. Overview
The `Production/` directory encapsulates all production-grade container specifications, reverse-proxy configurations, infrastructure-as-code manifests, and deployment automation scripts for enterprise deployment.

## 2. Directory Structure
```
Production/
├── config/                  # Production runtime environment variables & Nginx topology
│   ├── nginx.conf           # SSL termination, HTTP/2, security headers & API routing
│   └── production.env.example# Template for production secrets and database URLs
├── docker/                  # Multi-stage production container definitions
│   ├── Dockerfile.backend   # Optimized Node.js 20 production container
│   ├── Dockerfile.frontend  # Next.js 16 standalone production container
│   └── docker-compose.prod.yml # Production multi-service orchestration
└── deployment/              # Daemon services, health checks & zero-downtime scripts
    ├── deploy.sh            # Zero-downtime deployment script with health verification
    ├── eculytics-backend.service  # Systemd service definition for API gateway
    ├── eculytics-frontend.service # Systemd service definition for Next.js web app
    └── HEALTHCHECK.md       # Liveness & readiness probe documentation
```

## 3. Quick Production Deployment
```bash
# Navigate to production docker directory
cd Production/docker

# Copy production environment variables
cp ../config/production.env.example .env.production

# Build and start production containers
docker-compose -f docker-compose.prod.yml up -d --build
```
