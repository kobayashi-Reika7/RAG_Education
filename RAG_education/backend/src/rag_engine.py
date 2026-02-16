"""RAG検索 + 回答生成エンジン"""
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

from src.config import CHROMA_DIR, EMBEDDING_MODEL, CHROMA_COLLECTION
from src.llm_client import get_llm

_vectordb = None

QA_PROMPT = """あなたは教育マニュアルに基づいて回答するアシスタントです。
以下の参考資料のみを根拠に、質問に日本語で回答してください。
参考資料に情報がない場合は「マニュアルに該当する情報がありません」と回答してください。

## 参考資料
{context}

## 質問
{question}

## 回答"""


def _get_vectordb() -> Chroma:
    global _vectordb
    if _vectordb is None:
        embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        _vectordb = Chroma(
            persist_directory=str(CHROMA_DIR),
            embedding_function=embeddings,
            collection_name=CHROMA_COLLECTION,
        )
    return _vectordb


def search(query: str, k: int = 3) -> list[dict]:
    """ベクトル検索で関連チャンクを返す。"""
    db = _get_vectordb()
    results = db.similarity_search_with_score(query, k=k)
    return [
        {
            "chunk_id": doc.metadata.get("chunk_id", ""),
            "section": doc.metadata.get("section", ""),
            "content": doc.page_content,
            "score": float(score),
        }
        for doc, score in results
    ]


def ask(question: str, history: list[dict] | None = None) -> dict:
    """質問に対してRAG回答を生成する。"""
    import time
    start = time.time()

    sources = search(question, k=3)
    context = "\n\n".join(
        f"【{s['section']}】\n{s['content']}" for s in sources
    )

    prompt = QA_PROMPT.format(context=context, question=question)
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
