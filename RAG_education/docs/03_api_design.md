# API設計書

## RAG教育クイズアプリ

| 項目       | 内容                         |
| ---------- | ---------------------------- |
| 作成日     | 2026/02/16                   |
| バージョン | 1.0                          |
| ベースURL  | `http://localhost:7000`      |

---

## API一覧

| # | メソッド | エンドポイント      | 機能             |
| - | -------- | ------------------- | ---------------- |
| 1 | POST     | `/api/ask`          | 質問応答         |
| 2 | POST     | `/api/quiz/generate`| クイズ生成       |
| 3 | POST     | `/api/quiz/evaluate`| クイズ判定       |
| 4 | GET      | `/api/health`       | ヘルスチェック   |

---

## 1. 質問応答API

### `POST /api/ask`

マニュアルの内容に基づいて質問に回答する。

#### リクエスト

```json
{
  "question": "有給休暇の申請方法を教えてください",
  "history": [
    {
      "role": "user",
      "content": "前の質問..."
    },
    {
      "role": "assistant",
      "content": "前の回答..."
    }
  ]
}
```

| フィールド | 型       | 必須 | 説明                                 |
| ---------- | -------- | ---- | ------------------------------------ |
| question   | string   | ○    | ユーザーの質問文（最大500文字）      |
| history    | array    | ×    | 会話履歴（直近5往復まで）            |

#### レスポンス（200 OK）

```json
{
  "answer": "有給休暇の申請方法は以下の通りです。\n1. 勤怠システムにログイン\n2. 「休暇申請」メニューを選択\n3. 希望日を入力して申請ボタンを押す\n\n申請後、直属の上長が承認する流れとなります。",
  "sources": [
    {
      "chunk_id": "manual_012",
      "section": "休暇申請手順",
      "content": "有給休暇を取得する場合は..."
    }
  ],
  "response_time_ms": 3200
}
```

| フィールド      | 型       | 説明                          |
| --------------- | -------- | ----------------------------- |
| answer          | string   | LLMが生成した回答文           |
| sources         | array    | 参照したチャンクのリスト      |
| sources[].chunk_id | string | チャンクID                  |
| sources[].section  | string | セクション名                |
| sources[].content  | string | チャンク内容（抜粋）        |
| response_time_ms   | number | 処理時間（ミリ秒）          |

#### エラーレスポンス（400）

```json
{
  "error": "質問が空です",
  "code": "EMPTY_QUESTION"
}
```

---

## 2. クイズ生成API

### `POST /api/quiz/generate`

指定した難易度でクイズを1問生成する。

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
  "quiz_id": "q_20260216_001",
  "difficulty": "beginner",
  "question": "入社後6ヶ月で付与される有給休暇は何日ですか？",
  "hint": "労働基準法第39条に規定されています。",
  "source_chunk_ids": ["manual_015", "manual_016"],
  "expected_answer": "10日",
  "response_time_ms": 4500
}
```

| フィールド        | 型       | 説明                              |
| ----------------- | -------- | --------------------------------- |
| quiz_id           | string   | クイズ識別子（判定時に使用）      |
| difficulty        | string   | 難易度                            |
| question          | string   | 問題文                            |
| hint              | string   | ヒント（任意。nullの場合あり）    |
| source_chunk_ids  | array    | 出題元のチャンクID群              |
| expected_answer   | string   | 模範解答（フロントには非表示）    |
| response_time_ms  | number   | 処理時間（ミリ秒）               |

> **注意**: `expected_answer` はバックエンド側で判定に使用する。
> フロント側ではこのフィールドを表示しない。

---

## 3. クイズ判定API

### `POST /api/quiz/evaluate`

ユーザーの回答を正誤判定し、解説を返す。

#### リクエスト

```json
{
  "quiz_id": "q_20260216_001",
  "question": "入社後6ヶ月で付与される有給休暇は何日ですか？",
  "expected_answer": "10日",
  "user_answer": "10日間です",
  "difficulty": "beginner",
  "source_chunk_ids": ["manual_015", "manual_016"]
}
```

| フィールド        | 型       | 必須 | 説明                            |
| ----------------- | -------- | ---- | ------------------------------- |
| quiz_id           | string   | ○    | クイズ識別子                    |
| question          | string   | ○    | 問題文                          |
| expected_answer   | string   | ○    | 模範解答                        |
| user_answer       | string   | ○    | ユーザーの回答（最大500文字）   |
| difficulty        | string   | ○    | 難易度                          |
| source_chunk_ids  | array    | ○    | 出題元チャンクID群              |

#### レスポンス（200 OK）

```json
{
  "quiz_id": "q_20260216_001",
  "is_correct": true,
  "score": 1.0,
  "feedback": "正解です！入社後6ヶ月経過し、全労働日の8割以上出勤した場合、10日の有給休暇が付与されます。",
  "explanation": "労働基準法第39条に基づき、6ヶ月間継続勤務し、全労働日の8割以上出勤した労働者に対して、10日の年次有給休暇が付与されます。",
  "source_section": "就業規則 第5章 休暇",
  "response_time_ms": 2800
}
```

| フィールド      | 型       | 説明                                    |
| --------------- | -------- | --------------------------------------- |
| quiz_id         | string   | クイズ識別子                            |
| is_correct      | boolean  | 正解かどうか                            |
| score           | number   | 得点 0.0 〜 1.0（部分点あり）           |
| feedback        | string   | 短いフィードバック（○×＋一言）          |
| explanation     | string   | 詳しい解説（不正解時は特に詳細）        |
| source_section  | string   | 出典セクション名                        |
| response_time_ms| number   | 処理時間（ミリ秒）                      |

---

## 4. ヘルスチェックAPI

### `GET /api/health`

システムの稼働状態を確認する。

#### レスポンス（200 OK）

```json
{
  "status": "ok",
  "ollama_connected": true,
  "chromadb_ready": true,
  "chunks_loaded": 42
}
```

---

## 共通エラーレスポンス

| HTTPステータス | コード              | 説明                       |
| -------------- | ------------------- | -------------------------- |
| 400            | EMPTY_QUESTION      | 質問/回答が空              |
| 400            | INVALID_DIFFICULTY  | 不正な難易度               |
| 500            | LLM_ERROR           | Ollama接続エラー           |
| 500            | SEARCH_ERROR        | ベクトル検索エラー         |
| 503            | SERVICE_UNAVAILABLE | Ollama未起動               |

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

---

## CORS設定

開発時は Next.js (localhost:3000) からのアクセスを許可する。

```python
origins = ["http://localhost:3000"]
```

---

## AWS デプロイ時の変更点

### エンドポイント

| 環境     | ベースURL                                         |
| -------- | ------------------------------------------------- |
| ローカル | `http://localhost:7000`                           |
| AWS本番  | `https://{api-id}.execute-api.ap-northeast1.amazonaws.com/prod` |

### Lambda + API Gateway 構成

- FastAPI を **Mangum** アダプタ経由で Lambda にデプロイ
- API Gateway (REST API) がルーティングを担当
- エンドポイントパスはローカルと同一（`/api/ask`, `/api/quiz/*`）

```python
# main.py（Lambda対応）
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()
# ... ルート定義 ...

handler = Mangum(app)  # Lambda ハンドラ
```

### 追加の環境変数（Lambda）

| 変数名             | 値                          | 説明                   |
| ------------------ | --------------------------- | ---------------------- |
| APP_ENV            | `aws`                       | 環境識別               |
| AWS_REGION         | `ap-northeast-1`            | Bedrockリージョン      |
| BEDROCK_MODEL_ID   | `anthropic.claude-3-5-haiku-20241022-v1:0` | LLMモデル |
| OPENSEARCH_ENDPOINT| `https://xxx.aoss.amazonaws.com` | ベクトルDB         |

---

## 変更履歴

| 日付       | バージョン | 内容                              |
| ---------- | ---------- | --------------------------------- |
| 2026/02/16 | 1.0        | 初版作成                          |
| 2026/02/16 | 1.1        | AWS構成追加（Lambda/API Gateway） |
