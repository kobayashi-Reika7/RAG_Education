@echo off
REM Day5 を https://github.com/kobayashi-Reika7/Reservation-Calendar の main にプッシュ
REM 実行: リポジトリのルート（Realice）で実行するか、このファイルをダブルクリック
cd /d "%~dp0.."
if not exist "Day5" (
  echo Error: Day5 folder not found. Run from Realice repo root.
  pause
  exit /b 1
)

echo Adding remote 'calendar' if not exists...
git remote add calendar https://github.com/kobayashi-Reika7/Reservation-Calendar.git 2>nul

echo.
echo Pushing Day5 to Reservation-Calendar main...
git subtree push --prefix=Day5 calendar main

if errorlevel 1 (
  echo.
  echo Push failed. Check:
  echo - Network / proxy (e.g. git config --get https.proxy)
  echo - GitHub login (git credential)
) else (
  echo.
  echo Done. See https://github.com/kobayashi-Reika7/Reservation-Calendar
)
pause
