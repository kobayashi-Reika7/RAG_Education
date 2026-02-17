"""Bedrock Knowledge Bases クライアント: RetrieveAndGenerate API を使った RAG 問い合わせ + 同期"""
import os
import time
import random
import logging
from urllib.parse import quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3

from src.config import BEDROCK_KB_ID, BEDROCK_MODEL_ARN, S3_REGION
from src import s3_storage

logger = logging.getLogger(__name__)
MIN_SOURCE_SCORE = 0.65

BEDROCK_DS_ID = os.getenv("BEDROCK_DS_ID", "")

_client = None
_agent_client = None


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


def _get_agent_client():
    """Bedrock Agent クライアントを取得する（同期用）。"""
    global _agent_client
    if _agent_client is None:
        _agent_client = boto3.client("bedrock-agent", region_name=S3_REGION)
    return _agent_client


def start_sync() -> dict:
    """Bedrock KB のデータソース同期（Ingestion Job）を開始する。
    S3 アップロード / 削除後に呼び出すと、チャンキング・ベクトル化が自動実行される。
    """
    if not BEDROCK_KB_ID or not BEDROCK_DS_ID:
        logger.warning("BEDROCK_KB_ID or BEDROCK_DS_ID が未設定のため同期をスキップ")
        return {"status": "skipped", "reason": "KB or DS ID not configured"}

    client = _get_agent_client()
    response = client.start_ingestion_job(
        knowledgeBaseId=BEDROCK_KB_ID,
        dataSourceId=BEDROCK_DS_ID,
    )
    job = response.get("ingestionJob", {})
    job_id = job.get("ingestionJobId", "")
    status = job.get("status", "")
    logger.info("Bedrock KB sync started: jobId=%s, status=%s", job_id, status)
    return {
        "status": "started",
        "ingestion_job_id": job_id,
        "ingestion_status": status,
    }


_NO_INFO_MARKER = "該当する情報がありません"


def _build_external_sources(question: str) -> list[dict]:
    """外部検索リンクを生成するヘルパー。"""
    q = quote_plus(question)
    return [
        {
            "chunk_id": "external",
            "section": "外部ソース (Google)",
            "content": f"内部データに該当情報がないため、外部検索結果を参照してください: {question}",
            "uri": f"https://www.google.com/search?q={q}",
        },
        {
            "chunk_id": "external",
            "section": "外部ソース (DuckDuckGo)",
            "content": f"内部データに該当情報がないため、外部検索結果を参照してください: {question}",
            "uri": f"https://duckduckgo.com/?q={q}",
        },
    ]


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
                "generationConfiguration": {
                    "promptTemplate": {
                        "textPromptTemplate": (
                            "あなたはRAG学習アプリの質問応答AIです。\n"
                            "検索結果に質問と関連する情報がある場合のみ、日本語で100文字以内に要約して回答してください。\n"
                            "検索結果に質問と関連する情報が全くない場合は、必ず「該当する情報がありません」とだけ回答してください。\n"
                            "絶対に検索結果にない情報を捏造しないでください。英語禁止。\n"
                            "検索結果:$search_results$\n"
                            "質問:$query$"
                        ),
                    },
                    "inferenceConfig": {
                        "textInferenceConfig": {
                            "maxTokens": 200,
                            "temperature": 0.0,
                        },
                    },
                },
            },
        },
    )

    output = response.get("output", {})
    answer = output.get("text", "回答を生成できませんでした。")
    if answer.startswith("日本語での回答:"):
        answer = answer[len("日本語での回答:"):].strip()

    # retrieve で関連度スコアを確認し、内部データに該当があるか判定
    top_score = 0.0
    s3_sources: list[dict] = []
    seen_sources: set[tuple[str, str]] = set()

    def _append_s3_source(uri: str, content_text: str):
        content = (content_text or "").strip()
        source_uri = (uri or "").strip()
        if not source_uri.startswith("s3://"):
            return
        if not content:
            return
        key = (source_uri, content)
        if key in seen_sources:
            return
        seen_sources.add(key)
        s3_sources.append({
            "chunk_id": "",
            "section": source_uri.split("/")[-1] if source_uri else "Bedrock KB",
            "content": content[:200],
            "uri": source_uri,
        })

    # citations からソースを抽出
    citations = response.get("citations", [])
    for citation in citations:
        for ref in citation.get("retrievedReferences", []):
            content_text = ref.get("content", {}).get("text", "")
            location = ref.get("location", {})
            s3_uri = ""
            if location.get("type") == "S3":
                s3_uri = location.get("s3Location", {}).get("uri", "")
            _append_s3_source(s3_uri, content_text)

    # retrieve で関連度スコアを取得しソースを補完
    try:
        retrieved = retrieve(question, k=5).get("results", [])
        for item in retrieved:
            score = float(item.get("score", 0.0) or 0.0)
            top_score = max(top_score, score)
            if score < MIN_SOURCE_SCORE:
                continue
            _append_s3_source(item.get("uri", ""), item.get("content", ""))
    except Exception as e:
        logger.warning("retrieve merge for sources failed: %s", e)

    # 内部データに該当がない場合の判定:
    # 1) LLM が「該当する情報がありません」と回答した
    # 2) retrieve の最高スコアが閾値未満（無関係な質問）
    no_internal_data = (
        _NO_INFO_MARKER in answer
        or top_score < MIN_SOURCE_SCORE
        or not s3_sources
    )

    if no_internal_data:
        answer_text = (
            answer if _NO_INFO_MARKER in answer
            else f"内部データに該当する情報が見つかりませんでした。外部検索をご利用ください。"
        )
        sources = _build_external_sources(question)
    else:
        answer_text = answer
        sources = s3_sources

    # 最終ガード: ソースが空にならないようにする
    if not sources:
        sources = _build_external_sources(question)

    elapsed = int((time.time() - start) * 1000)

    return {
        "answer": answer_text,
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
    ランダムなトピックで並列検索し、多様なコンテンツを高速に返す。
    """
    queries = random.sample(_TOPIC_QUERIES, min(count, len(_TOPIC_QUERIES)))
    contents: list[str] = []
    seen: set[str] = set()

    def _fetch(query: str) -> list[str]:
        try:
            result = retrieve(query, k=1)
            return [item["content"].strip() for item in result["results"] if item["content"].strip()]
        except Exception as e:
            logger.warning("Bedrock KB retrieve failed for '%s': %s", query, e)
            return []

    with ThreadPoolExecutor(max_workers=min(len(queries), 5)) as pool:
        futures = {pool.submit(_fetch, q): q for q in queries}
        for future in as_completed(futures):
            for text in future.result():
                if text not in seen:
                    seen.add(text)
                    contents.append(text)

    return contents


def preview_chunks(
    queries: list[str] | None = None,
    k: int = 10,
    max_items: int = 200,
) -> dict:
    """クエリ群に対する取得チャンクを重複排除して返す。"""
    selected_queries = queries or list(_TOPIC_QUERIES)
    selected_queries = [q.strip() for q in selected_queries if q and q.strip()]
    if not selected_queries:
        selected_queries = list(_TOPIC_QUERIES)

    rows = []
    seen: set[tuple[str, str]] = set()

    for q in selected_queries:
        result = retrieve(q, k=k)
        for item in result.get("results", []):
            uri = (item.get("uri") or "").strip()
            content = (item.get("content") or "").strip()
            if not content:
                continue
            key = (uri, content)
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "query": q,
                "uri": uri,
                "score": item.get("score", 0.0),
                "content": content,
            })
            if len(rows) >= max_items:
                return {"count": len(rows), "queries": selected_queries, "chunks": rows}

    return {"count": len(rows), "queries": selected_queries, "chunks": rows}
