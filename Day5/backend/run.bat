@echo off
cd /d "%~dp0"
if exist venv\Scripts\python.exe (
  venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8002
) else (
  echo venv がありません。先に python -m venv venv と pip install -r requirements.txt を実行してください。
  pause
)
