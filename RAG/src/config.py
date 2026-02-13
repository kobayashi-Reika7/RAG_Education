"""
OnsenRAG 設定・定数
====================
パス、モデル名、検索パラメータなどの共通設定を一元管理する。
"""

import os

from dotenv import load_dotenv

# HuggingFaceモデルのリモート確認をスキップ（キャッシュ済みなら高速起動）
# ※ 他モジュールの import より前に実行されるよう config.py に配置
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

load_dotenv()

# ============================================================
# パス定数
# ============================================================
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

DEFAULT_DATA_PATH = os.path.join(DATA_DIR, "onsen_knowledge.txt")
DEFAULT_QUESTIONS_PATH = os.path.join(DATA_DIR, "sample_questions.json")
DEFAULT_KUSATSU_CHUNKS_PATH = os.path.join(DATA_DIR, "kusatsu_chunks.json")

# 場所別統合チャンクファイル + 温泉基礎知識
DEFAULT_JSON_CHUNK_PATHS = [
    os.path.join(DATA_DIR, "kusatsu_chunks.json"),
    os.path.join(DATA_DIR, "hakone_chunks.json"),
    os.path.join(DATA_DIR, "beppu_chunks.json"),
    os.path.join(DATA_DIR, "arima_chunks.json"),
    os.path.join(DATA_DIR, "onsen_knowledge_chunks.json"),
]

# テキストファイルは全て JSON チャンクに変換済みのため空
DEFAULT_TXT_PATHS: list[str] = []

# ChromaDB永続化先
CHROMA_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "chroma_onsen_db"
)
CHROMA_HASH_FILE = os.path.join(CHROMA_PERSIST_DIR, "_data_hash.txt")

# ============================================================
# 温泉地名 → chunk_id プレフィックス対応表
# ============================================================
LOCATION_KEYWORDS: dict[str, list[str]] = {
    "kusatsu": ["草津"],
    "hakone": ["箱根"],
    "beppu": ["別府"],
    "arima": ["有馬"],
}

# ============================================================
# モデル設定
# ============================================================
DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
DEFAULT_CROSS_ENCODER_MODEL = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

# ============================================================
# 検索パラメータ
# ============================================================
CONFIDENCE_THRESHOLD = -3.0  # CrossEncoderスコアの信頼度閾値

# クエリキャッシュ設定
QUERY_CACHE_MAXSIZE = 128
QUERY_CACHE_TTL = 300  # 5分
