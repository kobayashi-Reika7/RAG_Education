"""リクエスト / レスポンスモデル"""
from pydantic import BaseModel, field_validator


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
    exclude_chunk_ids: list[str] | None = None
    past_questions: list[str] | None = None

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, v):
        if v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("difficulty は beginner/intermediate/advanced のいずれか")
        return v


class QuizBatchRequest(BaseModel):
    difficulty: str = "beginner"
    count: int = 5
    past_questions: list[str] | None = None

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, v):
        if v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("difficulty は beginner/intermediate/advanced のいずれか")
        return v

    @field_validator("count")
    @classmethod
    def valid_count(cls, v):
        if v < 1 or v > 10:
            raise ValueError("count は 1〜10")
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


class PracticeGenerateRequest(BaseModel):
    count: int = 1
    difficulty: str = "beginner"
    past_questions: list[str] | None = None

    @field_validator("count")
    @classmethod
    def valid_count(cls, v):
        if v < 1 or v > 10:
            raise ValueError("count は 1〜10")
        return v

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, v):
        if v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("difficulty は beginner/intermediate/advanced のいずれか")
        return v


class PracticeAnswerRequest(BaseModel):
    practice_id: str
    question: str = ""
    selected: str
    correct: str
    difficulty: str = "beginner"
    choices: dict[str, str] | None = None
    explanation: str | None = None

    @field_validator("selected")
    @classmethod
    def valid_selected(cls, v):
        if v not in ("A", "B", "C", "D"):
            raise ValueError("selected は A/B/C/D のいずれか")
        return v


class QuizSaveResultRequest(BaseModel):
    quiz_id: str
    question: str
    expected_answer: str
    user_answer: str
    is_correct: bool
    difficulty: str = "beginner"


class ChunksPreviewRequest(BaseModel):
    queries: list[str] | None = None
    k: int = 10
    max_items: int = 200

    @field_validator("k")
    @classmethod
    def valid_k(cls, v):
        if v < 1 or v > 50:
            raise ValueError("k は 1〜50")
        return v

    @field_validator("max_items")
    @classmethod
    def valid_max_items(cls, v):
        if v < 1 or v > 2000:
            raise ValueError("max_items は 1〜2000")
        return v


class ChunksExportRequest(ChunksPreviewRequest):
    filename: str | None = None
