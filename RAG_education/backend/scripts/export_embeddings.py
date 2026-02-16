"""
ChromaDB から埋め込みベクトルを JSON にエクスポート
====================================================
Lambda ではChromaDB を使わず、この JSON を読み込んで
純粋な Python でコサイン類似度検索を行う。

実行:
  cd RAG_education/backend
  python -m scripts.export_embeddings
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os

from src.config import CHROMA_DIR, EMBEDDING_MODEL, CHROMA_COLLECTION, DATA_DIR


def main():
    print("[1/2] ChromaDB を読み込み中...")
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )
    db = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
        collection_name=CHROMA_COLLECTION,
    )

    collection = db._collection
    result = collection.get(include=["embeddings", "documents", "metadatas"])

    records = []
    for i, doc_id in enumerate(result["ids"]):
        emb = result["embeddings"][i]
        # numpy array → list に変換
        if hasattr(emb, "tolist"):
            emb = emb.tolist()
        records.append({
            "id": doc_id,
            "document": result["documents"][i],
            "metadata": result["metadatas"][i],
            "embedding": emb,
        })

    print(f"  {len(records)} ドキュメントをエクスポート")

    out_path = DATA_DIR / "embeddings.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    size_kb = out_path.stat().st_size / 1024
    print(f"\n[2/2] 保存完了: {out_path} ({size_kb:.0f} KB)")
    print(f"  ベクトル次元: {len(records[0]['embedding'])}")


if __name__ == "__main__":
    main()
