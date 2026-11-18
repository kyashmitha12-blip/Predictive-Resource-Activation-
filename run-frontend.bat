@echo off
title LEND & LOOP - Frontend Dev Server
echo ==================================================
echo   Starting LEND ^& LOOP Frontend (Vite + React)
echo ==================================================
cd /d "%~dp0frontend"
call npm run dev
pause
