"""RAG教育クイズアプリ - FastAPI バックエンド"""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.config import CORS_ORIGINS, PORT
from src.models import (
    AskRequest,
    QuizGenerateRequest,
    QuizBatchRequest,
    QuizEvaluateRequest,
    QuizSaveResultRequest,
    PracticeGenerateRequest,
    PracticeAnswerRequest,
)
from src import rag_engine, quiz_engine, practice_engine, ingest
from src.auth import optional_uid
from src import history

app = FastAPI(title="RAG Education API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


# --- エンドポイント ---

@app.get("/api/health")
def health():
    status = ingest.get_data_status()
    return {
        "status": "ok",
        "chromadb_ready": True,
        "chunks_loaded": status["total_chunks"],
    }


@app.post("/api/ask")
def ask(req: AskRequest, uid: str | None = Depends(optional_uid)):
    try:
        return rag_engine.ask(req.question, req.history)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/generate")
def quiz_generate(req: QuizGenerateRequest, uid: str | None = Depends(optional_uid)):
    try:
        return quiz_engine.generate(req.difficulty, exclude_chunk_ids=req.exclude_chunk_ids)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/generate-batch")
def quiz_generate_batch(req: QuizBatchRequest, uid: str | None = Depends(optional_uid)):
    """5問まとめて1回のLLM呼出しで生成する（高速）。"""
    try:
        return quiz_engine.generate_batch(req.count, req.difficulty)
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
            return practice_engine.generate_practice_single(req.difficulty)
        return practice_engine.generate_practice(req.count, req.difficulty)
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
        })
    return {"status": "ok"}


ALLOWED_EXTENSIONS = {".pdf", ".md", ".markdown", ".txt", ".text", ".csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), uid: str | None = Depends(optional_uid)):
    """ファイルをアップロードしてデータに追加する。"""
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={"error": f"未対応のファイル形式: {ext}。PDF/MD/TXTに対応しています。", "code": "INVALID_FILE"},
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={"error": "ファイルサイズが10MBを超えています", "code": "FILE_TOO_LARGE"},
        )

    try:
        result = ingest.ingest_file(contents, file.filename or "unknown")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": str(e), "code": "INGEST_ERROR"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "INGEST_ERROR"})


@app.get("/api/data/status")
def data_status(uid: str | None = Depends(optional_uid)):
    """現在のデータ状態を返す。"""
    return ingest.get_data_status()


@app.delete("/api/data/source/{source_name}")
def delete_source(source_name: str, uid: str | None = Depends(optional_uid)):
    """指定ソースのデータを削除する。"""
    removed = ingest.delete_source(source_name)
    if removed == 0:
        raise HTTPException(status_code=404, detail={"error": "指定ソースが見つかりません", "code": "NOT_FOUND"})
    return {"removed_chunks": removed, "status": ingest.get_data_status()}


@app.get("/api/me/stats")
def get_my_stats(uid: str | None = Depends(optional_uid)):
    """ログインユーザーの学習統計を返す。"""
    if not uid:
        raise HTTPException(status_code=401, detail="認証が必要です")
    try:
        return history.get_user_stats(uid)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "FIRESTORE_ERROR"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
