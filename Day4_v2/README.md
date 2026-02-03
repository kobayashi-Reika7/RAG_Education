# Day4_v2 ToDoアプリ（Day2相当 + Firestore永続化）

React（Vite）と Firebase Firestore を直結させた ToDo アプリです。  
**Day2 の機能を再現**しつつ、データを Firestore でクラウド永続化します。  
FastAPI バックエンドは補助用途（ヘルスチェック等）です。

## 特徴

- **データ経路**: フロントエンド → Firestore 直接（Firebase SDK）
- **機能**: Day2 相当（リスト／期限／お気に入り／カウンター／メモ／タイマー）
- **タイマー**: 表示用のみ。Firestore には保存せず、リロードでリセット（Day2 準拠）
- **ポート**: 5200（既存 Day4 と衝突回避）

## 前提

- Node.js（LTS 推奨）
- Firebase プロジェクト（Firestore 有効）
- React（Vite）、Firebase v9 以降（modular SDK）

## 起動方法

### フロントエンド

```bash
cd Day4_v2/frontend
npm install
cp .env.example .env   # 初回のみ: .env に Firebase 設定を記入
npm run dev
```

ブラウザで **http://localhost:5200** を開く。

**Firebase の準備**は `frontend/SETUP_FIREBASE.md` を参照（`.env` に `VITE_FIREBASE_*` を設定）。

### バックエンド（任意・補助用）

```bash
cd Day4_v2/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- `GET /health` でヘルスチェック
- ToDo の主データは Firestore。本アプリの主役はフロント＋Firestore です。

## 動作確認

- **リスト**: 追加／切替／削除（デフォルトは削除不可、削除時はタスクをデフォルトへ移動）
- **タスク**: 追加（先頭に出る）／完了／編集／削除／お気に入り／期限／メモ永続化
- **タイマー**: 1 つだけ開始、停止／リセットで表示が変わる。リロードでリセット

**詳細な動作確認チェックリスト**は **`docs/README.md`** を参照してください。

## ディレクトリ構成

```
Day4_v2/
├── README.md           # 本ファイル（起動方法・概要）
├── docs/
│   └── README.md       # データモデル・画面仕様・動作確認手順
├── frontend/           # React (Vite) + Firestore
│   ├── src/
│   │   ├── firebase/firebase.js
│   │   ├── services/firestore.js
│   │   ├── components/   # CounterRow, ListSection, TaskForm, TaskList, TaskItem 等
│   │   └── App.jsx
│   ├── vite.config.js   # port 5200
│   └── .env.example
└── backend/            # FastAPI（補助）
    ├── main.py         # CORS, GET /health
    └── requirements.txt
```

## Day2 との対応

| 機能       | Day2           | Day4_v2                 |
|------------|----------------|-------------------------|
| データ保存 | localStorage   | Firestore               |
| リスト名   | デフォルトリスト | デフォルトリスト        |
| タスク追加 | 先頭           | 先頭                    |
| タイマー   | 永続化しない   | 永続化しない（表示のみ）|
| カウンター | 4項目          | 4項目                   |
