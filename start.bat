@echo off
title ECUlytics & TrustSense-BMS Platform
echo =====================================================================
echo           ECUlytics & TrustSense-BMS Platform Launcher
echo              VG Marine Tech Pvt. Ltd Research Project
echo =====================================================================
echo.

echo [1/3] Checking environment and port availability...
netstat -ano | findstr :3001 >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [!] Port 3001 is already in use. Stopping previous backend...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1
)

netstat -ano | findstr :3000 >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [!] Port 3000 is already in use. Stopping previous frontend...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Starting Backend API Server (Port 3001)...
start "ECUlytics Backend API" cmd /k "cd /d %~dp0Development\backend && npm run dev"

echo [3/3] Starting Frontend Next.js Server (Port 3000)...
start "ECUlytics Frontend App" cmd /k "cd /d %~dp0Development\frontend && npm run dev"

echo.
echo =====================================================================
echo   SUCCESS: Platform services started!
echo =====================================================================
echo   Frontend App:      http://localhost:3000
echo   User Registration: http://localhost:3000/register
echo   Login Page:        http://localhost:3000/login
echo   Admin Dashboard:   http://localhost:3000/admin
echo   Backend API:       http://localhost:3001
echo   Health Endpoint:   http://localhost:3001/health
echo.
echo   Default Credentials:
echo     Admin:    admin@eculytics.com / password123
echo     Operator: user@vgmarine.com   / password123
echo =====================================================================
echo To stop all services, run: stop.bat
echo.
pause
