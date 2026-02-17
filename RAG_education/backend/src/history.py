"""DynamoDB 学習履歴の書き込み / 読み取り"""
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)

DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "rag_education")
DYNAMODB_REGION = os.getenv("COGNITO_REGION", "us-east-1")

_table = None


def _get_table():
    """DynamoDB テーブルリソースを返す（シングルトン）。"""
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=DYNAMODB_REGION)
        _table = dynamodb.Table(DYNAMODB_TABLE)
    return _table


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_decimal(val):
    """float を DynamoDB 用の Decimal に変換する。"""
    if isinstance(val, float):
        return Decimal(str(val))
    return val


def save_quiz_result(uid: str, req, eval_result: dict) -> None:
    """クイズ判定結果を DynamoDB に保存する。"""
    try:
        table = _get_table()
        ts = _now_iso()
        item_id = f"q_{uuid.uuid4().hex[:8]}"
        table.put_item(Item={
            "PK": f"USER#{uid}",
            "SK": f"QUIZ#{ts}#{item_id}",
            "quiz_id": getattr(req, "quiz_id", ""),
            "difficulty": getattr(req, "difficulty", "beginner"),
            "question": getattr(req, "question", ""),
            "user_answer": getattr(req, "user_answer", ""),
            "expected_answer": getattr(req, "expected_answer", ""),
            "is_correct": eval_result.get("is_correct", False),
            "score": _to_decimal(eval_result.get("score", 0.0)),
            "feedback": eval_result.get("feedback", ""),
            "timestamp": ts,
            "type": "quiz",
        })
        _update_stats(uid)
    except Exception as e:
        logger.warning("クイズ履歴の保存に失敗: %s", e)


def save_practice_result(uid: str, result: dict) -> None:
    """演習結果を DynamoDB に保存する。"""
    try:
        table = _get_table()
        ts = _now_iso()
        item_id = f"p_{uuid.uuid4().hex[:8]}"
        table.put_item(Item={
            "PK": f"USER#{uid}",
            "SK": f"PRACTICE#{ts}#{item_id}",
            "practice_id": result.get("practice_id", ""),
            "question": result.get("question", ""),
            "selected": result.get("selected", ""),
            "correct": result.get("correct", ""),
            "choices": result.get("choices", {}),
            "explanation": result.get("explanation", ""),
            "is_correct": result.get("is_correct", False),
            "difficulty": result.get("difficulty", "beginner"),
            "timestamp": ts,
            "type": "practice",
        })
        _update_stats(uid)
    except Exception as e:
        logger.warning("演習履歴の保存に失敗: %s", e)


def _update_stats(uid: str) -> None:
    """ユーザーの集計統計を再計算して保存する。"""
    try:
        table = _get_table()
        pk = f"USER#{uid}"

        quiz_items = _query_items(pk, "QUIZ#")
        practice_items = _query_items(pk, "PRACTICE#")

        total_quizzes = len(quiz_items)
        total_practices = len(practice_items)

        quiz_scores = [float(i.get("score", 0)) for i in quiz_items]
        practice_correct = sum(1 for i in practice_items if i.get("is_correct"))

        total_items = total_quizzes + total_practices
        if total_items > 0:
            quiz_total = sum(quiz_scores) if quiz_scores else 0
            avg_score = (quiz_total + practice_correct) / total_items
        else:
            avg_score = 0.0

        all_timestamps = []
        for i in quiz_items + practice_items:
            ts = i.get("timestamp", "")
            if ts:
                all_timestamps.append(ts)

        active_dates = set()
        for ts in all_timestamps:
            try:
                dt = datetime.fromisoformat(ts)
                active_dates.add(dt.date())
            except (ValueError, TypeError):
                pass

        streak_days = _calc_streak(active_dates)
        last_active = max(all_timestamps) if all_timestamps else None

        stats = {
            "PK": pk,
            "SK": "STATS",
            "total_quizzes": total_quizzes,
            "total_practices": total_practices,
            "avg_score": _to_decimal(round(avg_score, 2)),
            "streak_days": streak_days,
            "last_active": last_active or "",
        }
        table.put_item(Item=stats)

    except Exception as e:
        logger.warning("統計更新に失敗: %s", e)


def _query_items(pk: str, sk_prefix: str) -> list[dict]:
    """PK + SK prefix で DynamoDB をクエリし、全アイテムを返す。"""
    table = _get_table()
    items = []
    response = table.query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix),
        ScanIndexForward=False,
    )
    items.extend(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = table.query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix),
            ScanIndexForward=False,
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))
    return items


def _calc_streak(active_dates: set) -> int:
    """連続学習日数を計算する。"""
    if not active_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    sorted_dates = sorted(active_dates, reverse=True)

    if sorted_dates[0] < today:
        if (today - sorted_dates[0]).days > 1:
            return 0

    streak = 1
    for i in range(len(sorted_dates) - 1):
        diff = (sorted_dates[i] - sorted_dates[i + 1]).days
        if diff == 1:
            streak += 1
        elif diff > 1:
            break

    return streak


def get_user_stats(uid: str) -> dict:
    """ユーザーの学習統計 + 直近の履歴を返す。"""
    table = _get_table()
    pk = f"USER#{uid}"

    stats_resp = table.get_item(Key={"PK": pk, "SK": "STATS"})
    stats_item = stats_resp.get("Item")

    if stats_item:
        stats = {
            "total_quizzes": int(stats_item.get("total_quizzes", 0)),
            "total_practices": int(stats_item.get("total_practices", 0)),
            "avg_score": float(stats_item.get("avg_score", 0)),
            "streak_days": int(stats_item.get("streak_days", 0)),
            "last_active": stats_item.get("last_active") or None,
        }
    else:
        stats = {
            "total_quizzes": 0,
            "total_practices": 0,
            "avg_score": 0.0,
            "streak_days": 0,
            "last_active": None,
        }

    quiz_items = _query_items(pk, "QUIZ#")
    practice_items = _query_items(pk, "PRACTICE#")

    all_quiz = []
    for item in quiz_items:
        all_quiz.append({
            "id": item["SK"],
            "type": "quiz",
            "quiz_id": item.get("quiz_id", ""),
            "question": item.get("question", ""),
            "is_correct": bool(item.get("is_correct", False)),
            "score": float(item.get("score", 0)),
            "timestamp": item.get("timestamp", ""),
            "difficulty": item.get("difficulty", "beginner"),
            "user_answer": item.get("user_answer", ""),
            "expected_answer": item.get("expected_answer", ""),
            "feedback": item.get("feedback", ""),
        })

    all_practice = []
    for item in practice_items:
        all_practice.append({
            "id": item["SK"],
            "type": "practice",
            "practice_id": item.get("practice_id", ""),
            "question": item.get("question", ""),
            "is_correct": bool(item.get("is_correct", False)),
            "score": 1.0 if item.get("is_correct") else 0.0,
            "timestamp": item.get("timestamp", ""),
            "difficulty": item.get("difficulty", "beginner"),
            "selected": item.get("selected", ""),
            "correct": item.get("correct", ""),
            "choices": item.get("choices", {}),
            "explanation": item.get("explanation", ""),
        })

    all_items = all_quiz + all_practice
    all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    recent = all_items[:20]

    difficulty_stats = {}
    for diff in ("beginner", "intermediate", "advanced"):
        items = [i for i in all_items if i.get("difficulty") == diff]
        total = len(items)
        correct = sum(1 for i in items if i.get("is_correct"))
        difficulty_stats[diff] = {
            "total": total,
            "correct": correct,
            "accuracy": round(correct / total, 2) if total > 0 else 0.0,
        }

    quiz_correct = sum(1 for i in all_quiz if i.get("is_correct"))
    practice_correct = sum(1 for i in all_practice if i.get("is_correct"))

    stats["quiz_accuracy"] = round(quiz_correct / len(all_quiz), 2) if all_quiz else 0.0
    stats["practice_accuracy"] = round(practice_correct / len(all_practice), 2) if all_practice else 0.0
    stats["total_correct"] = quiz_correct + practice_correct
    stats["difficulty_stats"] = difficulty_stats

    today = datetime.now(timezone.utc).date()
    daily_activity = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        day_items = [it for it in all_items if it.get("timestamp", "").startswith(d_str)]
        day_correct = sum(1 for it in day_items if it.get("is_correct"))
        daily_activity.append({
            "date": d_str,
            "total": len(day_items),
            "correct": day_correct,
        })

    stats["daily_activity"] = daily_activity
    stats["recent_history"] = recent
    return stats
