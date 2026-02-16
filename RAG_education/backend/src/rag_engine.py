"""RAG検索 + 回答生成エンジン（ChromaDB / 軽量ストア 両対応）"""
import os
import re
import time
import logging

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from src.config import (
    EMBEDDING_MODEL, SCORE_THRESHOLD, SEARCH_TOP_K, SEARCH_RETURN_K,
    APP_ENV, load_prompt,
)
from src.llm_client import get_llm

logger = logging.getLogger(__name__)

_vectordb = None  # ChromaDB (ローカル)
_embeddings_fn = None


def _get_embeddings() -> GoogleGenerativeAIEmbeddings:
    global _embeddings_fn
    if _embeddings_fn is None:
        _embeddings_fn = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _embeddings_fn


def _use_simple_store() -> bool:
    """軽量ストアを使うかどうか。"""
    if APP_ENV == "lambda":
        return True
    from src.config import DATA_DIR
    return (DATA_DIR / "embeddings.json").exists()


def _get_vectordb():
    """ChromaDB インスタンスを返す（ローカル用）。"""
    global _vectordb
    if _vectordb is None:
        from langchain_community.vectorstores import Chroma
        from src.config import CHROMA_DIR, CHROMA_COLLECTION
        _vectordb = Chroma(
            persist_directory=str(CHROMA_DIR),
            embedding_function=_get_embeddings(),
            collection_name=CHROMA_COLLECTION,
        )
    return _vectordb


def get_all_docs() -> dict:
    """全ドキュメントを返す（quiz/practice エンジンが使用）。"""
    if _use_simple_store():
        from src.vector_store import get_store
        return get_store().get()
    else:
        return _get_vectordb().get()


def _extract_raw_content(doc_or_meta) -> str:
    """raw_content があればそれを返す。"""
    if isinstance(doc_or_meta, dict):
        meta = doc_or_meta.get("metadata", doc_or_meta)
        raw = meta.get("raw_content", "")
        if raw:
            return raw
        text = doc_or_meta.get("page_content", "")
    else:
        raw = doc_or_meta.metadata.get("raw_content", "")
        if raw:
            return raw
        text = doc_or_meta.page_content

    text = re.sub(r"\s*キーワード:.*$", "", text)
    return text


def search(query: str, k: int = SEARCH_RETURN_K) -> list[dict]:
    """ベクトル検索で関連チャンクを返す（スコア閾値付き）。"""
    if _use_simple_store():
        return _search_simple(query, k)
    else:
        return _search_chroma(query, k)


def _search_chroma(query: str, k: int) -> list[dict]:
    """ChromaDB で検索（ローカル開発用）。"""
    db = _get_vectordb()
    results = db.similarity_search_with_score(query, k=SEARCH_TOP_K)

    filtered = []
    for doc, score in results:
        if score > SCORE_THRESHOLD:
            continue
        raw_content = _extract_raw_content(doc)
        filtered.append({
            "chunk_id": doc.metadata.get("chunk_id", ""),
            "section": doc.metadata.get("section", ""),
            "content": raw_content,
            "score": float(score),
        })

    return filtered[:k]


def _search_simple(query: str, k: int) -> list[dict]:
    """軽量ストアで検索（Lambda 用）。"""
    from src.vector_store import get_store

    emb = _get_embeddings()
    query_vector = emb.embed_query(query)

    store = get_store()
    results = store.similarity_search_with_score(query_vector, k=SEARCH_TOP_K)

    filtered = []
    for doc_info, score in results:
        if score > SCORE_THRESHOLD:
            continue
        meta = doc_info["metadata"]
        raw_content = meta.get("raw_content", "")
        if not raw_content:
            text = doc_info["page_content"]
            raw_content = re.sub(r"\s*キーワード:.*$", "", text)

        filtered.append({
            "chunk_id": meta.get("chunk_id", ""),
            "section": meta.get("section", ""),
            "content": raw_content,
            "score": float(score),
        })

    return filtered[:k]


def ask(question: str, history: list[dict] | None = None) -> dict:
    """質問に対してRAG回答を生成する。"""
    start = time.time()

    sources = search(question, k=SEARCH_RETURN_K)

    if not sources:
        elapsed = int((time.time() - start) * 1000)
        return {
            "answer": "マニュアルに該当する情報がありません。質問を変えてみてください。",
            "sources": [],
            "response_time_ms": elapsed,
        }

    context = "\n\n".join(
        f"【{s['section']}】\n{s['content']}" for s in sources
    )

    prompt_template = load_prompt("qa")
    prompt = prompt_template.format(context=context, question=question)
    llm = get_llm()
    response = llm.invoke(prompt)

    elapsed = int((time.time() - start) * 1000)

    return {
        "answer": response.content,
        "sources": [
            {"chunk_id": s["chunk_id"], "section": s["section"], "content": s["content"][:200]}
            for s in sources
        ],
        "response_time_ms": elapsed,
    }
