# API設計書

## RAG教育クイズアプリ

| 項目       | 内容                         |
| ---------- | ---------------------------- |
| 作成日     | 2026/02/16                   |
| バージョン | 2.0                          |
| ベースURL（ローカル）| `http://localhost:7000` |
| ベースURL（AWS）    | `https://yequzq6pn2.execute-api.ap-northeast-1.amazonaws.com` |

---

## 認証ヘッダー

全APIで Firebase Authentication のIDトークンを **任意** で送信できる。
トークンがある場合、学習履歴がFirestoreに自動保存される。

```
Authorization: Bearer <Firebase ID Token>
```

---

## API一覧

| # | メソッド | エンドポイント         | 機能             | 認証   |
| - | -------- | ---------------------- | ---------------- | ------ |
| 1 | POST     | `/api/ask`             | 質問応答         | 任意   |
| 2 | POST     | `/api/quiz/generate`   | クイズ生成       | 任意   |
| 3 | POST     | `/api/quiz/evaluate`   | クイズ判定       | 任意   |
| 4 | POST     | `/api/practice/generate`| 問題演習生成    | 任意   |
| 5 | POST     | `/api/practice/answer` | 演習回答記録     | 任意   |
| 6 | GET      | `/api/me/stats`        | 学習統計取得     | 必須   |
| 7 | GET      | `/api/health`          | ヘルスチェック   | 不要   |

---

## 1. 質問応答API

### `POST /api/ask`

マニュアルの内容に基づいて質問に回答する。

#### リクエスト

```json
{
  "question": "RAGとは何ですか？",
  "history": []
}
```

| フィールド | 型       | 必須 | 説明                                 |
| ---------- | -------- | ---- | ------------------------------------ |
| question   | string   | ○    | ユーザーの質問文（最大500文字）      |
| history    | array    | ×    | 会話履歴（直近5往復まで）            |

#### レスポンス（200 OK）

```json
{
  "answer": "RAG（Retrieval-Augmented Generation）とは、検索と生成を組み合わせたAI技術です。...",
  "sources": [
    {
      "chunk_id": "manual_003",
      "section": "第3章：RAGの基礎",
      "content": "RAGは「検索拡張生成」と訳される..."
    }
  ],
  "response_time_ms": 3200
}
```

| フィールド            | 型       | 説明                          |
| --------------------- | -------- | ----------------------------- |
| answer                | string   | LLMが生成した回答文           |
| sources               | array    | 参照したチャンクのリスト      |
| sources[].chunk_id    | string   | チャンクID                    |
| sources[].section     | string   | セクション名                  |
| sources[].content     | string   | チャンク内容（先頭200文字）   |
| response_time_ms      | number   | 処理時間（ミリ秒）            |

---

## 2. クイズ生成API

### `POST /api/quiz/generate`

指定した難易度でクイズを1問生成する。フロントエンドで5回呼び出して5問セットにする。

#### リクエスト

```json
{
  "difficulty": "beginner"
}
```

| フィールド | 型     | 必須 | 説明                                             |
| ---------- | ------ | ---- | ------------------------------------------------ |
| difficulty | string | ○    | `beginner` / `intermediate` / `advanced`         |

#### レスポンス（200 OK）

```json
{
  "quiz_id": "q_a1b2c3d4",
  "difficulty": "beginner",
  "format": "一問一答",
  "question": "RAGの正式名称は何ですか？",
  "hint": "Retrieval-Augmented の頭文字です。",
  "source_chunk_ids": ["manual_003", "manual_004"],
  "expected_answer": "Retrieval-Augmented Generation（検索拡張生成）",
  "response_time_ms": 4500
}
```

| フィールド        | 型       | 説明                              |
| ----------------- | -------- | --------------------------------- |
| quiz_id           | string   | クイズ識別子（判定時に使用）      |
| difficulty        | string   | 難易度                            |
| format            | string   | 出題形式（一問一答/穴埋め/○×判定/比較説明/理由説明/具体例） |
| question          | string   | 問題文（100文字以内）             |
| hint              | string   | ヒント（nullの場合あり）          |
| source_chunk_ids  | array    | 出題元のチャンクID群              |
| expected_answer   | string   | 模範解答                          |
| response_time_ms  | number   | 処理時間（ミリ秒）               |

---

## 3. クイズ判定API

### `POST /api/quiz/evaluate`

ユーザーの回答を正誤判定し、解説を返す。
認証済みの場合、結果をFirestoreに自動保存する。

#### リクエスト

```json
{
  "quiz_id": "q_a1b2c3d4",
  "question": "RAGの正式名称は何ですか？",
  "expected_answer": "Retrieval-Augmented Generation",
  "user_answer": "検索拡張生成です",
  "difficulty": "beginner",
  "source_chunk_ids": ["manual_003"]
}
```

| フィールド        | 型       | 必須 | 説明                            |
| ----------------- | -------- | ---- | ------------------------------- |
| quiz_id           | string   | ○    | クイズ識別子                    |
| question          | string   | ○    | 問題文                          |
| expected_answer   | string   | ○    | 模範解答                        |
| user_answer       | string   | ○    | ユーザーの回答（最大500文字）   |
| difficulty        | string   | ○    | 難易度                          |
| source_chunk_ids  | array    | ×    | 出題元チャンクID群              |

#### レスポンス（200 OK）

```json
{
  "quiz_id": "q_a1b2c3d4",
  "is_correct": true,
  "score": 0.9,
  "feedback": "正解です！",
  "explanation": "RAGはRetrieval-Augmented Generationの略で、日本語では「検索拡張生成」と訳されます。",
  "source_section": "",
  "response_time_ms": 2800
}
```

| フィールド      | 型       | 説明                                    |
| --------------- | -------- | --------------------------------------- |
| quiz_id         | string   | クイズ識別子                            |
| is_correct      | boolean  | 正解かどうか                            |
| score           | number   | 得点 0.0 〜 1.0（部分点あり）           |
| feedback        | string   | 短いフィードバック                      |
| explanation     | string   | 詳しい解説                              |
| source_section  | string   | 出典セクション名                        |
| response_time_ms| number   | 処理時間（ミリ秒）                      |

---

## 4. 問題演習生成API

### `POST /api/practice/generate`

マニュアル内容から4択問題を生成する。

#### リクエスト

```json
{
  "count": 1
}
```

| フィールド | 型     | 必須 | 説明                     |
| ---------- | ------ | ---- | ------------------------ |
| count      | number | ×    | 生成問題数（デフォルト1）|

#### レスポンス（200 OK）

```json
{
  "practice_id": "p_e5f6g7h8",
  "question": "RAGにおいて「Retrieval」が指すのは？",
  "choices": {
    "A": "AIモデルの学習",
    "B": "外部データの検索・取得",
    "C": "回答テキストの生成",
    "D": "データの前処理"
  },
  "correct": "B",
  "explanation": "RAGのR（Retrieval）は外部データベースから関連情報を検索・取得するプロセスを指します。",
  "response_time_ms": 3800
}
```

| フィールド        | 型       | 説明                              |
| ----------------- | -------- | --------------------------------- |
| practice_id       | string   | 問題識別子                        |
| question          | string   | 問題文（100文字以内）             |
| choices           | object   | A/B/C/D の選択肢                  |
| correct           | string   | 正解（A/B/C/D のいずれか）        |
| explanation       | string   | 解説                              |
| response_time_ms  | number   | 処理時間（ミリ秒）               |

---

## 5. 演習回答記録API

### `POST /api/practice/answer`

演習の回答結果をFirestoreに記録する。

#### リクエスト（クエリパラメータ）

| パラメータ | 型     | 必須 | 説明             |
| ---------- | ------ | ---- | ---------------- |
| quiz_id    | string | ○    | 問題識別子       |
| selected   | string | ○    | ユーザー選択(A-D)|
| correct    | string | ○    | 正解(A-D)        |
| question   | string | ×    | 問題文           |

#### レスポンス（200 OK）

```json
{
  "status": "ok"
}
```

---

## 6. 学習統計API

### `GET /api/me/stats`

ログインユーザーの学習統計と直近の履歴を返す。**認証必須**。

#### レスポンス（200 OK）

```json
{
  "total_quizzes": 15,
  "total_practices": 23,
  "avg_score": 0.78,
  "streak_days": 3,
  "last_active": "2026-02-16T08:30:00+00:00",
  "recent_history": [
    {
      "id": "abc123",
      "type": "quiz",
      "question": "RAGとは何ですか？",
      "is_correct": true,
      "score": 1.0,
      "timestamp": "2026-02-16T08:25:00+00:00",
      "difficulty": "beginner",
      "format": "一問一答"
    }
  ]
}
```

| フィールド          | 型       | 説明                          |
| ------------------- | -------- | ----------------------------- |
| total_quizzes       | number   | 総クイズ回答数                |
| total_practices     | number   | 総演習回答数                  |
| avg_score           | number   | 平均スコア (0.0〜1.0)        |
| streak_days         | number   | 連続学習日数                  |
| last_active         | string   | 最終学習日時（ISO8601）       |
| recent_history      | array    | 直近の学習履歴                |

---

## 7. ヘルスチェックAPI

### `GET /api/health`

システムの稼働状態を確認する。

#### レスポンス（200 OK）

```json
{
  "status": "ok",
  "chromadb_ready": true,
  "chunks_loaded": 14
}
```

---

## 共通エラーレスポンス

| HTTPステータス | コード              | 説明                       |
| -------------- | ------------------- | -------------------------- |
| 400            | EMPTY_QUESTION      | 質問/回答が空              |
| 400            | INVALID_DIFFICULTY  | 不正な難易度               |
| 401            | -                   | 認証が必要（/api/me/stats）|
| 500            | LLM_ERROR           | Gemini API接続エラー       |
| 500            | FIRESTORE_ERROR     | Firestore読み書きエラー    |

```json
{
  "detail": {
    "error": "エラーメッセージ",
    "code": "ERROR_CODE"
  }
}
```

---

## CORS設定

| 環境     | 許可オリジン                                                          |
| -------- | --------------------------------------------------------------------- |
| ローカル | `http://localhost:3000`                                              |
| AWS本番  | `http://rageducation-frontend.s3-website-ap-northeast-1.amazonaws.com` |

---

## 変更履歴

| 日付       | バージョン | 内容                              |
| ---------- | ---------- | --------------------------------- |
| 2026/02/16 | 1.0        | 初版作成                          |
| 2026/02/16 | 1.1        | AWS構成追加（Lambda/API Gateway） |
| 2026/02/16 | 2.0        | 実装に合わせ全面改訂（認証/演習/統計API追加、クイズformat追加、Gemini対応） |
