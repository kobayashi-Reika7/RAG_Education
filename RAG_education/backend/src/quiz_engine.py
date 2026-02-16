"""クイズ生成・判定エンジン"""
import time
import uuid
import random

from src.rag_engine import _get_vectordb
from src.llm_client import get_llm

DIFFICULTY_MAP = {
    "beginner": "初級（マニュアルに直接書かれている事実を問う簡単な問題）",
    "intermediate": "中級（複数の情報を組み合わせて答える問題）",
    "advanced": "上級（応用・考察を求める問題。「なぜ？」「どう思う？」）",
}

GENERATE_PROMPT = """あなたは教育用クイズの出題者です。
以下の参考資料を元に、{difficulty}のクイズを1問だけ作成してください。

## 参考資料
{context}

## 出力形式（必ずこの形式で）
問題: （問題文）
正解: （模範解答）
ヒント: （ヒント）"""

EVALUATE_PROMPT = """あなたは教育クイズの採点者です。
以下の問題・模範解答・ユーザー回答を比較し、正誤を判定してください。
難易度は{difficulty}です。

## 問題
{question}

## 模範解答
{expected_answer}

## ユーザーの回答
{user_answer}

## 出力形式（必ずこの形式で）
判定: （正解 or 不正解 or 部分正解）
スコア: （0.0〜1.0の数値）
フィードバック: （短い一言）
解説: （詳しい解説）"""


def generate(difficulty: str = "beginner") -> dict:
    """クイズを1問生成する。"""
    start = time.time()

    db = _get_vectordb()
    all_docs = db.get()
    total = len(all_docs["ids"])

    indices = random.sample(range(total), min(3, total))
    selected_docs = [all_docs["documents"][i] for i in indices]
    selected_metas = [all_docs["metadatas"][i] for i in indices]
    selected_ids = [all_docs["ids"][i] for i in indices]

    context = "\n\n".join(selected_docs)
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    prompt = GENERATE_PROMPT.format(context=context, difficulty=diff_label)

    llm = get_llm()
    response = llm.invoke(prompt)
    text = response.content

    question = ""
    expected_answer = ""
    hint = ""
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("問題:") or line.startswith("問題："):
            question = line.split(":", 1)[-1].split("：", 1)[-1].strip()
        elif line.startswith("正解:") or line.startswith("正解："):
            expected_answer = line.split(":", 1)[-1].split("：", 1)[-1].strip()
        elif line.startswith("ヒント:") or line.startswith("ヒント："):
            hint = line.split(":", 1)[-1].split("：", 1)[-1].strip()

    if not question:
        question = text.split("\n")[0]

    quiz_id = f"q_{uuid.uuid4().hex[:8]}"
    elapsed = int((time.time() - start) * 1000)

    chunk_ids = [m.get("chunk_id", "") for m in selected_metas]

    return {
        "quiz_id": quiz_id,
        "difficulty": difficulty,
        "question": question,
        "hint": hint or None,
        "source_chunk_ids": chunk_ids,
        "expected_answer": expected_answer,
        "response_time_ms": elapsed,
    }


def evaluate(
    quiz_id: str,
    question: str,
    expected_answer: str,
    user_answer: str,
    difficulty: str = "beginner",
    source_chunk_ids: list[str] | None = None,
) -> dict:
    """ユーザー回答を判定する。"""
    start = time.time()

    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    prompt = EVALUATE_PROMPT.format(
        difficulty=diff_label,
        question=question,
        expected_answer=expected_answer,
        user_answer=user_answer,
    )

    llm = get_llm()
    response = llm.invoke(prompt)
    text = response.content

    is_correct = False
    score = 0.0
    feedback = ""
    explanation = ""

    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("判定:") or line.startswith("判定："):
            val = line.split(":", 1)[-1].split("：", 1)[-1].strip()
            is_correct = "正解" in val and "不正解" not in val
        elif line.startswith("スコア:") or line.startswith("スコア："):
            try:
                score = float(line.split(":", 1)[-1].split("：", 1)[-1].strip())
            except ValueError:
                score = 1.0 if is_correct else 0.0
        elif line.startswith("フィードバック:") or line.startswith("フィードバック："):
            feedback = line.split(":", 1)[-1].split("：", 1)[-1].strip()
        elif line.startswith("解説:") or line.startswith("解説："):
            explanation = line.split(":", 1)[-1].split("：", 1)[-1].strip()

    elapsed = int((time.time() - start) * 1000)

    return {
        "quiz_id": quiz_id,
        "is_correct": is_correct,
        "score": score,
        "feedback": feedback or ("正解です！" if is_correct else "不正解です。"),
        "explanation": explanation,
        "source_section": "",
        "response_time_ms": elapsed,
    }
