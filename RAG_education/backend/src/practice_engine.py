"""問題演習エンジン（4択ドリル形式）"""
import time
import uuid
import random
import re

from src.rag_engine import get_all_docs
from src.llm_client import get_llm
from src.config import load_prompt

DIFFICULTY_MAP = {
    "beginner": "初級（参考資料に書かれている用語や単語を選ぶだけの超簡単な問題）",
    "intermediate": "中級（参考資料の内容を理解していれば答えられる問題）",
    "advanced": "上級（複数の知識を組み合わせて考える問題）",
}


def generate_practice(count: int = 5, difficulty: str = "beginner") -> list[dict]:
    """4択問題をcount問生成する。"""
    all_docs = get_all_docs()
    total = len(all_docs["ids"])

    problems = []
    prompt_template = load_prompt("practice_generate")
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])

    for _ in range(count):
        start = time.time()

        indices = random.sample(range(total), min(2, total))
        selected_docs = [all_docs["documents"][i] for i in indices]

        context = "\n\n".join(selected_docs)
        prompt = prompt_template.format(context=context, difficulty=diff_label)

        llm = get_llm()
        response = llm.invoke(prompt)
        text = response.content

        parsed = _parse_practice(text)
        parsed["practice_id"] = f"p_{uuid.uuid4().hex[:8]}"
        parsed["difficulty"] = difficulty
        parsed["response_time_ms"] = int((time.time() - start) * 1000)

        problems.append(parsed)

    return problems


def generate_practice_single(difficulty: str = "beginner") -> dict:
    """4択問題を1問生成する。"""
    all_docs = get_all_docs()
    total = len(all_docs["ids"])

    start = time.time()

    indices = random.sample(range(total), min(2, total))
    selected_docs = [all_docs["documents"][i] for i in indices]

    context = "\n\n".join(selected_docs)
    prompt_template = load_prompt("practice_generate")
    diff_label = DIFFICULTY_MAP.get(difficulty, DIFFICULTY_MAP["beginner"])
    prompt = prompt_template.format(context=context, difficulty=diff_label)

    llm = get_llm()
    response = llm.invoke(prompt)
    text = response.content

    parsed = _parse_practice(text)
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

    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("問題:") or line.startswith("問題："):
            question = line.split(":", 1)[-1].split("：", 1)[-1].strip()
        elif re.match(r"^[A-D][:：]", line):
            key = line[0]
            val = line[2:].strip()
            choices[key] = val
        elif line.startswith("正解:") or line.startswith("正解："):
            raw = line.split(":", 1)[-1].split("：", 1)[-1].strip()
            correct = raw[0] if raw and raw[0] in "ABCD" else ""
        elif line.startswith("解説:") or line.startswith("解説："):
            explanation = line.split(":", 1)[-1].split("：", 1)[-1].strip()

    if not question:
        question = text.split("\n")[0]

    return {
        "question": question,
        "choices": choices,
        "correct": correct,
        "explanation": explanation,
    }
