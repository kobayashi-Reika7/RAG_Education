"""
PDF OCR Pipeline（汎用版）
=========================
GCSバケット上のPDFをVision APIでOCRし、RAGチャンクJSONに変換する。
温泉PDF以外（教育マニュアル等）にも対応した汎用スクリプト。

使い方:
  # 1. 環境変数を設定
  $env:GOOGLE_APPLICATION_CREDENTIALS = "path/to/serviceAccountKey.json"

  # 2. GCSバケットにPDFをアップロード済みであること

  # 3. 実行（バケット内の全PDFを処理）
  python scripts/pdf_ocr_pipeline.py

  # 4. 特定PDFのみ
  python scripts/pdf_ocr_pipeline.py "教育マニュアル.pdf"

  # 5. 出力先を指定
  python scripts/pdf_ocr_pipeline.py --output-dir ../RAG_Education/backend/data

前提:
  - GOOGLE_APPLICATION_CREDENTIALS が設定済み
  - Cloud Vision API が有効化済み
  - GCSバケットにPDFがアップロード済み
"""
import sys
import os
import json
import re
import unicodedata
import argparse
from pathlib import Path
from collections import defaultdict

from google.cloud import vision, storage
from langchain_core.documents import Document

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.text_splitter_utils import create_token_text_splitter


BUCKET_NAME = "myocr_1"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"


def list_pdfs_in_bucket(bucket_name: str | None = None) -> list[str]:
    """GCSバケット内のPDFファイル一覧を取得する。"""
    client = storage.Client()
    bucket = client.bucket(bucket_name or BUCKET_NAME)
    pdfs = []
    for blob in bucket.list_blobs():
        if blob.name.lower().endswith(".pdf") and "/" not in blob.name:
            pdfs.append(blob.name)
    return sorted(pdfs)


def run_ocr(pdf_name: str, bucket_name: str | None = None) -> None:
    """1つのPDFに対してVision API OCRを実行する。"""
    client = vision.ImageAnnotatorClient()
    bkt = bucket_name or BUCKET_NAME

    stem = pdf_name.replace(".pdf", "")
    gcs_source = f"gs://{bkt}/{pdf_name}"
    gcs_dest = f"gs://{bkt}/output/{stem}/"

    feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
    input_config = vision.InputConfig(
        gcs_source=vision.GcsSource(uri=gcs_source),
        mime_type="application/pdf",
    )
    output_config = vision.OutputConfig(
        gcs_destination=vision.GcsDestination(uri=gcs_dest),
        batch_size=1,
    )
    request = vision.AsyncAnnotateFileRequest(
        features=[feature],
        input_config=input_config,
        output_config=output_config,
    )

    safe = pdf_name.encode("ascii", errors="replace").decode()
    print(f"  OCR: {safe} -> output/{stem}/ ...", end=" ", flush=True)
    operation = client.async_batch_annotate_files(requests=[request])
    operation.result(timeout=300)
    print("OK")


def fetch_ocr_results(
    bucket_name: str | None = None,
    prefix: str = "output/",
) -> dict[str, list[dict]]:
    """GCSからOCR結果JSONを取得し、ソースPDFごとにグループ化する。"""
    client = storage.Client()
    bucket = client.bucket(bucket_name or BUCKET_NAME)
    grouped: dict[str, list[dict]] = defaultdict(list)

    for blob in bucket.list_blobs(prefix=prefix):
        if not blob.name.endswith(".json"):
            continue
        content = blob.download_as_string().decode("utf-8")
        data = json.loads(content)
        uri = (data.get("inputConfig", {})
                   .get("gcsSource", {})
                   .get("uri", ""))
        pdf_name = uri.split("/")[-1] if uri else "unknown"
        grouped[pdf_name].append(data)

    return dict(grouped)


def extract_full_text(jsons: list[dict]) -> str:
    """各JSONからfullTextAnnotation.textを取得して結合する。"""
    texts = []
    for data in jsons:
        for resp in data.get("responses", []):
            ft = resp.get("fullTextAnnotation")
            if ft and ft.get("text"):
                texts.append(ft["text"])
    return "\n\n".join(texts)


def normalize_text(text: str) -> str:
    """NFKC正規化 + 連続空白・改行を整理。"""
    if not text:
        return ""
    s = unicodedata.normalize("NFKC", text)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def make_id_prefix(pdf_name: str) -> str:
    """PDF名からチャンクIDプレフィックスを生成する。"""
    stem = pdf_name.replace(".pdf", "")
    safe = re.sub(r"[^\w]", "_", stem).strip("_").lower()
    if not safe:
        safe = "doc"
    return safe


def text_to_chunks(
    text: str,
    pdf_name: str,
    id_prefix: str | None = None,
    document_type: str = "general",
) -> list[dict]:
    """テキストをチャンク分割してRAG互換JSONリストに変換する。"""
    if id_prefix is None:
        id_prefix = make_id_prefix(pdf_name)

    splitter = create_token_text_splitter(document_type=document_type)
    doc = Document(page_content=text)
    chunks = splitter.split_documents([doc])

    out = []
    for i, chunk in enumerate(chunks, 1):
        out.append({
            "chunk_id": f"{id_prefix}_{i:03d}",
            "section": "",
            "metadata": {
                "source": pdf_name,
                "category": "OCR",
                "area": "",
                "tags": [],
            },
            "content": chunk.page_content,
        })
    return out


def save_chunks(chunks: list[dict], output_path: Path) -> None:
    """チャンクJSONをファイルに保存する。"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)


def process_pipeline(
    pdfs: list[str] | None = None,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    skip_ocr: bool = False,
) -> list[str]:
    """
    OCRパイプライン全体を実行する。

    Args:
        pdfs: OCR対象のPDF名リスト。Noneの場合はバケット内の全PDF。
        output_dir: チャンクJSON出力先ディレクトリ。
        skip_ocr: Trueの場合、OCR実行をスキップし変換のみ行う。

    Returns:
        保存されたファイルパスのリスト。
    """
    if pdfs is None:
        print(f"[1/4] Listing PDFs in gs://{BUCKET_NAME}/ ...")
        pdfs = list_pdfs_in_bucket()
        if not pdfs:
            print("  No PDFs found in bucket.")
            return []
        for p in pdfs:
            safe = p.encode("ascii", errors="replace").decode()
            print(f"  - {safe}")
    else:
        print(f"[1/4] Target PDFs: {len(pdfs)} file(s)")

    if not skip_ocr:
        print(f"\n[2/4] Running Vision API OCR ({len(pdfs)} PDFs) ...")
        for pdf in pdfs:
            run_ocr(pdf)
    else:
        print("\n[2/4] Skipping OCR (--skip-ocr)")

    print("\n[3/4] Fetching OCR results from GCS ...")
    grouped = fetch_ocr_results()
    if not grouped:
        print("  No OCR results found.")
        return []
    print(f"  Found {len(grouped)} source PDF(s)")

    print(f"\n[4/4] Converting to RAG chunks -> {output_dir}")
    saved_files = []
    for pdf_name in sorted(grouped.keys()):
        jsons = grouped[pdf_name]
        raw = extract_full_text(jsons)
        if not raw:
            safe = pdf_name.encode("ascii", errors="replace").decode()
            print(f"  [SKIP] No text: {safe}")
            continue

        text = normalize_text(raw)
        id_prefix = make_id_prefix(pdf_name)
        chunks = text_to_chunks(text, pdf_name, id_prefix)

        out_file = output_dir / f"{id_prefix}_chunks.json"
        save_chunks(chunks, out_file)

        safe_name = pdf_name.encode("ascii", errors="replace").decode()
        print(f"  {safe_name}: {len(raw)} chars -> {len(text)} normalized -> {len(chunks)} chunks -> {out_file.name}")
        saved_files.append(str(out_file))

    print(f"\nDone! Saved {len(saved_files)} file(s).")
    return saved_files


def main():
    global BUCKET_NAME

    parser = argparse.ArgumentParser(description="PDF OCR Pipeline (GCP Vision API)")
    parser.add_argument("pdfs", nargs="*", help="OCR対象のPDFファイル名（省略時はバケット内全PDF）")
    parser.add_argument("--output-dir", "-o", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help="チャンクJSON出力先ディレクトリ")
    parser.add_argument("--skip-ocr", action="store_true",
                        help="OCR実行をスキップし、既存結果の変換のみ行う")
    parser.add_argument("--bucket", default=BUCKET_NAME,
                        help=f"GCSバケット名（デフォルト: {BUCKET_NAME}）")
    args = parser.parse_args()

    BUCKET_NAME = args.bucket

    pdfs = args.pdfs if args.pdfs else None
    process_pipeline(pdfs=pdfs, output_dir=args.output_dir, skip_ocr=args.skip_ocr)


if __name__ == "__main__":
    main()
