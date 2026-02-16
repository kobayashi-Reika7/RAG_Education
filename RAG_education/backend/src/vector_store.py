"""軽量ベクトルストア（ChromaDB 不要）

embeddings.json を読み込み、コサイン類似度で検索する。
Lambda 環境ではこちらを使用し、ローカル開発では ChromaDB を使用する。
"""
import json
import math
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_store: Optional["SimpleVectorStore"] = None


class SimpleVectorStore:
    """14チャンク程度の小規模データ向け軽量ベクトルストア。"""

    def __init__(self, records: list[dict]):
        self.records = records
        self._ids = [r["id"] for r in records]
        self._documents = [r["document"] for r in records]
        self._metadatas = [r["metadata"] for r in records]
        self._embeddings = [r["embedding"] for r in records]
        logger.info("SimpleVectorStore: %d ドキュメントをロード", len(records))

    @classmethod
    def from_json(cls, path: str | Path) -> "SimpleVectorStore":
        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)
        return cls(records)

    @classmethod
    def from_s3(cls, bucket: str, key: str = "data/embeddings.json") -> "SimpleVectorStore":
        """S3 から embeddings.json をダウンロードしてロード。"""
        import boto3

        local_path = "/tmp/embeddings.json"
        if not os.path.exists(local_path):
            logger.info("S3 からダウンロード: s3://%s/%s", bucket, key)
            s3 = boto3.client("s3")
            s3.download_file(bucket, key, local_path)

        return cls.from_json(local_path)

    def get(self) -> dict:
        """ChromaDB 互換の get() インターフェース。"""
        return {
            "ids": self._ids,
            "documents": self._documents,
            "metadatas": self._metadatas,
        }

    def similarity_search_with_score(
        self, query_embedding: list[float], k: int = 5
    ) -> list[tuple[dict, float]]:
        """コサイン距離で検索。スコアが小さいほど類似。"""
        scores = []
        for i, emb in enumerate(self._embeddings):
            dist = _cosine_distance(query_embedding, emb)
            scores.append((i, dist))

        scores.sort(key=lambda x: x[1])

        results = []
        for idx, dist in scores[:k]:
            doc_info = {
                "page_content": self._documents[idx],
                "metadata": self._metadatas[idx],
            }
            results.append((doc_info, dist))

        return results


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """コサイン距離 = 1 - コサイン類似度。"""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return 1.0 - dot / (norm_a * norm_b)


def get_store() -> SimpleVectorStore:
    """シングルトンでストアを返す。"""
    global _store
    if _store is not None:
        return _store

    from src.config import APP_ENV, CHROMA_S3_BUCKET, DATA_DIR

    if APP_ENV == "lambda" and CHROMA_S3_BUCKET:
        _store = SimpleVectorStore.from_s3(CHROMA_S3_BUCKET, "data/embeddings.json")
    else:
        json_path = DATA_DIR / "embeddings.json"
        if json_path.exists():
            _store = SimpleVectorStore.from_json(json_path)
        else:
            raise FileNotFoundError(
                f"embeddings.json が見つかりません: {json_path}\n"
                "python -m scripts.export_embeddings を実行してください。"
            )

    return _store
