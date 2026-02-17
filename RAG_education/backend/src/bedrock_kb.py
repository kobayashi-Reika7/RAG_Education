"""Bedrock Knowledge Bases クライアント: RetrieveAndGenerate API を使った RAG 問い合わせ"""
import time
import random
import logging

import boto3

from src.config import BEDROCK_KB_ID, BEDROCK_MODEL_ARN, S3_REGION

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    """Bedrock Agent Runtime クライアントを取得する。"""
    global _client
    if _client is None:
        if not BEDROCK_KB_ID:
            raise ValueError("BEDROCK_KB_ID が設定されていません。.env を確認してください。")
        if not BEDROCK_MODEL_ARN:
            raise ValueError("BEDROCK_MODEL_ARN が設定されていません。.env を確認してください。")
        _client = boto3.client("bedrock-agent-runtime", region_name=S3_REGION)
    return _client


def ask(question: str) -> dict:
    """Bedrock Knowledge Bases に問い合わせて RAG 回答を取得する。"""
    start = time.time()
    client = _get_client()

    response = client.retrieve_and_generate(
        input={"text": question},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": BEDROCK_KB_ID,
                "modelArn": BEDROCK_MODEL_ARN,
            },
        },
    )

    output = response.get("output", {})
    answer = output.get("text", "回答を生成できませんでした。")

    citations = response.get("citations", [])
    sources = []
    for citation in citations:
        for ref in citation.get("retrievedReferences", []):
            content_text = ref.get("content", {}).get("text", "")
            location = ref.get("location", {})
            s3_uri = ""
            if location.get("type") == "S3":
                s3_uri = location.get("s3Location", {}).get("uri", "")

            sources.append({
                "chunk_id": "",
                "section": s3_uri.split("/")[-1] if s3_uri else "Bedrock KB",
                "content": content_text[:200],
                "uri": s3_uri,
            })

    elapsed = int((time.time() - start) * 1000)

    return {
        "answer": answer,
        "sources": sources,
        "response_time_ms": elapsed,
    }


def retrieve(question: str, k: int = 3) -> dict:
    """Bedrock Knowledge Bases から関連チャンクのみ取得する（生成なし）。"""
    start = time.time()
    client = _get_client()

    response = client.retrieve(
        knowledgeBaseId=BEDROCK_KB_ID,
        retrievalQuery={"text": question},
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": k,
            }
        },
    )

    results = []
    for item in response.get("retrievalResults", []):
        content_text = item.get("content", {}).get("text", "")
        score = item.get("score", 0.0)
        location = item.get("location", {})
        s3_uri = ""
        if location.get("type") == "S3":
            s3_uri = location.get("s3Location", {}).get("uri", "")

        results.append({
            "content": content_text,
            "score": score,
            "uri": s3_uri,
        })

    elapsed = int((time.time() - start) * 1000)

    return {
        "results": results,
        "response_time_ms": elapsed,
    }


# クイズ・演習用の検索クエリ（多様なコンテンツを取得するため）
_TOPIC_QUERIES = [
    "RAGとは何ですか",
    "LLMの基礎と限界",
    "Embeddingとベクトル検索",
    "ベクトルDBの役割",
    "検索精度の重要性",
    "OCRとデータ前処理",
    "プロンプト設計",
    "ハルシネーション対策",
    "フロントエンドとバックエンドの役割",
    "アプリ全体構成",
]


def get_contents_for_quiz(count: int = 3) -> list[str]:
    """クイズ・演習生成用にナレッジベースからコンテンツを取得する。
    ランダムなトピックで検索し、多様なコンテンツを返す。
    """
    queries = random.sample(_TOPIC_QUERIES, min(count, len(_TOPIC_QUERIES)))
    contents = []
    seen = set()

    for query in queries:
        try:
            result = retrieve(query, k=2)
            for item in result["results"]:
                text = item["content"].strip()
                if text and text not in seen:
                    seen.add(text)
                    contents.append(text)
        except Exception as e:
            logger.warning("Bedrock KB retrieve failed for '%s': %s", query, e)

    return contents
