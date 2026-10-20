# Developer Onboarding & Local Setup

## Prerequisites
- **Node.js**: v20 or higher
- **Python**: 3.10+ (for Virtual Sensor inference)
- **Git**

## Setup Instructions
```bash
# 1. Install Backend Dependencies
cd Development/backend
npm install

# 2. Install Frontend Dependencies
cd ../frontend
npm install

# 3. Verify TypeScript Compilation
npx tsc --noEmit
```

## Port Assignments
- **Frontend App:** Port 3000 (`http://localhost:3000`)
- **Backend API Gateway:** Port 3001 (`http://localhost:3001`)
