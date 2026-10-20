# Development Workspace

> **ECUlytics & TrustSense-BMS Active Codebase**

---

## 1. Directory Structure
```
Development/
├── backend/                 # Node.js + Express TypeScript API Gateway (Port 3001)
│   ├── src/                 # Modular API routes (auth, admin, dashboard, virtual-sensor)
│   ├── data/                # Persistent JSON database (users.json)
│   ├── package.json         # Backend dependencies & scripts
│   └── tsconfig.json        # TypeScript compiler options
│
├── frontend/                # Next.js 16 Web Application (Port 3000)
│   ├── src/                 # App Router (Arcana-style auth, admin hub, telemetry views)
│   ├── public/              # Brand SVG assets & illustrations
│   ├── package.json         # Next.js dependencies & scripts
│   └── tsconfig.json        # Frontend TypeScript config
│
└── docs/                    # Developer setup & API reference manuals
    ├── LOCAL_SETUP.md       # Onboarding guide & environment configuration
    └── API_REFERENCE.md     # Gateway endpoint documentation
```

## 2. Running Locally
From the project root:
```bash
# Run both servers with one command
start.bat

# Or run via npm scripts:
npm run dev:backend    # Starts Backend on http://localhost:3001
npm run dev:frontend   # Starts Frontend on http://localhost:3000
```
