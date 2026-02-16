🛠 RAG 実装者向け用語集
🧠 モデル／API関連
LLM（Large Language Model）

回答生成を担当するモデル。
👉 出力品質・token制限・レイテンシに影響。

Embeddingモデル

テキスト → ベクトル変換専用モデル。
👉 検索品質を最も左右する要素。

⚠ 変更時は再Embedding必須。

temperature

生成ランダム性パラメータ。
低 → 安定／高 → 多様だが揺れる。

max_tokens

出力token上限。
👉 長文回答制御・コスト制御。

System Prompt

LLMの役割・制約定義。
👉 RAGでは「文脈厳守」指示が重要。

🔎 Retrieval／検索関連
Retriever

検索ロジックを担当するコンポーネント。

役割：

✔ 類似検索
✔ フィルタ適用
✔ Top-K制御

Top-K

取得チャンク件数。

設計ミス：

❌ 多すぎ → ノイズ・token圧迫
❌ 少なすぎ → 情報不足

Similarity Search

ベクトル類似度検索。

代表距離：

✔ Cosine
✔ L2距離
✔ Inner Product

Score Threshold

類似度が一定以下を除外。

👉 ノイズ抑制の重要パラメータ。

Hybrid Search

BM25 + ベクトル検索。

👉 FAQ／仕様書検索で有効。

Re-ranking

取得候補の再順位付け。

手法：

✔ Cross-Encoder
✔ LLM-based rerank

📄 データ前処理関連
Chunk（チャンク）

検索単位テキスト。

設計ポイント：

✔ 長さ（token数）
✔ 意味単位
✔ Overlap

Chunk Size

チャンクの長さ。

短すぎ → 文脈不足
長すぎ → ノイズ混入

Overlap

隣接チャンクの重複領域。

👉 文脈切断防止。

Metadata

検索補助情報。

例：

✔ source
✔ category
✔ timestamp
✔ document_id

👉 フィルタ検索／監査ログに必須。

Indexing

Embedding化＋DB登録処理。

Re-indexing

再Embedding処理。

必要タイミング：

✔ Embedding変更
✔ 文書更新
✔ チャンク設計変更

🗄 ベクトルDB関連
Vector Database

ベクトル保存＋類似検索DB。

代表例：

✔ Pinecone
✔ Weaviate
✔ Milvus
✔ FAISS

Vector Dimension

ベクトル次元数。

⚠ モデル不一致 → エラー／検索破綻。

ANN（Approximate Nearest Neighbor）

高速近似検索アルゴリズム。

👉 精度 vs 速度のトレードオフ。

HNSW

高性能ANNアルゴリズム。

👉 多くのVectorDBで採用。

🎯 精度／品質評価関連
Recall

関連文書を取りこぼさない割合。

Precision

取得文書の正確性。

Retrieval Quality

検索精度全体評価。

Context Pollution

無関係チャンク混入。

👉 回答破綻の典型原因。

Grounding

文脈根拠に基づく回答。

Hallucination

LLMの事実でない生成。

⚙️ パフォーマンス関連
Latency

応答時間。

影響要因：

✔ 検索速度
✔ Top-K
✔ Prompt長
✔ LLM推論時間

Token Budget

LLM入力制限管理。

Context Window

LLMが処理可能な最大token。

Batch Embedding

Embedding一括処理。

👉 インデックス高速化。

Caching

検索結果／回答保存。

👉 レイテンシ削減。

🚨 障害／トラブル関連
Embedding Mismatch

異なるEmbedding混在。

症状：

❌ 検索精度崩壊
❌ 類似度異常

Index Drift

データ更新漏れ。

Stale Knowledge

古い文書参照。

Empty Retrieval

検索結果ゼロ。

対策：

✔ クエリ改善
✔ Top-K調整
✔ Threshold調整

Over-Context

文脈過多。

症状：

❌ Token超過
❌ 回答不安定