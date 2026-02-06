# Day5 バックエンド（予約 API）

フロントエンドが空き枠取得（GET /api/slots）と予約作成（POST /api/reservations）を利用するため、**このバックエンドを起動する必要があります**。

## 起動方法

1. **Day5/backend** フォルダで以下を実行してください。

   ```bash
   # 初回のみ
   python -m venv venv
   venv\Scripts\pip install -r requirements.txt

   # 起動（ポート 8002）
   run.bat
   ```

   または:

   ```bash
   venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8002
   ```

2. 起動後、以下で動作確認できます。

   - ヘルスチェック: http://localhost:8002/health
   - 空き枠 API: http://localhost:8002/api/slots?department=循環器内科&date=2026-02-10

3. フロントエンドは **http://localhost:8002** をデフォルトで参照します（`VITE_API_BASE` 未設定時）。

## 404 が出る場合

- ポート 8002 で**このバックエンド（Day5/backend）**が動いているか確認してください。
- 別のアプリが 8002 を使っていると、/api/slots や /api/reservations が 404 になります。
- 必ず **Day5/backend** ディレクトリで `run.bat` または `uvicorn main:app --port 8002` を実行してください。

## 医師データ（空き枠の○を出す）

- 医師データ未投入時は、環境変数 `USE_DEMO_SLOTS=1`（デフォルト）で平日午前にデモの○を返します。
- 本番データを使う場合は `run_seed_doctors.bat` で Firestore に医師データを投入してください。
