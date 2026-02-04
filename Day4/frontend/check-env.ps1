# Day4 フロントエンド: .env の VITE_FIREBASE_* 設定を検証するスクリプト
# 使い方: Day4/frontend で .\check-env.ps1 を実行
# 再起動後にデータが出ない場合の確認（DEBUG_FIRESTORE.md の 1 項目目）に使用

$required = @(
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
)

$envPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envPath)) {
  Write-Host '[NG] .env not found.' -ForegroundColor Red
  Write-Host '  Copy .env.example to .env and set Firebase values from Firebase Console.'
  exit 1
}

$content = Get-Content $envPath -Raw
$vars = @{}
foreach ($line in ($content -split "`n")) {
  $line = $line.Trim()
  if ($line -match '^\s*#' -or $line -eq '') { continue }
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $vars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}

$missing = @()
foreach ($key in $required) {
  if (-not $vars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($vars[$key])) {
    $missing += $key
  }
}

if ($missing.Count -eq 0) {
  Write-Host '[OK] All VITE_FIREBASE_* are set in .env' -ForegroundColor Green
  Write-Host '  Restart npm run dev after changing .env'
  exit 0
}

Write-Host '[NG] Missing or empty:' -ForegroundColor Red
$missing | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host '  Set values from Firebase Console -> Project settings -> General'
exit 1
