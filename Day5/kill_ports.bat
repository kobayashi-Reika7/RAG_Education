@echo off
REM ポート 5200, 5201, 8000, 8001, 8002 を LISTEN しているプロセスを終了する
REM 管理者権限不要（自ユーザーのプロセスのみ終了可能）

echo Freeing ports 5200, 5201, 8000, 8001, 8002...
for %%P in (5200 5201 8000 8001 8002) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%%P "') do (
    echo Killing PID %%a ^(port %%P^)
    taskkill /PID %%a /F 2>nul
  )
)
echo Done. Run: netstat -ano ^| findstr ":5200 :5201 :8000 :8001 :8002"
