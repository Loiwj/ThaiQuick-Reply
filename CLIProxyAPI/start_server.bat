@echo off
title CLIProxyAPI Server
echo ==========================================
echo   CLIProxyAPI Server - ThaiQuick Reply
echo ==========================================
echo.
echo Starting server on port 8317...
echo Press Ctrl+C to stop the server.
echo.
cd /d "%~dp0"
cli-proxy-api.exe run
pause
