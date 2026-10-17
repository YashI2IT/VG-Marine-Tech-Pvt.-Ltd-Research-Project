@echo off
title Stopping ECUlytics Platform Services
echo =====================================================================
echo           Stopping ECUlytics & TrustSense-BMS Services
echo =====================================================================
echo.

echo Stopping processes on Port 3001 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /f /pid %%a >nul 2>&1
    echo Terminated backend PID %%a
)

echo Stopping processes on Port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
    echo Terminated frontend PID %%a
)

echo.
echo [OK] All platform servers on ports 3000 and 3001 have been stopped.
echo =====================================================================
pause
