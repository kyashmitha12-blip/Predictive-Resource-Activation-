@echo off
title LEND & LOOP - Backend API Server
echo ==================================================
echo   Starting LEND ^& LOOP Backend (FastAPI + Uvicorn)
echo ==================================================
cd /d "%~dp0backend"
if exist "C:\Users\yogad\AppData\Local\Programs\Python\Python312\python.exe" (
    "C:\Users\yogad\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)
pause
