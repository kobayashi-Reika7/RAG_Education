"""
検索確認テスト
==============
ChromaDBに保存したベクトルデータの検索精度を確認する。

実行:
  cd RAG_education/backend
  python test_search.py
"""
from pathlib import Path

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

CHROMA_DIR = Path(__file__).resolve().parent / "chroma_db"
EMBEDDING_MODEL = "intfloat/multilingual-e5-base"

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
]


def main():
    print("Embeddingモデル読み込み中...")
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    vectordb = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
        collection_name="rag_education",
    )

    print(f"ChromaDB: {vectordb._collection.count()} documents\n")
    print("=" * 70)

    correct = 0
    total = len(TEST_QUERIES)

    for i, (query, expected_id) in enumerate(TEST_QUERIES, 1):
        results = vectordb.similarity_search_with_score(query, k=3)

        top_id = results[0][0].metadata.get("chunk_id", "") if results else ""
        top_section = results[0][0].metadata.get("section", "") if results else ""
        top_score = results[0][1] if results else 0

        hit = "HIT" if top_id == expected_id else "MISS"
        if top_id == expected_id:
            correct += 1

        print(f"\nQ{i}: {query}")
        print(f"  期待: {expected_id}")
        print(f"  Top1: {top_id} ({top_section}) [距離: {top_score:.4f}] [{hit}]")

        for rank, (doc, score) in enumerate(results[1:], 2):
            cid = doc.metadata.get("chunk_id", "")
            sec = doc.metadata.get("section", "")
            mark = " <-" if cid == expected_id else ""
            print(f"  Top{rank}: {cid} ({sec}) [距離: {score:.4f}]{mark}")

    print("\n" + "=" * 70)
    print(f"検索精度: {correct}/{total} ({correct/total*100:.0f}%)")

    if correct == total:
        print("全問正解! 検索品質は良好です。")
    elif correct >= total * 0.7:
        print("概ね良好。一部のチャンクのタグやテキストを改善すると精度が上がります。")
    else:
        print("要改善。チャンク分割やテキスト整形を見直してください。")


if __name__ == "__main__":
    main()
