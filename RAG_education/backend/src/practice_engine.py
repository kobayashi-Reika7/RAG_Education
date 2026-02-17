"""問題演習エンジン（4択ドリル形式）"""
import logging
import time
import uuid
import random
import re

from src.llm_client import get_llm
from src.config import load_prompt
from src.bedrock_kb import get_contents_for_quiz

logger = logging.getLogger(__name__)

MAX_DEDUP_RETRIES = 1

DIFFICULTY_MAP = {
    "beginner": (
        "★ 初級（新人レベル＝暗記で解ける）\n"
        "【思考】単純な知識の再認。資料を読めば誰でも即答できるレベル。\n"
        "【問題文】30〜50文字。「〜とは何か」「〜の略称は」のような1つの用語・定義だけを問う。\n"
        "【選択肢】各10〜25文字。正解は資料の表現そのまま。\n"
        "【不正解の作り方】全く別のジャンルの用語を並べる。迷う余地ゼロ。\n"
        "  例: RAGの問題に「データベースのテーブル設計手法」のような無関係な選択肢\n"
        "【解説】50〜80文字。「〜は〜です」と事実を述べるだけ。"
    ),
    "intermediate": (
        "★★ 中級（アマチュアレベル＝理解していないと間違える）\n"
        "【思考】概念の比較・関係性の理解。暗記だけでは解けず、違いを説明できる必要がある。\n"
        "【問題文】50〜80文字。「AとBの違い」「〜の手順で正しいのは」「〜の目的として適切なのは」等。\n"
        "【選択肢】各15〜35文字。正解は資料の内容を別の表現で言い換えたもの。\n"
        "【不正解の作り方】同じ分野の用語を使い、一見もっともらしいが核心部分が間違っている。\n"
        "  例: 「意味的類似性」を「キーワード完全一致」にすり替える等、重要な1点だけ違う\n"
        "【解説】80〜120文字。なぜ正解が正しく、各不正解がどこが違うかを比較して説明。"
    ),
    "advanced": (
        "★★★ 上級（プロレベル＝実務経験がないと判断できない）\n"
        "【思考】複数概念の統合・トレードオフ分析・実務シナリオでの最適解の判断。\n"
        "【問題文】80〜120文字。必ず具体的な状況設定を含む。\n"
        "  「〜のシステムで〜が発生している。この場合、最も効果的な対策は」のようなシナリオ型。\n"
        "【選択肢】各20〜40文字。4つ全てが実務でありえるアプローチ。\n"
        "【不正解の作り方】全選択肢がもっともらしい。正解だけが資料の根拠+状況の条件に合致する。\n"
        "  不正解は「間違いではないが、この状況では最適ではない」レベルの高度な紛らわしさ。\n"
        "【解説】120〜200文字。正解の実務的根拠、各不正解がこの状況で不適切な理由、\n"
        "  トレードオフや例外ケースにも言及。"
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


def _is_duplicate(question: str, past_questions: list[str] | None) -> bool:
    """生成された問題が過去問と重複しているかを判定する。
    完全一致だけでなく、先頭30文字が同じ場合も重複とみなす。
    """
    if not question or not past_questions:
        return False
    q_norm = question.strip()
    q_prefix = q_norm[:30]
    for past in past_questions:
        p_norm = past.strip()
        if q_norm == p_norm:
            return True
        if q_prefix and p_norm.startswith(q_prefix):
            return True
    return False


def _is_valid_problem(parsed: dict) -> bool:
    """表示に必要な最低限の項目が揃っているか。"""
    question = (parsed.get("question") or "").strip()
    correct = (parsed.get("correct") or "").strip()
    explanation = (parsed.get("explanation") or "").strip()
    choices = parsed.get("choices") or {}
    filled_choices = sum(1 for key in ("A", "B", "C", "D") if (choices.get(key) or "").strip())
    return bool(question) and correct in {"A", "B", "C", "D"} and bool(explanation) and filled_choices >= 4


def generate_practice(
    count: int = 5,
    difficulty: str = "beginner",
    past_questions: list[str] | None = None,
) -> list[dict]:
    """4択問題をcount問生成する。"""
    all_contents = get_contents_for_quiz(count=max(count, 3))
    if not all_contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    problems = []
    prompt_template = load_prompt("practice_generate")
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    asked = list(past_questions or [])

    llm = get_llm()

    for i in range(count):
        start = time.time()

        parsed = None
        is_valid = False
        for attempt in range(1 + MAX_DEDUP_RETRIES):
            selected = random.sample(all_contents, min(2, len(all_contents)))
            context = "\n\n".join(selected)
            past_section = _build_past_section(asked)
            prompt = prompt_template.format(
                context=context, difficulty=diff_label, past_questions=past_section,
            )

            response = llm.invoke(prompt)
            parsed = _parse_practice(response.content)

            if not _is_duplicate(parsed["question"], asked) and _is_valid_problem(parsed):
                is_valid = True
                break
            logger.info("Batch[%d] invalid/duplicate (attempt %d/%d), retrying...",
                         i, attempt + 1, 1 + MAX_DEDUP_RETRIES)

        if not is_valid:
            raise ValueError("問題生成の整合性チェックに失敗しました。再度お試しください。")

        parsed["practice_id"] = f"p_{uuid.uuid4().hex[:8]}"
        parsed["difficulty"] = difficulty
        parsed["response_time_ms"] = int((time.time() - start) * 1000)

        if parsed["question"]:
            asked.append(parsed["question"])

        problems.append(parsed)

    return problems


def generate_practice_single(
    difficulty: str = "beginner",
    past_questions: list[str] | None = None,
) -> dict:
    """4択問題を1問生成する。重複時はリトライする。"""
    start = time.time()

    contents = get_contents_for_quiz(count=2)
    if not contents:
        raise ValueError("ナレッジベースからコンテンツを取得できませんでした")

    prompt_template = load_prompt("practice_generate")
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    llm = get_llm()

    parsed = None
    is_valid = False
    for attempt in range(1 + MAX_DEDUP_RETRIES):
        selected = random.sample(contents, min(2, len(contents)))
        context = "\n\n".join(selected)
        past_section = _build_past_section(past_questions)
        prompt = prompt_template.format(
            context=context, difficulty=diff_label, past_questions=past_section,
        )

        response = llm.invoke(prompt)
        parsed = _parse_practice(response.content)

        if not _is_duplicate(parsed["question"], past_questions) and _is_valid_problem(parsed):
            is_valid = True
            break
        logger.info("Invalid/duplicate detected (attempt %d/%d), retrying...",
                     attempt + 1, 1 + MAX_DEDUP_RETRIES)

    if not is_valid:
        raise ValueError("問題生成の整合性チェックに失敗しました。再度お試しください。")

    parsed["practice_id"] = f"p_{uuid.uuid4().hex[:8]}"
    parsed["difficulty"] = difficulty
    parsed["response_time_ms"] = int((time.time() - start) * 1000)

    return parsed


def _parse_practice(text: str) -> dict:
    """LLM出力をパースして問題辞書にする。"""
    question = ""
    choices = {"A": "", "B": "", "C": "", "D": ""}
    correct = ""
    explanation = ""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # 選択肢の位置を基準に全体を構造解析する（ラベル文字化け時も動く）
    choice_idx: dict[str, int] = {}
    for i, ln in enumerate(lines):
        m = re.match(r"^([A-D])[:：]\s*(.*)$", ln)
        if m:
            key = m.group(1)
            val = m.group(2).strip()
            choice_idx[key] = i
            choices[key] = val

    first_choice_i = min(choice_idx.values()) if choice_idx else None

    # 問題文: 先頭〜最初の選択肢行の直前まで（ラベル行だけは除外）
    if first_choice_i is not None:
        q_lines = []
        for ln in lines[:first_choice_i]:
            if re.match(r"^[^:：]{1,8}[:：]\s*$", ln):
                continue
            if re.match(r"^(Q|問題)[:：]\s*$", ln):
                continue
            q_lines.append(ln)
        question = " ".join(q_lines).strip()

    # 正解行を探す（A/B/C/D 以外のラベルで値が A-D）
    correct_i = None
    for i, ln in enumerate(lines):
        if re.match(r"^[A-D][:：]", ln):
            continue
        m = re.match(r"^[^:：]{1,12}[:：]\s*([ABCD])\b", ln)
        if m:
            correct = m.group(1)
            correct_i = i
            break

    # 解説: 正解行の次以降。先頭にラベルがあれば削る
    if correct_i is not None and correct_i + 1 < len(lines):
        exp_lines = lines[correct_i + 1 :]
        if exp_lines:
            head = re.sub(r"^[^:：]{1,12}[:：]\s*", "", exp_lines[0]).strip()
            exp_lines[0] = head if head else exp_lines[0]
        explanation = " ".join(exp_lines).strip()

    # フォールバック
    if not question and lines:
        question = lines[0]
    if question in {"問題", "問題:", "問題："} and len(lines) > 1:
        question = lines[1]

    return {
        "question": question,
        "choices": choices,
        "correct": correct,
        "explanation": explanation,
    }
