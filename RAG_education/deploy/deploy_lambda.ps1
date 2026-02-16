# RAG Education - Lambda デプロイスクリプト (PowerShell)
# 使用方法: .\deploy\deploy_lambda.ps1
#
# 事前に以下を設定:
#   $env:AWS_REGION = "ap-northeast-1"
#   $env:LAMBDA_FUNCTION_NAME = "rageducation-api"
#   $env:S3_BUCKET = "rageducation-data"

param(
    [string]$Region = "ap-northeast-1",
    [string]$FunctionName = "rageducation-api",
    [string]$S3Bucket = "rageducation-data"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }
$BackendDir = Join-Path $ProjectRoot "RAG_education\backend"
$DeployDir = Join-Path $ProjectRoot "RAG_education\deploy"
$BuildDir = Join-Path $DeployDir "build"
$ZipPath = Join-Path $DeployDir "lambda.zip"

Write-Host "=== RAG Education Lambda Deploy ===" -ForegroundColor Cyan

# 1. ChromaDB を S3 にアップロード
Write-Host "`n[1/4] ChromaDB -> S3..." -ForegroundColor Yellow
aws s3 sync "$BackendDir\chroma_db" "s3://$S3Bucket/chroma_db/" --region $Region --delete
Write-Host "  Done." -ForegroundColor Green

# 2. pip install で依存関係を取得
Write-Host "`n[2/4] pip install..." -ForegroundColor Yellow
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

pip install -r "$BackendDir\requirements.txt" -t "$BuildDir" --quiet --upgrade
Write-Host "  Done." -ForegroundColor Green

# 3. ソースコードをコピー + ZIP 作成
Write-Host "`n[3/4] ZIP 作成..." -ForegroundColor Yellow
Copy-Item "$BackendDir\main.py" $BuildDir
Copy-Item "$BackendDir\lambda_handler.py" $BuildDir
Copy-Item -Recurse "$BackendDir\src" "$BuildDir\src"
Copy-Item -Recurse "$BackendDir\prompts" "$BuildDir\prompts"

if (Test-Path $ZipPath) { Remove-Item $ZipPath }
Compress-Archive -Path "$BuildDir\*" -DestinationPath $ZipPath -Force

$sizeMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "  lambda.zip: ${sizeMB} MB" -ForegroundColor Green

# 4. Lambda 関数を更新
Write-Host "`n[4/4] Lambda 更新..." -ForegroundColor Yellow

# ZIP が 50MB 以上なら S3 経由でアップロード
if ($sizeMB -gt 49) {
    Write-Host "  (S3経由アップロード)" -ForegroundColor Gray
    aws s3 cp $ZipPath "s3://$S3Bucket/deploy/lambda.zip" --region $Region
    aws lambda update-function-code `
        --function-name $FunctionName `
        --s3-bucket $S3Bucket `
        --s3-key "deploy/lambda.zip" `
        --region $Region | Out-Null
} else {
    aws lambda update-function-code `
        --function-name $FunctionName `
        --zip-file "fileb://$ZipPath" `
        --region $Region | Out-Null
}

Write-Host "  Done." -ForegroundColor Green

# クリーンアップ
Remove-Item -Recurse -Force $BuildDir

Write-Host "`n=== デプロイ完了 ===" -ForegroundColor Cyan
Write-Host "Lambda: $FunctionName ($Region)" -ForegroundColor White
