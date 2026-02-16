# AWS リソース構築手順

以下を AWS CLI で実行する。事前に `aws configure` でリージョン `ap-northeast-1` を設定済みであること。

## 1. S3 バケット作成

```bash
aws s3 mb s3://rageducation-data --region ap-northeast-1
```

## 2. ChromaDB データを S3 にアップロード

```bash
aws s3 sync backend/chroma_db/ s3://rageducation-data/chroma_db/
```

## 3. IAM ロール作成

```bash
# 信頼ポリシー
aws iam create-role \
  --role-name rageducation-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# 基本実行権限
aws iam attach-role-policy \
  --role-name rageducation-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# S3 読取権限
aws iam put-role-policy \
  --role-name rageducation-lambda-role \
  --policy-name s3-read \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::rageducation-data",
        "arn:aws:s3:::rageducation-data/*"
      ]
    }]
  }'
```

## 4. Lambda 関数作成

deploy.ps1 で ZIP を作成後:

```bash
aws lambda create-function \
  --function-name rageducation-api \
  --runtime python3.11 \
  --handler lambda_handler.handler \
  --role arn:aws:iam::ACCOUNT_ID:role/rageducation-lambda-role \
  --zip-file fileb://deploy/lambda.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment "Variables={
    APP_ENV=lambda,
    GOOGLE_API_KEY=AIzaSyCmFaxsk295vZaM93UFkN0V2Lc1al7ZidU,
    FIREBASE_PROJECT_ID=rageducation-39170,
    CHROMA_S3_BUCKET=rageducation-data,
    CHROMA_S3_PREFIX=chroma_db/
  }"
```

## 5. API Gateway 作成

```bash
# REST API 作成
aws apigateway create-rest-api \
  --name rageducation-api \
  --endpoint-configuration types=REGIONAL

# プロキシリソース作成 (/{proxy+})
# API ID は前のコマンドの出力から取得
aws apigateway create-resource \
  --rest-api-id API_ID \
  --parent-id ROOT_RESOURCE_ID \
  --path-part "{proxy+}"

# ANY メソッド + Lambda 統合を設定
# → AWS コンソールで操作する方が簡単
```

### API Gateway コンソール設定（推奨）

1. API Gateway コンソール → 「REST API」を作成
2. リソース → 「/{proxy+}」を作成
3. メソッド → 「ANY」→ Lambda プロキシ統合 → `rageducation-api` を選択
4. CORS を有効化
5. 「デプロイ」→ ステージ名 `prod` で作成
6. 呼び出し URL をメモ: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

## 6. Amplify Hosting

1. Amplify コンソール → 「新しいアプリ」→ GitHub リポジトリを接続
2. ブランチ: `main` (または `ai-generated`)
3. ビルド設定: `frontend/amplify.yml` を自動検出
4. 環境変数を設定:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_API_BASE` = API Gateway の URL
