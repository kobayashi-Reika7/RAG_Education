"""
LLM Factory - LLM初期化の共通モジュール
==========================================
複数のRAGクラスで共有されるLLM初期化ロジックを集約。

優先順位: Gemini → Groq → OpenAI
"""

import os
from dotenv import load_dotenv

load_dotenv()


def create_llm(temperature: float = 0):
    """
    利用可能なLLMを優先順位に従って初期化する。

    優先順位:
      1. Google Gemini (gemini-2.0-flash) - 無料枠あり・日本語高精度
      2. Groq (llama-3.3-70b-versatile) - 高速推論
      3. OpenAI GPT - 汎用

    Args:
        temperature: 生成の多様性（0=決定的, 1=ランダム）

    Returns:
        LangChain LLM インスタンス

    Raises:
        ValueError: APIキーが未設定の場合
    """
    google_key = os.getenv("GOOGLE_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    # --- Gemini ---
    if google_key and not google_key.startswith("your_"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=temperature,
                google_api_key=google_key,
                max_retries=2,
            )
            print("  LLM: Gemini (gemini-2.0-flash)")
            return llm
        except Exception as e:
            safe_msg = str(e)[:120]
            print(f"  [WARN] Gemini unavailable (fallback): {safe_msg}")

    # --- Groq ---
    if groq_key and not groq_key.startswith("gsk_your"):
        from langchain_groq import ChatGroq
        print("  LLM: Groq (llama-3.3-70b-versatile)")
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=temperature,
            groq_api_key=groq_key,
        )

    # --- OpenAI ---
    if openai_key and not openai_key.startswith("sk-your"):
        from langchain_openai import OpenAI
        print("  LLM: OpenAI")
        return OpenAI(
            temperature=temperature,
            openai_api_key=openai_key,
        )

    raise ValueError(
        "LLM APIキーが未設定です。\n"
        ".envファイルに GOOGLE_API_KEY, GROQ_API_KEY, "
        "または OPENAI_API_KEY を設定してください。"
    )
