# GCP Vision API OCR セットアップ手順

## 新プロジェクト「RAGeducation」のセットアップ

---

## ステップ0: プロジェクトIDを確認

1. [GCPコンソール](https://console.cloud.google.com/) を開く
2. 画面上部のプロジェクト選択で「RAGeducation」を選択
3. **プロジェクトID** を確認（表示名とは異なる場合がある）
   - 例: `rageducation` or `rageducation-452814` など
   - プロジェクト選択ダイアログ or [ダッシュボード](https://console.cloud.google.com/home/dashboard) で確認可能

---

## ステップ1: 課金を有効化（必須）

Vision API は課金アカウントが紐付いていないと使えません。

1. [課金ページ](https://console.cloud.google.com/billing) を開く
2. プロジェクト「RAGeducation」に課金アカウントをリンク
   - 既存の課金アカウント（onsen-c5fec と同じもの）を選択でOK

> 無料枠: Vision API は月1,000リクエストまで無料

---

## ステップ2: 必要なAPIを有効化

1. [APIライブラリ](https://console.cloud.google.com/apis/library) を開く
2. 以下の2つを検索して **「有効にする」** :
   - **Cloud Vision API**
   - **Cloud Storage** （通常はデフォルトで有効）

---

## ステップ3: GCSバケットを作成

1. [Cloud Storage](https://console.cloud.google.com/storage/browser) を開く
2. **「バケットを作成」** をクリック
3. 設定:
   - バケット名: `rageducation-ocr`（グローバルで一意な名前）
   - ロケーション: `asia-northeast1`（東京）
   - ストレージクラス: Standard
   - アクセス制御: 「均一」（デフォルト）
4. **作成**

---

## ステップ4: サービスアカウントを作成

1. [サービスアカウント](https://console.cloud.google.com/iam-admin/serviceaccounts) を開く
2. **「サービスアカウントを作成」** をクリック
3. 設定:
   - 名前: `ocr-pipeline`
   - ID: `ocr-pipeline`（自動入力される）
   - 説明: `PDF OCR用サービスアカウント`
4. **「作成して続行」** をクリック
5. ロールを付与（2つ追加）:
   - **`Storage オブジェクト管理者`** (`roles/storage.objectAdmin`)
   - **`Cloud Vision API ユーザー`** （見つからない場合はスキップ、API有効化で使用可能）
6. **「完了」** をクリック

---

## ステップ5: サービスアカウントキーをダウンロード

1. 作成した `ocr-pipeline` サービスアカウントをクリック
2. **「キー」** タブを開く
3. **「鍵を追加」** → **「新しい鍵を作成」**
4. タイプ: **JSON**
5. **「作成」** → JSONファイルがダウンロードされる
6. ダウンロードしたJSONを以下に配置:

```
C:\Users\rei\Realice\RAG\backend\rageducation-ocr-key.json
```

> ⚠️ このファイルは .gitignore に追加してGitにコミットしないこと

---

## ステップ6: PDFをバケットにアップロード

1. [バケット](https://console.cloud.google.com/storage/browser) を開く
2. 作成したバケットを選択
3. OCR対象のPDFファイルをドラッグ＆ドロップ

---

## ステップ7: 権限テスト

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\rei\Realice\RAG\backend\rageducation-ocr-key.json"
cd C:\Users\rei\Realice\RAG\backend
python scripts/check_gcs_permissions.py
```

> check_gcs_permissions.py のバケット名を新しいバケット名に変更する必要あり

---

## ステップ8: OCR実行

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\rei\Realice\RAG\backend\rageducation-ocr-key.json"
cd C:\Users\rei\Realice\RAG\backend

# 新バケットを指定してOCR実行
python scripts/pdf_ocr_pipeline.py --bucket rageducation-ocr

# RAG_Education用に出力先を変更する場合
python scripts/pdf_ocr_pipeline.py --bucket rageducation-ocr --output-dir ../RAG_Education/backend/data
```

---

## 完了後に教えてほしい情報

セットアップが終わったら、以下を教えてください:

1. **プロジェクトID** （例: `rageducation-452814`）
2. **バケット名** （例: `rageducation-ocr`）
3. **サービスアカウントキーのファイル名** （例: `rageducation-xxxx.json`）

→ スクリプトを自動で更新します。
