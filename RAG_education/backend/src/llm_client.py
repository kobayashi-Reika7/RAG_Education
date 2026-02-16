"""LLMクライアント（Gemini / Bedrock 切替対応）"""
import os
from langchain_google_genai import ChatGoogleGenerativeAI


def get_llm():
    """LLMインスタンスを返す。"""
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.3,
    )
