@echo off
title Bookstore App Launcher
echo Starting local web server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
