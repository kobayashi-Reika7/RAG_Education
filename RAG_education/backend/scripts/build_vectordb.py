"""
ベクトルDB構築スクリプト（Gemini Embedding版）
================================================
Gemini text-embedding-004 を使用してベクトルDBを構築する。

実行:
  cd RAG_education/backend
  python -m scripts.build_vectordb
"""
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

from src.config import DATA_DIR, CHROMA_DIR, EMBEDDING_MODEL, CHROMA_COLLECTION


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
    """チャンクJSONをLangChain Documentに変換する。
    section と tags をテキストに結合して検索品質を向上させる。
    """
    docs = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        section = chunk.get("section", "")
        tags = meta.get("tags", [])
        content = chunk["content"]

        enriched_text = f"{section}。{content}"
        if tags:
            enriched_text += f" キーワード: {', '.join(tags)}"

        doc = Document(
            page_content=enriched_text,
            metadata={
                "chunk_id": chunk["chunk_id"],
                "section": section,
                "source": meta.get("source", ""),
                "category": meta.get("category", ""),
                "area": meta.get("area", ""),
                "tags": ", ".join(tags),
                "raw_content": content,
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
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

    print(f"  {len(docs)} documents をベクトル化中...")
    vectordb = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=str(persist_dir),
        collection_name=CHROMA_COLLECTION,
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
    print(f"  メタデータ結合: section + tags をテキストに結合")
    docs = chunks_to_documents(chunks)

    print(f"\n  サンプル:")
    print(f"  {docs[0].page_content[:120]}...")

    print(f"\n[3/3] ベクトルDB構築...")
    vectordb = build_vectordb(docs)

    count = vectordb._collection.count()
    print(f"\n完了! ChromaDB に {count} ドキュメントを登録しました。")


if __name__ == "__main__":
    main()
