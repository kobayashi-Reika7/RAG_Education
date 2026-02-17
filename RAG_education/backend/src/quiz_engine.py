"""クイズ生成・判定エンジン（○×形式 / バッチ対応）"""
import time
import uuid
import random
import re

from src.llm_client import get_llm, get_llm_long
from src.config import load_prompt
from src.bedrock_kb import get_contents_for_quiz

DIFFICULTY_MAP = {
    "beginner": "初級（参考資料に書かれている内容をそのまま判断するだけの超簡単な問題）",
    "intermediate": "中級（参考資料の内容を理解していれば判断できる問題）",
    "advanced": "上級（複数の知識を組み合わせて判断する問題）",
}


def generate_batch(count: int = 5, difficulty: str = "beginner") -> list[dict]:
    """○×クイズをcount問まとめて1回のLLM呼出しで生成する。"""
    start = time.time()

    contents = get_contents_for_quiz(count=max(count, 3))
    if not contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    context = "\n\n".join(contents)
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])

    prompt_template = load_prompt("quiz_batch_generate")
    prompt = prompt_template.format(
        context=context, difficulty=diff_label, count=count,
    )

    llm = get_llm_long()
    response = llm.invoke(prompt)
    text = response.content

    questions = _parse_batch(text, count)
    elapsed = int((time.time() - start) * 1000)

    results = []
    for q in questions:
        q["quiz_id"] = f"q_{uuid.uuid4().hex[:8]}"
        q["difficulty"] = difficulty
        q["format"] = "○×"
        q["hint"] = None
        q["source_chunk_ids"] = []
        q["response_time_ms"] = elapsed
        results.append(q)

    return results


def _parse_batch(text: str, expected_count: int) -> list[dict]:
    """バッチ出力をパースして複数問題に分割する。"""
    questions = []
    current_q = ""
    current_a = ""
    current_e = ""

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        q_match = re.match(r"^Q\d+[:：]\s*(.+)", line)
        a_match = re.match(r"^A\d+[:：]\s*(.+)", line)
        e_match = re.match(r"^E\d+[:：]\s*(.+)", line)

        if q_match:
            if current_q and current_a:
                questions.append(_build_question(current_q, current_a, current_e))
            current_q = q_match.group(1).strip()
            current_a = ""
            current_e = ""
        elif a_match:
            current_a = a_match.group(1).strip()
        elif e_match:
            current_e = e_match.group(1).strip()

    if current_q and current_a:
        questions.append(_build_question(current_q, current_a, current_e))

    return questions[:expected_count]


def _build_question(question: str, answer_raw: str, explanation: str) -> dict:
    """1問分の辞書を作成する。"""
    if "○" in answer_raw:
        expected = "○"
    elif "×" in answer_raw:
        expected = "×"
    else:
        expected = answer_raw.strip()

    return {
        "question": question,
        "expected_answer": expected,
        "explanation": explanation,
    }


def generate(difficulty: str = "beginner", exclude_chunk_ids: list[str] | None = None) -> dict:
    """○×クイズを1問生成する（後方互換用）。"""
    start = time.time()

    contents = get_contents_for_quiz(count=2)
    if not contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    context = "\n\n".join(contents)
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])

    prompt_template = load_prompt("quiz_generate")
    prompt = prompt_template.format(context=context, difficulty=diff_label)

    llm = get_llm()
    response = llm.invoke(prompt)
    text = response.content

    question = ""
    expected_answer = ""
    explanation = ""
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("問題:") or line.startswith("問題："):
            question = line.split(":", 1)[-1].split("：", 1)[-1].strip()
        elif line.startswith("正解:") or line.startswith("正解："):
            raw = line.split(":", 1)[-1].split("：", 1)[-1].strip()
            if "○" in raw:
                expected_answer = "○"
            elif "×" in raw:
                expected_answer = "×"
            else:
                expected_answer = raw
        elif line.startswith("解説:") or line.startswith("解説："):
            explanation = line.split(":", 1)[-1].split("：", 1)[-1].strip()

    if not question:
        question = text.split("\n")[0]

    quiz_id = f"q_{uuid.uuid4().hex[:8]}"
    elapsed = int((time.time() - start) * 1000)

    return {
        "quiz_id": quiz_id,
        "difficulty": difficulty,
        "format": "○×",
        "question": question,
        "expected_answer": expected_answer,
        "explanation": explanation,
        "hint": None,
        "source_chunk_ids": [],
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
    """○×の正誤判定（LLM不要、文字列比較のみ）。"""
    normalized_user = "○" if "○" in user_answer or "まる" in user_answer.lower() else "×" if "×" in user_answer or "ばつ" in user_answer.lower() else user_answer.strip()
    is_correct = normalized_user == expected_answer

    return {
        "quiz_id": quiz_id,
        "is_correct": is_correct,
        "score": 1.0 if is_correct else 0.0,
        "feedback": "正解です！すごい！" if is_correct else f"残念、正解は {expected_answer} です。",
        "explanation": "",
        "source_section": "",
        "response_time_ms": 0,
    }
