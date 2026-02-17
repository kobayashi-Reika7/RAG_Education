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

# --- サーバー ---
PORT = int(os.getenv("PORT", "7000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
APP_ENV = os.getenv("APP_ENV", "local")

# --- S3 データソース (Bedrock Knowledge Bases) ---
S3_DATA_BUCKET = os.getenv("S3_DATA_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

# --- Bedrock Knowledge Bases ---
BEDROCK_KB_ID = os.getenv("BEDROCK_KB_ID", "")
BEDROCK_MODEL_ARN = os.getenv("BEDROCK_MODEL_ARN", "")


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
