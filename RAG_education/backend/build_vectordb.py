"""
ベクトルDB構築スクリプト
========================
チャンクJSONを読み込み、Embedding生成 → ChromaDB に保存する。

実行:
  cd RAG_education/backend
  python build_vectordb.py

依存:
  pip install chromadb sentence-transformers langchain langchain-community
"""
import json
import os
import shutil
from pathlib import Path

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

# パス設定
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / "chroma_db"

# Embeddingモデル（多言語対応・日本語に強い）
EMBEDDING_MODEL = "intfloat/multilingual-e5-base"


def load_chunks(data_dir: Path = DATA_DIR) -> list[dict]:
    """data/ 内の全 *_chunks.json を読み込む。"""
    all_chunks = []
    for json_file in sorted(data_dir.glob("*_chunks.json")):
        with open(json_file, "r", encoding="utf-8") as f:
            chunks = json.load(f)
        print(f"  {json_file.name}: {len(chunks)} chunks")
        all_chunks.extend(chunks)
    return all_chunks


def chunks_to_documents(chunks: list[dict]) -> list[Document]:
    """チャンクJSONをLangChain Documentに変換する。"""
    docs = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        doc = Document(
            page_content=chunk["content"],
            metadata={
                "chunk_id": chunk["chunk_id"],
                "section": chunk.get("section", ""),
                "source": meta.get("source", ""),
                "category": meta.get("category", ""),
                "area": meta.get("area", ""),
                "tags": ", ".join(meta.get("tags", [])),
            },
        )
        docs.append(doc)
    return docs


def build_vectordb(docs: list[Document], persist_dir: Path = CHROMA_DIR) -> Chroma:
    """Embedding生成 + ChromaDB保存。"""
    if persist_dir.exists():
        shutil.rmtree(persist_dir)
        print(f"  既存DB削除: {persist_dir}")

    print(f"  Embeddingモデル: {EMBEDDING_MODEL}")
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    print(f"  {len(docs)} documents をベクトル化中...")
    vectordb = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=str(persist_dir),
        collection_name="rag_education",
    )

    print(f"  ChromaDB保存完了: {persist_dir}")
    return vectordb


def main():
    print("[1/3] チャンクJSON読み込み...")
    chunks = load_chunks()
    if not chunks:
        print("  チャンクが見つかりません。data/ に *_chunks.json を配置してください。")
        return

    print(f"\n[2/3] Document変換 ({len(chunks)} chunks)...")
    docs = chunks_to_documents(chunks)

    print(f"\n[3/3] ベクトルDB構築...")
    vectordb = build_vectordb(docs)

    count = vectordb._collection.count()
    print(f"\n完了! ChromaDB に {count} ドキュメントを登録しました。")


if __name__ == "__main__":
    main()
