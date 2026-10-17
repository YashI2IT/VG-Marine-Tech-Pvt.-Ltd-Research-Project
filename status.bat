@echo off
title ECUlytics Platform Status Check
echo =====================================================================
echo               ECUlytics & TrustSense-BMS Service Status
echo =====================================================================
echo.

echo Checking Backend API (Port 3001)...
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [ONLINE]  Backend is UP and responding at http://localhost:3001
) else (
    echo [OFFLINE] Backend is NOT reachable on Port 3001
)

echo Checking Frontend Next.js (Port 3000)...
curl -s http://localhost:3000/login >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [ONLINE]  Frontend is UP and responding at http://localhost:3000
) else (
    echo [OFFLINE] Frontend is NOT reachable on Port 3000
)

echo.
echo =====================================================================
pause
