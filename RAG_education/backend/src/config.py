"""設定定数 + プロンプトローダー"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- パス ---
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROMPTS_DIR = BASE_DIR / "prompts"
SCRIPTS_DIR = BASE_DIR / "scripts"

_chroma_override = os.getenv("CHROMA_DIR_OVERRIDE")
CHROMA_DIR = Path(_chroma_override) if _chroma_override else BASE_DIR / "chroma_db"

# --- Embedding / VectorDB ---
EMBEDDING_MODEL = "models/gemini-embedding-001"
CHROMA_COLLECTION = "rag_education"

# --- 検索パラメータ ---
SCORE_THRESHOLD = 1.0
SEARCH_TOP_K = 5
SEARCH_RETURN_K = 3

# --- サーバー ---
PORT = int(os.getenv("PORT", "7000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# --- AWS Lambda ---
APP_ENV = os.getenv("APP_ENV", "local")
CHROMA_S3_BUCKET = os.getenv("CHROMA_S3_BUCKET", "")


# --- プロンプトローダー ---
_prompt_cache: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """prompts/{name}.txt を読み込んで返す。ローカル環境では毎回読み直す。"""
    if APP_ENV != "local" and name in _prompt_cache:
        return _prompt_cache[name]

    path = PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"プロンプトファイルが見つかりません: {path}")

    text = path.read_text(encoding="utf-8")
    _prompt_cache[name] = text
    return text
