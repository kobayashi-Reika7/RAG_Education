"""RAG教育クイズアプリ - FastAPI バックエンド（Bedrock KB 統合版）"""
import json
import logging
import re
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.config import CORS_ORIGINS, PORT, DATA_DIR
from src.models import (
    AskRequest,
    QuizGenerateRequest,
    QuizBatchRequest,
    QuizEvaluateRequest,
    QuizSaveResultRequest,
    PracticeGenerateRequest,
    PracticeAnswerRequest,
    ChunksPreviewRequest,
    ChunksExportRequest,
)
from src import quiz_engine, practice_engine, s3_storage, bedrock_kb
from src.auth import optional_uid
from src import history

logger = logging.getLogger(__name__)
CONSISTENCY_ERROR_TEXT = "整合性チェックに失敗しました"
GENERATION_RETRY_COUNT = 1

app = FastAPI(title="RAG Education API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


def _retry_generation(func):
    """整合性チェック失敗時のみ、問題生成を再試行する。"""
    last_error: ValueError | None = None
    for attempt in range(GENERATION_RETRY_COUNT + 1):
        try:
            return func()
        except ValueError as e:
            last_error = e
            message = str(e)
            should_retry = CONSISTENCY_ERROR_TEXT in message and attempt < GENERATION_RETRY_COUNT
            if not should_retry:
                raise
            logger.warning(
                "Generation consistency retry %d/%d: %s",
                attempt + 1,
                GENERATION_RETRY_COUNT + 1,
                message,
            )
    if last_error is not None:
        raise last_error
    raise ValueError("問題生成に失敗しました")


# --- エンドポイント ---

@app.get("/api/health")
def health():
    try:
        s3_info = s3_storage.get_status()
        file_count = s3_info.get("file_count", 0)
    except Exception:
        file_count = 0
    return {
        "status": "ok",
        "bedrock_kb_ready": bool(bedrock_kb.BEDROCK_KB_ID),
        "s3_files": file_count,
    }


@app.post("/api/ask/bedrock")
def ask_bedrock(req: AskRequest, uid: str | None = Depends(optional_uid)):
    """Bedrock Knowledge Bases を使って RAG 回答を生成する。"""
    try:
        return bedrock_kb.ask(req.question)
    except ValueError as e:
        logger.error("Bedrock KB config error: %s", e)
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "BEDROCK_CONFIG_ERROR"})
    except Exception as e:
        logger.error("Bedrock KB error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "BEDROCK_ERROR"})


@app.post("/api/quiz/generate")
def quiz_generate(req: QuizGenerateRequest, uid: str | None = Depends(optional_uid)):
    try:
        return _retry_generation(
            lambda: quiz_engine.generate(
                req.difficulty,
                exclude_chunk_ids=req.exclude_chunk_ids,
                past_questions=req.past_questions,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "BEDROCK_KB_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/generate-batch")
def quiz_generate_batch(req: QuizBatchRequest, uid: str | None = Depends(optional_uid)):
    """5問まとめて1回のLLM呼出しで生成する（高速）。"""
    try:
        return _retry_generation(
            lambda: quiz_engine.generate_batch(
                req.count, req.difficulty,
                past_questions=req.past_questions,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "BEDROCK_KB_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/evaluate")
def quiz_evaluate(req: QuizEvaluateRequest, uid: str | None = Depends(optional_uid)):
    try:
        result = quiz_engine.evaluate(
            quiz_id=req.quiz_id,
            question=req.question,
            expected_answer=req.expected_answer,
            user_answer=req.user_answer,
            difficulty=req.difficulty,
            source_chunk_ids=req.source_chunk_ids,
        )
        if uid:
            history.save_quiz_result(uid, req, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/practice/generate")
def practice_generate(req: PracticeGenerateRequest, uid: str | None = Depends(optional_uid)):
    try:
        if req.count == 1:
            return _retry_generation(
                lambda: practice_engine.generate_practice_single(
                    req.difficulty, past_questions=req.past_questions,
                )
            )
        return _retry_generation(
            lambda: practice_engine.generate_practice(
                req.count, req.difficulty, past_questions=req.past_questions,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "BEDROCK_KB_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/save-result")
def quiz_save_result(req: QuizSaveResultRequest, uid: str | None = Depends(optional_uid)):
    """○×クイズの結果を保存する（LLM判定不要）。"""
    if uid:
        history.save_quiz_result(uid, req, {
            "is_correct": req.is_correct,
            "score": 1.0 if req.is_correct else 0.0,
            "feedback": "正解！" if req.is_correct else "不正解",
        })
    return {"status": "ok"}


@app.post("/api/practice/answer")
def practice_answer(req: PracticeAnswerRequest, uid: str | None = Depends(optional_uid)):
    """演習の回答結果を記録する。"""
    if uid:
        history.save_practice_result(uid, {
            "practice_id": req.practice_id,
            "question": req.question,
            "selected": req.selected,
            "correct": req.correct,
            "is_correct": req.selected == req.correct,
            "difficulty": req.difficulty,
            "choices": req.choices or {},
            "explanation": req.explanation or "",
        })
    return {"status": "ok"}


ALLOWED_EXTENSIONS = {".pdf", ".md", ".markdown", ".txt", ".text", ".csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# --- S3 データソース (Bedrock Knowledge Bases) ---

@app.post("/api/s3/upload")
async def s3_upload_file(file: UploadFile = File(...), uid: str | None = Depends(optional_uid)):
    """ファイルを S3 データソースバケットにアップロードする。"""
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={"error": f"未対応のファイル形式: {ext}", "code": "INVALID_FILE"},
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={"error": "ファイルサイズが10MBを超えています", "code": "FILE_TOO_LARGE"},
        )

    try:
        result = s3_storage.upload_file(contents, file.filename or "unknown", file.content_type or "")
        try:
            sync_result = bedrock_kb.start_sync()
            result["sync"] = sync_result
        except Exception as sync_err:
            logger.warning("Bedrock KB sync failed after upload: %s", sync_err)
            result["sync"] = {"status": "error", "error": str(sync_err)}
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "S3_CONFIG_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "S3_ERROR"})


@app.get("/api/s3/status")
def s3_status(uid: str | None = Depends(optional_uid)):
    """S3 バケットの状態を返す。"""
    try:
        return s3_storage.get_status()
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "S3_CONFIG_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "S3_ERROR"})


@app.delete("/api/s3/file/{file_key:path}")
def s3_delete_file(file_key: str, uid: str | None = Depends(optional_uid)):
    """S3 バケットからファイルを削除する。"""
    try:
        result = s3_storage.delete_file(file_key)
        try:
            sync_result = bedrock_kb.start_sync()
            result["sync"] = sync_result
        except Exception as sync_err:
            logger.warning("Bedrock KB sync failed after delete: %s", sync_err)
            result["sync"] = {"status": "error", "error": str(sync_err)}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "S3_ERROR"})


@app.get("/api/me/stats")
def get_my_stats(uid: str | None = Depends(optional_uid)):
    """ログインユーザーの学習統計を返す。"""
    if not uid:
        raise HTTPException(status_code=401, detail="認証が必要です")
    try:
        return history.get_user_stats(uid)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "DYNAMODB_ERROR"})


@app.post("/api/chunks/preview")
def chunks_preview(req: ChunksPreviewRequest, uid: str | None = Depends(optional_uid)):
    """Bedrock KB から取得されるチャンクを確認用に返す。"""
    try:
        return bedrock_kb.preview_chunks(req.queries, k=req.k, max_items=req.max_items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "BEDROCK_KB_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "BEDROCK_ERROR"})


@app.post("/api/chunks/export")
def chunks_export(req: ChunksExportRequest, uid: str | None = Depends(optional_uid)):
    """取得チャンクを backend/data/*.json に保存する。"""
    try:
        preview = bedrock_kb.preview_chunks(req.queries, k=req.k, max_items=req.max_items)
        chunks = preview.get("chunks", [])
        if not chunks:
            raise ValueError("出力対象のチャンクがありません。")

        default_name = f"retrieved_chunks_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        raw_name = (req.filename or default_name).strip()
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_name)
        if not safe_name.lower().endswith(".json"):
            safe_name = f"{safe_name}.json"

        out_path = DATA_DIR / safe_name
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(preview, f, ensure_ascii=False, indent=2)

        return {
            "status": "ok",
            "count": len(chunks),
            "file_name": safe_name,
            "file_path": str(out_path),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "EXPORT_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "EXPORT_ERROR"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
