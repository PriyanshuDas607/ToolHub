@echo off
echo ========================================================
echo Starting ToolsHub Enterprise OCR Engine (FastAPI)
echo ========================================================
set "PYTHONPATH=%~dp0.venv\Lib\site-packages;%~dp0"
echo Starting server on http://localhost:8000 ...
py -3.12 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
