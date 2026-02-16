#!/bin/bash
# RAG Education - Lambda デプロイスクリプト (Bash)
# 使用方法: bash deploy/deploy_lambda.sh

set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-rageducation-api}"
S3_BUCKET="${S3_BUCKET:-rageducation-data}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")/backend"
DEPLOY_DIR="$SCRIPT_DIR"
BUILD_DIR="$DEPLOY_DIR/build"
ZIP_PATH="$DEPLOY_DIR/lambda.zip"

echo "=== RAG Education Lambda Deploy ==="

# 1. ChromaDB を S3 にアップロード
echo -e "\n[1/4] ChromaDB -> S3..."
aws s3 sync "$BACKEND_DIR/chroma_db/" "s3://$S3_BUCKET/chroma_db/" --region "$REGION" --delete
echo "  Done."

# 2. pip install
echo -e "\n[2/4] pip install..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
pip install -r "$BACKEND_DIR/requirements.txt" -t "$BUILD_DIR" --quiet --upgrade
echo "  Done."

# 3. ソースコードをコピー + ZIP 作成
echo -e "\n[3/4] ZIP 作成..."
cp "$BACKEND_DIR/main.py" "$BUILD_DIR/"
cp "$BACKEND_DIR/lambda_handler.py" "$BUILD_DIR/"
cp -r "$BACKEND_DIR/src" "$BUILD_DIR/src"
cp -r "$BACKEND_DIR/prompts" "$BUILD_DIR/prompts"

rm -f "$ZIP_PATH"
cd "$BUILD_DIR" && zip -r "$ZIP_PATH" . -q
cd -

SIZE_MB=$(du -m "$ZIP_PATH" | cut -f1)
echo "  lambda.zip: ${SIZE_MB} MB"

# 4. Lambda 関数を更新
echo -e "\n[4/4] Lambda 更新..."
if [ "$SIZE_MB" -gt 49 ]; then
    echo "  (S3経由アップロード)"
    aws s3 cp "$ZIP_PATH" "s3://$S3_BUCKET/deploy/lambda.zip" --region "$REGION"
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --s3-bucket "$S3_BUCKET" \
        --s3-key "deploy/lambda.zip" \
        --region "$REGION" > /dev/null
else
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://$ZIP_PATH" \
        --region "$REGION" > /dev/null
fi
echo "  Done."

# クリーンアップ
rm -rf "$BUILD_DIR"

echo -e "\n=== デプロイ完了 ==="
echo "Lambda: $FUNCTION_NAME ($REGION)"
