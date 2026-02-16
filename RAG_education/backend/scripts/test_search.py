"""
検索精度テスト（Gemini Embedding版）
=====================================
Gemini text-embedding-004 でビルドしたベクトルDBの検索精度を検証する。

実行:
  cd RAG_education/backend
  python -m scripts.test_search
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

from src.config import CHROMA_DIR, EMBEDDING_MODEL, CHROMA_COLLECTION

TEST_QUERIES = [
    ("RAGとは何ですか？", "manual_003"),
    ("LLMの限界は？", "manual_003"),
    ("Embeddingの目的は？", "manual_008"),
    ("ベクトルDBを使う理由は？", "manual_009"),
    ("ハルシネーションとは？", "manual_013"),
    ("フロントエンドの役割は？", "manual_005"),
    ("検索精度が悪いとどうなる？", "manual_010"),
    ("OCRの精度が低いと何が問題？", "manual_011"),
    ("プロンプト設計で重要なことは？", "manual_012"),
    ("このアプリの構成要素は？", "manual_007"),
    ("RAGの2段階構造を説明して", "manual_004"),
    ("AIと従来プログラムの違いは？", "manual_002"),
    ("バックエンドは何をする？", "manual_006"),
    ("RAGで正確性が向上する理由は？", "manual_003"),
]


def main():
    print(f"Embeddingモデル: {EMBEDDING_MODEL}")
    embeddings = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

    vectordb = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
        collection_name=CHROMA_COLLECTION,
    )

    count = vectordb._collection.count()
    print(f"ChromaDB: {count} documents")
    print()
    print("=" * 70)

    correct = 0
    total = len(TEST_QUERIES)
    total_score = 0.0

    for i, (query, expected_id) in enumerate(TEST_QUERIES, 1):
        results = vectordb.similarity_search_with_score(query, k=3)

        top_id = results[0][0].metadata.get("chunk_id", "") if results else ""
        top_section = results[0][0].metadata.get("section", "") if results else ""
        top_score = results[0][1] if results else 0

        hit = "HIT" if top_id == expected_id else "MISS"
        if top_id == expected_id:
            correct += 1

        total_score += top_score

        print(f"\nQ{i}: {query}")
        print(f"  期待: {expected_id}")
        print(f"  Top1: {top_id} ({top_section}) [距離: {top_score:.4f}] [{hit}]")

        for rank, (doc, score) in enumerate(results[1:], 2):
            cid = doc.metadata.get("chunk_id", "")
            sec = doc.metadata.get("section", "")
            mark = " <-" if cid == expected_id else ""
            print(f"  Top{rank}: {cid} ({sec}) [距離: {score:.4f}]{mark}")

    avg_score = total_score / total if total > 0 else 0

    print("\n" + "=" * 70)
    print(f"検索精度: {correct}/{total} ({correct/total*100:.0f}%)")
    print(f"平均距離: {avg_score:.4f} (低いほど良い)")

    if correct == total:
        print("全問正解! 検索品質は最高です。")
    elif correct >= total * 0.9:
        print("非常に良好。ほぼ全問正解です。")
    elif correct >= total * 0.7:
        print("概ね良好。一部改善の余地があります。")
    else:
        print("要改善。チャンク分割やテキスト整形を見直してください。")


if __name__ == "__main__":
    main()
