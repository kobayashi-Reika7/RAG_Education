"""S3 データソース管理: Bedrock Knowledge Bases 用 S3 バケットへのファイル操作"""
import logging
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from src.config import S3_DATA_BUCKET, S3_REGION

logger = logging.getLogger(__name__)


def _get_client():
    """S3 クライアントを取得する。"""
    if not S3_DATA_BUCKET:
        raise ValueError("S3_DATA_BUCKET が設定されていません。.env を確認してください。")
    return boto3.client("s3", region_name=S3_REGION)


def upload_file(file_bytes: bytes, filename: str, content_type: str = "") -> dict:
    """ファイルを S3 データソースバケットにアップロードする。"""
    s3 = _get_client()

    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type

    s3.put_object(
        Bucket=S3_DATA_BUCKET,
        Key=filename,
        Body=file_bytes,
        **extra_args,
    )

    logger.info("Uploaded to s3://%s/%s (%d bytes)", S3_DATA_BUCKET, filename, len(file_bytes))

    return {
        "filename": filename,
        "bucket": S3_DATA_BUCKET,
        "size": len(file_bytes),
        "uri": f"s3://{S3_DATA_BUCKET}/{filename}",
    }


def upload_metadata(filename: str, metadata: dict) -> dict:
    """メタデータ JSON ファイルを S3 にアップロードする。
    Bedrock KB の規約: {filename}.metadata.json
    """
    import json

    s3 = _get_client()
    meta_key = f"{filename}.metadata.json"
    body = json.dumps(metadata, ensure_ascii=False, indent=2).encode("utf-8")

    s3.put_object(
        Bucket=S3_DATA_BUCKET,
        Key=meta_key,
        Body=body,
        ContentType="application/json",
    )

    logger.info("Uploaded metadata to s3://%s/%s", S3_DATA_BUCKET, meta_key)
    return {"key": meta_key, "uri": f"s3://{S3_DATA_BUCKET}/{meta_key}"}


def list_files() -> list[dict]:
    """S3 バケット内のファイル一覧を取得する（.metadata.json は除外）。"""
    s3 = _get_client()

    try:
        response = s3.list_objects_v2(Bucket=S3_DATA_BUCKET)
    except ClientError as e:
        logger.error("S3 list_objects_v2 failed: %s", e)
        raise

    if "Contents" not in response:
        return []

    files = []
    for obj in response["Contents"]:
        key = obj["Key"]
        if key.endswith(".metadata.json"):
            continue
        files.append({
            "key": key,
            "size": obj["Size"],
            "last_modified": obj["LastModified"].isoformat(),
            "uri": f"s3://{S3_DATA_BUCKET}/{key}",
        })

    return files


def delete_file(key: str) -> dict:
    """S3 バケットからファイルとメタデータを削除する。"""
    s3 = _get_client()

    keys_to_delete = [key]
    meta_key = f"{key}.metadata.json"

    try:
        s3.head_object(Bucket=S3_DATA_BUCKET, Key=meta_key)
        keys_to_delete.append(meta_key)
    except ClientError:
        pass

    for k in keys_to_delete:
        s3.delete_object(Bucket=S3_DATA_BUCKET, Key=k)
        logger.info("Deleted s3://%s/%s", S3_DATA_BUCKET, k)

    return {"deleted": keys_to_delete, "bucket": S3_DATA_BUCKET}


def get_status() -> dict:
    """S3 バケットの状態を返す。"""
    files = list_files()
    total_size = sum(f["size"] for f in files)
    return {
        "bucket": S3_DATA_BUCKET,
        "region": S3_REGION,
        "file_count": len(files),
        "total_size": total_size,
        "files": files,
    }
