"""LLMクライアント（Gemini）- シングルトン + 高速設定"""
import os
from langchain_google_genai import ChatGoogleGenerativeAI

_llm_fast = None
_llm_default = None


def get_llm(max_tokens: int = 256):
    """高速LLMインスタンスを返す（シングルトン、出力トークン制限）。"""
    global _llm_fast
    if _llm_fast is None:
        _llm_fast = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.4,
            max_output_tokens=max_tokens,
        )
    return _llm_fast


def get_llm_long(max_tokens: int = 1024):
    """長い出力用LLMインスタンス（バッチ生成用）。"""
    global _llm_default
    if _llm_default is None:
        _llm_default = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.5,
            max_output_tokens=max_tokens,
        )
    return _llm_default
