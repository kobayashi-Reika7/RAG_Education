@echo off
cd /d "%~dp0"
echo doctors シードを実行します。FIREBASE_SERVICE_ACCOUNT_JSON が未設定の場合は .env を読みます。
echo.
if not exist venv\Scripts\python.exe (
  echo venv がありません。先に python -m venv venv と pip install -r requirements.txt を実行してください。
  pause
  exit /b 1
)
venv\Scripts\python -m scripts.seed_doctors
if errorlevel 1 (
  echo.
  echo 失敗: 環境変数 FIREBASE_SERVICE_ACCOUNT_JSON または GOOGLE_APPLICATION_CREDENTIALS を設定してください。
  echo 手順: docs/doctors-seed.md を参照。backend/.env に FIREBASE_SERVICE_ACCOUNT_JSON を1行で書くか、
  echo PowerShell で $env:FIREBASE_SERVICE_ACCOUNT_JSON = (Get-Content -Raw path\to\serviceAccountKey.json) を実行してから再度実行。
  pause
)
exit /b 0
