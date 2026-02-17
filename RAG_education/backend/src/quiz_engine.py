"""クイズ生成・判定エンジン（○×形式 / バッチ対応）"""
import logging
import time
import uuid
import random
import re

from src.llm_client import get_llm, get_llm_long
from src.config import load_prompt
from src.bedrock_kb import get_contents_for_quiz

logger = logging.getLogger(__name__)
MAX_PARSE_RETRIES = 3

DIFFICULTY_MAP = {
    "beginner": (
        "★ 初級（新人レベル＝暗記で解ける）\n"
        "【思考】単純な知識の再認。資料を読めば誰でも即答できるレベル。\n"
        "【問題文】30〜50文字の断定文。1つの用語・定義・事実だけを述べる。\n"
        "【×の作り方】全く別の概念にすり替える。迷う余地ゼロの明らかな間違い。\n"
        "【解説】30〜60文字。「〜は〜です」と事実を述べるだけ。"
    ),
    "intermediate": (
        "★★ 中級（アマチュアレベル＝理解していないと間違える）\n"
        "【思考】概念の比較・因果関係・手順の正確な理解が必要。暗記だけでは解けない。\n"
        "【問題文】50〜80文字の複文。条件・比較・修飾語を含む。\n"
        "【×の作り方】事実と1〜2点だけ微妙に異なる紛らわしい文。同じ分野の用語を混同させる。\n"
        "  主語と述語の入替 / 条件のすり替え / 似た概念の混同\n"
        "【解説】60〜100文字。正しい事実との違いを比較して説明。"
    ),
    "advanced": (
        "★★★ 上級（プロレベル＝実務経験がないと判断できない）\n"
        "【思考】複数概念の統合・推論・例外の理解。深い知識と応用力が必要。\n"
        "【問題文】80〜120文字の複雑な文。複数の概念・条件を1文に組み合わせる。\n"
        "【×の作り方】一見完全に正しそうだが、重要な前提条件・例外・限界が抜けている。\n"
        "  「常に」「必ず」「全て」等の断定語で罠を仕掛ける。\n"
        "【解説】100〜180文字。前提条件・例外・実務上の根拠を含めて詳しく。"
    ),
}


def _build_past_section(past_questions: list[str] | None) -> str:
    """過去に出題済みの問題リストをプロンプト用テキストに変換する。"""
    if not past_questions:
        return ""
    lines = [f"- {q}" for q in past_questions[-20:]]
    return (
        "\n\n## 出題済みの問題（これらと同じ・類似の問題は絶対に出さないこと）\n"
        + "\n".join(lines)
    )


def _is_valid_quiz(q: dict) -> bool:
    question = (q.get("question") or "").strip()
    expected = (q.get("expected_answer") or "").strip()
    explanation = (q.get("explanation") or "").strip()
    return bool(question) and expected in {"○", "×"} and bool(explanation)


def generate_batch(
    count: int = 5,
    difficulty: str = "beginner",
    past_questions: list[str] | None = None,
) -> list[dict]:
    """○×クイズをcount問まとめて1回のLLM呼出しで生成する。"""
    start = time.time()

    contents = get_contents_for_quiz(count=max(count, 3))
    if not contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    context = "\n\n".join(contents)
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    past_section = _build_past_section(past_questions)

    prompt_template = load_prompt("quiz_batch_generate")
    prompt = prompt_template.format(
        context=context, difficulty=diff_label, count=count,
        past_questions=past_section,
    )

    llm = get_llm_long()
    questions: list[dict] = []
    past_set = {p.strip() for p in (past_questions or [])}
    past_prefixes = {p.strip()[:30] for p in (past_questions or []) if p.strip()}

    for attempt in range(1 + MAX_PARSE_RETRIES):
        response = llm.invoke(prompt)
        text = response.content
        parsed = _parse_batch(text, count)
        valid = [q for q in parsed if _is_valid_quiz(q)]

        deduped = []
        seen: set[str] = set()
        for q in valid:
            qtext = q.get("question", "").strip()
            prefix = qtext[:30]
            if qtext in past_set or prefix in past_prefixes or qtext in seen:
                continue
            seen.add(qtext)
            deduped.append(q)

        questions = deduped
        if len(questions) >= count:
            break
        logger.info("Quiz batch parse/dedup incomplete (attempt %d/%d): %d/%d",
                    attempt + 1, 1 + MAX_PARSE_RETRIES, len(questions), count)

    if len(questions) < count:
        raise ValueError("クイズ生成の整合性チェックに失敗しました。再度お試しください。")

    questions = questions[:count]
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


def generate(
    difficulty: str = "beginner",
    exclude_chunk_ids: list[str] | None = None,
    past_questions: list[str] | None = None,
) -> dict:
    """○×クイズを1問生成する（後方互換用）。"""
    start = time.time()

    contents = get_contents_for_quiz(count=2)
    if not contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    context = "\n\n".join(contents)
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    past_section = _build_past_section(past_questions)

    prompt_template = load_prompt("quiz_generate")
    prompt = prompt_template.format(
        context=context, difficulty=diff_label,
        past_questions=past_section,
    )

    llm = get_llm()
    question = ""
    expected_answer = ""
    explanation = ""
    is_valid = False
    for attempt in range(1 + MAX_PARSE_RETRIES):
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
            question = text.split("\n")[0].strip()

        candidate = {
            "question": question,
            "expected_answer": expected_answer,
            "explanation": explanation,
        }
        if _is_valid_quiz(candidate):
            is_valid = True
            break
        logger.info("Quiz single parse incomplete (attempt %d/%d), retrying...", attempt + 1, 1 + MAX_PARSE_RETRIES)

    if not is_valid:
        raise ValueError("クイズ生成の整合性チェックに失敗しました。再度お試しください。")

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
