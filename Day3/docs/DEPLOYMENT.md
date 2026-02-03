# Day3 クラウドデプロイガイド

Day3（React + FastAPI）をクラウド上で動かすための設定と手順です。Firebase は使用しません。

## 1. 構成の整理

| 構成 | 説明 |
|------|------|
| **フロントエンド** | React (Vite)。Vercel / Netlify などにデプロイ可能。 |
| **バックエンド** | FastAPI。Railway / Render / Cloud Run などにデプロイ可能。 |

- フロントとバックエンドの両方をデプロイし、フロントの `VITE_API_BASE` にバックエンドの本番 URL を設定する。

---

## 2. フロントエンドのクラウドデプロイ

### 2.1 環境変数（ビルド時に必要）

デプロイ先の「環境変数」に以下を設定する。

| 変数 | 説明 | 必須 |
|------|------|------|
| `VITE_API_BASE` | バックエンド API のベース URL | ○（本番では必須） |

例: `https://your-api.railway.app`（末尾のスラッシュなし）

### 2.2 Vercel

1. リポジトリを Vercel に連携。
2. **Root Directory** を `Day3/frontend` に設定。
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. 環境変数に `VITE_API_BASE` を追加（本番バックエンドの URL）。

### 2.3 Netlify

1. リポジトリを Netlify に連携。
2. **Base directory**: `Day3/frontend`
3. **Build command**: `npm run build`
4. **Publish directory**: `Day3/frontend/dist`
5. 環境変数に `VITE_API_BASE` を追加。

---

## 3. バックエンド（FastAPI）のクラウドデプロイ

### 3.1 環境変数

| 変数 | 説明 | デフォルト |
|------|------|------------|
| `ALLOWED_ORIGINS` | CORS 許可オリジン（カンマ区切り） | `http://localhost:5173,http://127.0.0.1:5173` |
| `PORT` | 待ち受けポート（多くの PaaS が自動設定） | `8000` |

本番では `ALLOWED_ORIGINS` にフロントの URL を指定する（例: `https://myapp.vercel.app`）。

### 3.2 Docker で起動（任意）

```bash
cd Day3/backend
docker build -t day3-todo-api .
docker run -p 8000:8000 \
  -e ALLOWED_ORIGINS=https://your-frontend.vercel.app \
  day3-todo-api
```

### 3.3 Railway

1. リポジトリまたは Docker でデプロイ。
2. **Root Directory**: `Day3/backend`
3. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. 環境変数に `ALLOWED_ORIGINS` を設定（フロントの URL）。
5. 発行された URL をフロントの `VITE_API_BASE` に設定して再ビルド。

### 3.4 Render

1. **New** → **Web Service**。
2. リポジトリを指定。**Root Directory**: `Day3/backend`。
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. 環境変数に `ALLOWED_ORIGINS` を追加。
6. 発行された URL をフロントの `VITE_API_BASE` に設定。

### 3.5 Google Cloud Run（Docker 利用）

1. イメージをビルド・プッシュ:
   ```bash
   cd Day3/backend
   gcloud builds submit --tag gcr.io/PROJECT_ID/day3-todo-api
   ```
2. サービス作成時に `ALLOWED_ORIGINS` を環境変数で渡す。
3. サービス URL をフロントの `VITE_API_BASE` に設定。

### 3.6 ヘルスチェック

バックエンドは `/health` を用意している。ロードバランサやオーケストレーションのヘルスチェック先に指定できる。

```http
GET /health
→ {"status":"ok"}
```

---

## 4. 本番時の注意

- **CORS**: `ALLOWED_ORIGINS` にフロントの **本番 URL** を指定し、必要なら複数カンマ区切りで追加する。
- **API URL**: フロントの `VITE_API_BASE` は **ビルド時** に埋め込まれるため、変更したら再ビルド・再デプロイが必要。
- **シークレット**: `.env` はリポジトリに含めず、各クラウドの「環境変数」で設定する。

---

## 5. ローカルでクラウドと同じ動きを試す

- フロント: `.env` に `VITE_API_BASE=http://localhost:8000`（未設定でもデフォルトで同じ）
- バックエンド: `.env` に `ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`（未設定でもデフォルトで同じ）
- バックエンド起動: `uvicorn main:app --host 0.0.0.0 --port 8000`
