# Reservation-Calendar（Day5）

予約カレンダー用リポジトリ。Day5 は本リポジトリで別管理する。

- リモート: https://github.com/kobayashi-Reika7/Reservation-Calendar.git
- 開発時は親プロジェクトの `.cursorrules` に従う（ブランチ `ai-generated` / `main` 運用）

## 予約アプリ（フロントエンド）

- **技術**: React, Vite, Firebase（Authentication / Firestore）, react-router-dom
- **画面**: ログイン / 新規登録 / カレンダー / 予約入力 / 予約確認・完了
- **構成**: `frontend/src/` に `pages/`・`components/`・`services/`・`firebase/` を配置
- **ドキュメント**: [docs/README.md](docs/README.md) に要件・設計・セットアップ・テストの一覧

### プロンプト集との対応（参考）

- ログイン: プロンプトの `loginUser` → 実装は `services/auth.js` の `login(email, password)`
- 予約保存: プロンプトの `addReservation` → 実装は `services/reservation.js` の `createReservation(uid, data)`
- フォーム項目: 要件定義書に合わせて 大分類・診療科・目的・担当医・時間 を採用

### セットアップ

**1. バックエンド（Firebase IDトークン検証 / ユーザー同期）**

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8002
```

- API: http://localhost:8002
- エンドポイント: `GET /users/me`（IDトークン検証）, `GET /health`

**2. フロントエンド**

```bash
cd frontend
cp .env.example .env
# .env に Firebase（VITE_FIREBASE_*）と必要なら VITE_API_BASE=http://localhost:8002
npm install
npm run dev
```

- ブラウザは http://localhost:5200 で開く（スマホ表示で確認推奨）
- バックエンドは **任意**（起動していなくてもログイン/予約は動きます）。起動していると `/users/me` で同期確認できます。
- Firebase Console で **Authentication → サインイン方法 → メール/パスワード** を有効にすること
- Firestore を有効にし、`users/{uid}/reservations` 用のセキュリティルールを設定すること（下記「Firestore への書き込み」参照）
- **ログイン手順・デモデータ・トラブル**: [docs/02-セットアップとトラブル.md](docs/02-セットアップとトラブル.md) を参照

### Firestore への書き込み

- **書き込み先**: `users/{uid}/reservations`（`uid` は Firebase Auth のユーザーID）
- **フロントからの書き込み**: ログイン後、予約確定時に `createReservation(uid, data)` が `addDoc` で Firestore に追加する
- **セキュリティルール**: リポジトリの [firestore.rules](firestore.rules) を Firebase にデプロイすると、認証済みユーザーが自分の `users/{uid}/reservations` のみ読み書きできるようになる  
  - Firebase CLI でデプロイ: `firebase deploy --only firestore:rules`（プロジェクトで `firebase init firestore` 済みで、`firestore.rules` のパスが一致していること）
  - または Firebase Console → Firestore → ルール に `firestore.rules` の内容をコピーして保存
- **複合インデックス**: 担当医指定時の重複チェックに `collectionGroup('reservations')` を使うため、[firestore.indexes.json](firestore.indexes.json) をデプロイする（`firebase deploy --only firestore:indexes`）。未デプロイだと該当クエリでエラーになる場合がある
- **書き込みに失敗する場合**: Console でルールが「認証済みユーザーが自分のドキュメントのみ」になっているか、Authentication でメール/パスワードが有効か確認する
- **「予約済み担当医」の照合**: フォームで担当医を選ぶ際、同一日時で既に予約されている担当医は選択不可になる。`collectionGroup('reservations')` で `date` を指定して取得している。初回実行時に Firestore がインデックス作成を促す場合は、コンソールのリンクから複合インデックスを作成する

### よくあるエラー

- **新規登録で 400 が出る**: Firebase Console で「メール/パスワード」が有効か確認してください。
- **favicon.ico 404**: 無視して問題ありません（アプリ内で SVG アイコンを指定済み）。
