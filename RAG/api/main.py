"""
温泉相談チャットAPI - FastAPIバックエンド
==========================================
温泉RAGシステムのWeb API。
React UIからのリクエストを受け付け、RAGで回答を生成して返す。

構成：
  [React UI] → [FastAPI] → [OnsenRAG] → [ChromaDB + LLM]

起動方法：
  uvicorn api.main:app --reload --port 8000

エンドポイント：
  POST /api/ask    - 質問を受け付けて回答を返す（ストリーミング対応）
  GET  /api/health - ヘルスチェック
"""

import os
import re
import sys
import time
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, field_validator

# プロジェクトルートをパスに追加（srcのインポートのため）
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.onsen_rag import OnsenRAG
from src.support_bot import SupportBot

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# リトライ・タイムアウト定数
MAX_RETRIES = 3
RETRY_DELAY_SEC = 1.0
LLM_TIMEOUT_SEC = 60

# 入力サニタイズ: 最大文字数
MAX_QUESTION_LENGTH = 500

# CORS許可オリジン（本番環境では環境変数で制御）
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:8000"
).split(",")
# file:// プロトコルのサポート（ローカル開発用）
if os.getenv("ALLOW_FILE_ORIGIN", "true").lower() == "true":
    ALLOWED_ORIGINS.append("null")  # file:// は Origin: null として送信される


# ============================
# Lifespan（起動・終了の管理）
# ============================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan コンテキストマネージャ

    起動時にRAGシステムを初期化し、終了時にリソースを解放する。
    ※ 旧 @app.on_event("startup") は FastAPI 0.95+ で非推奨
    """
    # --- Startup ---
    print("[START] RAG system initializing...")
    try:
        rag = OnsenRAG(chunk_size=600, chunk_overlap=75)
        rag.load_from_data_folder()
        bot = SupportBot(
            rag_query_fn=lambda q: rag.query(q, k=3),
            enable_escalation=True,
        )
        app.state.rag_system = rag
        app.state.support_bot = bot
        logger.info("RAG system initialized successfully")
    except Exception as error:
        logger.error("RAG initialization failed: %s", error)
        app.state.rag_system = None
        app.state.support_bot = None
        logger.warning("API will start but questions cannot be answered")

    yield  # アプリケーション実行中

    # --- Shutdown ---
    logger.info("RAG system shutting down...")
    app.state.rag_system = None
    app.state.support_bot = None


# FastAPIアプリケーションの作成
app = FastAPI(
    title="OnsenRAG API",
    description="温泉情報RAGシステムのWeb API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS設定（環境変数で制御可能）
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ============================
# リクエスト・レスポンスモデル
# ============================
class QuestionRequest(BaseModel):
    """
    質問リクエストのデータ構造

    Attributes:
        question: ユーザーが入力した質問文（最大500文字）
    """
    question: str

    @field_validator("question")
    @classmethod
    def sanitize_question(cls, v: str) -> str:
        """入力サニタイズ: 制御文字除去・長さ制限"""
        # 制御文字を除去（改行・タブ以外）
        v = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', v)
        v = v.strip()
        if not v:
            raise ValueError("質問が空です。質問を入力してください。")
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(
                f"質問は{MAX_QUESTION_LENGTH}文字以内にしてください。"
                f"（現在{len(v)}文字）"
            )
        return v


class AnswerResponse(BaseModel):
    """
    回答レスポンスのデータ構造

    Attributes:
        answer: RAGが生成した回答テキスト
        sources: 参照したチャンクの内容
        chunk_ids: 参照したチャンクIDリスト
        needs_escalation: 担当者へのおつなぎを提案するか
        response_time_ms: 応答時間（ミリ秒）
    """
    answer: str
    sources: list[str] = []
    chunk_ids: list[str] = []
    needs_escalation: bool = False
    response_time_ms: int = 0


# ============================
# ヘルパー関数
# ============================
def _get_rag() -> OnsenRAG:
    """RAGシステムを取得（未初期化時は503エラー）"""
    rag = getattr(app.state, "rag_system", None)
    if rag is None or rag.vectorstore is None:
        raise HTTPException(
            status_code=503,
            detail="RAGシステムが初期化されていません。しばらくしてから再度お試しください。"
        )
    return rag


def _get_bot() -> SupportBot | None:
    """サポートボットを取得"""
    return getattr(app.state, "support_bot", None)


# ============================
# エンドポイント
# ============================
@app.get("/api/health")
async def health_check():
    """ヘルスチェック"""
    rag = getattr(app.state, "rag_system", None)
    is_ready = rag is not None and rag.vectorstore is not None

    return {
        "status": "ok" if is_ready else "not_ready",
        "rag_initialized": is_ready,
        "sources": [
            "kusatsu_chunks.json",
            "hakone_chunks.json",
            "beppu_chunks.json",
            "arima_chunks.json",
            "onsen_knowledge_chunks.json",
        ] if is_ready else [],
    }


@app.post("/api/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """
    質問を受け付けてRAGで回答を生成

    処理の流れ：
    1. 入力サニタイズ（Pydantic validator で自動実行）
    2. SupportBot経由でRAGクエリ（リトライ付き）
    3. 応答時間を計測して返却
    """
    _get_rag()  # 初期化チェック
    bot = _get_bot()
    start_time = time.time()

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            if bot is not None:
                def _sync_support_ask():
                    return bot.ask(request.question, k=3)

                loop = asyncio.get_event_loop()
                resp = await asyncio.wait_for(
                    loop.run_in_executor(None, _sync_support_ask),
                    timeout=LLM_TIMEOUT_SEC,
                )
                elapsed_ms = int((time.time() - start_time) * 1000)
                return AnswerResponse(
                    answer=resp.answer,
                    sources=resp.sources,
                    chunk_ids=resp.chunk_ids,
                    needs_escalation=resp.needs_escalation,
                    response_time_ms=elapsed_ms,
                )

            # SupportBot未初期化時のフォールバック
            rag = _get_rag()

            def _sync_query():
                return rag.query(request.question, k=3)

            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, _sync_query),
                timeout=LLM_TIMEOUT_SEC,
            )
            sources = []
            chunk_ids = result.get("chunk_ids", [])
            if "source_documents" in result:
                sources = [doc.page_content[:200] for doc in result["source_documents"]]
            answer = result["result"]
            if hasattr(answer, "content"):
                answer = str(answer.content)

            elapsed_ms = int((time.time() - start_time) * 1000)
            return AnswerResponse(
                answer=answer.strip(),
                sources=sources,
                chunk_ids=chunk_ids,
                response_time_ms=elapsed_ms,
            )

        except asyncio.TimeoutError as error:
            last_error = error
            logger.warning("回答生成タイムアウト (試行 %d/%d)", attempt + 1, MAX_RETRIES)
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY_SEC)
        except Exception as error:
            last_error = error
            logger.warning("回答生成エラー (試行 %d/%d): %s", attempt + 1, MAX_RETRIES, error)
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY_SEC)

    # エラーメッセージから内部詳細を隠蔽
    if isinstance(last_error, asyncio.TimeoutError):
        detail = "回答の生成がタイムアウトしました。しばらくしてから再度お試しください。"
    else:
        detail = "回答の生成に失敗しました。しばらくしてから再度お試しください。"
        logger.error("回答生成の最終エラー: %s", last_error)

    raise HTTPException(status_code=500, detail=detail)


@app.get("/")
async def serve_frontend():
    """フロントエンドHTMLを配信"""
    frontend_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "frontend", "index.html"
    )
    if os.path.exists(frontend_path):
        return FileResponse(frontend_path, media_type="text/html")
    return {"message": "frontend/index.html が見つかりません"}


@app.post("/api/search")
async def search_chunks(request: QuestionRequest):
    """検索結果のみを返す（評価・デバッグ用）"""
    rag = _get_rag()
    docs = rag.search_chunks(request.question, k=3)

    return {
        "question": request.question,
        "chunks": [
            {
                "content": doc.page_content,
                "chunk_id": doc.metadata.get("chunk_id", ""),
                "length": len(doc.page_content),
            }
            for doc in docs
        ]
    }
