"""LLMクライアント（Bedrock Converse API）- モデル非依存の統一インターフェース"""
import logging

import boto3

from src.config import S3_REGION

logger = logging.getLogger(__name__)

LLM_MODEL_ID = "us.amazon.nova-lite-v1:0"

_bedrock_client = None


def _get_bedrock_client():
    """Bedrock Runtime クライアントを取得する。"""
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client("bedrock-runtime", region_name=S3_REGION)
    return _bedrock_client


class _ConverseResponse:
    """llm.invoke() の戻り値互換オブジェクト（.content でテキスト取得）"""
    def __init__(self, content: str):
        self.content = content


def _invoke_converse(prompt: str, max_tokens: int, temperature: float) -> _ConverseResponse:
    """Bedrock Converse API で LLM を呼び出す（モデル非依存）。"""
    client = _get_bedrock_client()

    response = client.converse(
        modelId=LLM_MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    )

    output = response.get("output", {})
    message = output.get("message", {})
    content_blocks = message.get("content", [])

    text = ""
    for block in content_blocks:
        if "text" in block:
            text += block["text"]

    return _ConverseResponse(content=text)


class _BedrockLLM:
    """quiz_engine / practice_engine の llm.invoke(prompt) 互換ラッパー"""
    def __init__(self, max_tokens: int = 256, temperature: float = 0.4):
        self._max_tokens = max_tokens
        self._temperature = temperature

    def invoke(self, prompt: str) -> _ConverseResponse:
        return _invoke_converse(prompt, self._max_tokens, self._temperature)


_llm_fast = None
_llm_long = None


def get_llm(max_tokens: int = 256):
    """高速LLMインスタンスを返す（出力トークン制限）。"""
    global _llm_fast
    if _llm_fast is None:
        _llm_fast = _BedrockLLM(max_tokens=max_tokens, temperature=0.4)
    return _llm_fast


def get_llm_long(max_tokens: int = 1024):
    """長い出力用LLMインスタンス（バッチ生成用）。"""
    global _llm_long
    if _llm_long is None:
        _llm_long = _BedrockLLM(max_tokens=max_tokens, temperature=0.5)
    return _llm_long
