"""RAG教育クイズアプリ - FastAPI バックエンド"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from src.config import CORS_ORIGINS, PORT
from src import rag_engine, quiz_engine

app = FastAPI(title="RAG Education API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- リクエスト/レスポンスモデル ---

class AskRequest(BaseModel):
    question: str
    history: list[dict] | None = None

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v):
        if not v.strip():
            raise ValueError("質問が空です")
        return v.strip()


class QuizGenerateRequest(BaseModel):
    difficulty: str = "beginner"

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, v):
        if v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("difficulty は beginner/intermediate/advanced のいずれか")
        return v


class QuizEvaluateRequest(BaseModel):
    quiz_id: str
    question: str
    expected_answer: str
    user_answer: str
    difficulty: str = "beginner"
    source_chunk_ids: list[str] | None = None

    @field_validator("user_answer")
    @classmethod
    def answer_not_empty(cls, v):
        if not v.strip():
            raise ValueError("回答が空です")
        return v.strip()


# --- エンドポイント ---

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "chromadb_ready": True,
        "chunks_loaded": 14,
    }


@app.post("/api/ask")
def ask(req: AskRequest):
    try:
        result = rag_engine.ask(req.question, req.history)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/generate")
def quiz_generate(req: QuizGenerateRequest):
    try:
        result = quiz_engine.generate(req.difficulty)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


@app.post("/api/quiz/evaluate")
def quiz_evaluate(req: QuizEvaluateRequest):
    try:
        result = quiz_engine.evaluate(
            quiz_id=req.quiz_id,
            question=req.question,
            expected_answer=req.expected_answer,
            user_answer=req.user_answer,
            difficulty=req.difficulty,
            source_chunk_ids=req.source_chunk_ids,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "LLM_ERROR"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
