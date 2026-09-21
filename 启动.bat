@echo off
chcp 65001 >nul
title Manju Material Manager - 127.0.0.1:8899
pushd "%~dp0"

node --version >nul 2>nul
if errorlevel 1 goto NONODE

echo.
echo   ============================================================
echo     Manju Material Manager
echo   ============================================================
echo.
echo     Browser will open automatically:
echo         http://127.0.0.1:8899
echo.
echo     KEEP THIS WINDOW OPEN.
echo     Closing this window stops the service.
echo.
echo     To stop: press Ctrl+C, or just close this window.
echo.
echo   ============================================================
echo.

node server.js --open
set EXITCODE=%errorlevel%

echo.
echo   ------------------------------------------------------------
echo   Server stopped. Exit code: %EXITCODE%
echo   ------------------------------------------------------------
echo.
pause
exit /b %EXITCODE%

:NONODE
echo.
echo   [ERROR] Node.js was not found in PATH.
echo.
echo   Please install Node.js from https://nodejs.org/
echo   then run this file again.
echo.
pause
exit /b 1
