"""ファイル取り込みエンジン: PDF/MD/TXTからチャンクを作成し、embeddingsに追加する"""
import json
import os
import re
import uuid
import logging
from io import BytesIO
from pathlib import Path

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from src.config import EMBEDDING_MODEL, DATA_DIR

logger = logging.getLogger(__name__)

CHUNK_MIN = 200
CHUNK_MAX = 800
CHUNK_OVERLAP = 50


def extract_text(file_bytes: bytes, filename: str) -> str:
    """ファイルからテキストを抽出する。"""
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_bytes)
    elif ext in (".md", ".markdown"):
        return file_bytes.decode("utf-8", errors="replace")
    elif ext in (".txt", ".text", ".csv"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"未対応のファイル形式です: {ext}")


def _extract_pdf(file_bytes: bytes) -> str:
    """PDFからテキストを抽出する。"""
    from pypdf import PdfReader

    reader = PdfReader(BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def chunk_text(text: str, source: str = "") -> list[dict]:
    """テキストをチャンクに分割する。"""
    text = text.strip()
    if not text:
        return []

    paragraphs = re.split(r"\n{2,}", text)

    chunks = []
    current = ""
    section = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if re.match(r"^#{1,3}\s", para) or re.match(r"^[■□●◆▼▲【]", para):
            section = para.split("\n")[0].strip()
            section = re.sub(r"^#+\s*", "", section)
            section = section[:50]

        if len(current) + len(para) + 1 <= CHUNK_MAX:
            current = f"{current}\n{para}" if current else para
        else:
            if current:
                chunks.append(_make_chunk(current, source, section))

            if len(para) > CHUNK_MAX:
                sub_chunks = _split_long_text(para, source, section)
                chunks.extend(sub_chunks)
                current = ""
            else:
                overlap = current[-CHUNK_OVERLAP:] if current else ""
                current = f"{overlap}\n{para}" if overlap else para

    if current and len(current) >= CHUNK_MIN:
        chunks.append(_make_chunk(current, source, section))
    elif current and chunks:
        last = chunks[-1]
        last["document"] = f"{last['document']}\n{current}"
        last["metadata"]["raw_content"] = last["document"]

    return chunks


def _split_long_text(text: str, source: str, section: str) -> list[dict]:
    """長いテキストを文単位で分割する。"""
    sentences = re.split(r"(?<=[。．！？\n])", text)
    chunks = []
    current = ""

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(current) + len(sent) + 1 <= CHUNK_MAX:
            current = f"{current}{sent}" if current else sent
        else:
            if current:
                chunks.append(_make_chunk(current, source, section))
            current = sent

    if current:
        chunks.append(_make_chunk(current, source, section))

    return chunks


def _make_chunk(text: str, source: str, section: str) -> dict:
    """チャンク辞書を作成する。"""
    chunk_id = f"upload_{uuid.uuid4().hex[:8]}"
    return {
        "id": chunk_id,
        "document": text.strip(),
        "metadata": {
            "source": source,
            "category": "uploaded",
            "chunk_id": chunk_id,
            "raw_content": text.strip(),
            "area": "",
            "tags": "",
            "section": section,
        },
    }


def generate_embeddings(chunks: list[dict]) -> list[dict]:
    """チャンクにembeddingベクトルを追加する。"""
    if not chunks:
        return []

    emb_fn = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

    documents = [c["document"] for c in chunks]
    vectors = emb_fn.embed_documents(documents)

    for chunk, vec in zip(chunks, vectors):
        if hasattr(vec, "tolist"):
            vec = vec.tolist()
        chunk["embedding"] = vec

    return chunks


def save_to_embeddings(new_records: list[dict]) -> int:
    """新しいレコードをembeddings.jsonに追加する。"""
    json_path = DATA_DIR / "embeddings.json"

    existing = []
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    existing.extend(new_records)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    logger.info("embeddings.json updated: %d -> %d records", len(existing) - len(new_records), len(existing))
    return len(existing)


def reload_vector_store():
    """メモリ上のベクトルストアを再読み込みする。"""
    from src import vector_store
    vector_store._store = None
    vector_store.get_store()
    logger.info("Vector store reloaded")


def get_data_status() -> dict:
    """現在のデータ状態を返す。"""
    json_path = DATA_DIR / "embeddings.json"

    if not json_path.exists():
        return {"total_chunks": 0, "sources": []}

    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    source_counts: dict[str, int] = {}
    for r in records:
        src = r.get("metadata", {}).get("source", "unknown")
        source_counts[src] = source_counts.get(src, 0) + 1

    sources = [{"name": k, "chunks": v} for k, v in sorted(source_counts.items())]

    return {
        "total_chunks": len(records),
        "sources": sources,
    }


def delete_source(source_name: str) -> int:
    """指定ソースのチャンクを削除する。"""
    json_path = DATA_DIR / "embeddings.json"

    if not json_path.exists():
        return 0

    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    before = len(records)
    records = [r for r in records if r.get("metadata", {}).get("source", "") != source_name]
    after = len(records)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    removed = before - after
    if removed > 0:
        reload_vector_store()

    return removed


def ingest_file(file_bytes: bytes, filename: str) -> dict:
    """ファイルを取り込む完全なパイプライン。"""
    text = extract_text(file_bytes, filename)
    if not text.strip():
        raise ValueError("ファイルからテキストを抽出できませんでした")

    chunks = chunk_text(text, source=filename)
    if not chunks:
        raise ValueError("テキストのチャンク分割に失敗しました")

    chunks_with_emb = generate_embeddings(chunks)
    total = save_to_embeddings(chunks_with_emb)
    reload_vector_store()

    return {
        "filename": filename,
        "text_length": len(text),
        "chunks_created": len(chunks_with_emb),
        "total_chunks": total,
    }
