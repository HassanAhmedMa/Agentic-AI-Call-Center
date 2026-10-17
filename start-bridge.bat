@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo          Agentic Clinic - Inter-Agent Bridge
echo =======================================================
echo.

if not "%1"=="" (
    set AGENT_NAME=%1
    goto setup_port
)

echo Select your developer identity:
echo   1. Hassan (Antigravity - Port 9101)
echo   2. Ziad   (Codex - Port 9102)
echo   3. Ali    (Antigravity - Port 9103)
echo.
set /p CHOICE="Enter choice (1-3): "

if "%CHOICE%"=="1" set AGENT_NAME=Hassan
if "%CHOICE%"=="2" set AGENT_NAME=Ziad
if "%CHOICE%"=="3" set AGENT_NAME=Ali

if "%AGENT_NAME%"=="" (
    echo [ERROR] Invalid selection. Exiting.
    pause
    exit /b 1
)

:setup_port
if "%AGENT_NAME%"=="Hassan" set BRIDGE_PORT=9101
if "%AGENT_NAME%"=="Ziad" set BRIDGE_PORT=9102
if "%AGENT_NAME%"=="Ali" set BRIDGE_PORT=9103

echo.
echo [*] Initializing bridge for %AGENT_NAME% on port %BRIDGE_PORT%...

REM Check for SSH key
set SSH_KEY="C:\Users\hassa\Desktop\GraduationProject\ClinicServerKey\ssh-key-2026-10-12.key"
if not exist %SSH_KEY% (
    if exist "%USERPROFILE%\.ssh\id_rsa" set SSH_KEY="%USERPROFILE%\.ssh\id_rsa"
    if exist "%USERPROFILE%\.ssh\clinic.key" set SSH_KEY="%USERPROFILE%\.ssh\clinic.key"
)

echo [*] Starting Python Agent Bridge listener in background...
start "Agent Bridge - %AGENT_NAME%" python scripts\agent_bridge.py --name %AGENT_NAME% --port %BRIDGE_PORT%

echo [*] Establishing reverse SSH tunnel to Oracle Server (193.122.68.159)...
echo     Tunnel: Server port %BRIDGE_PORT% -^> Localhost %BRIDGE_PORT%
echo.
echo Tunnel is now active. Press Ctrl+C to disconnect.
echo =======================================================

ssh -i %SSH_KEY% -o StrictHostKeyChecking=no -N -R 0.0.0.0:%BRIDGE_PORT%:127.0.0.1:%BRIDGE_PORT% ubuntu@193.122.68.159

pause
