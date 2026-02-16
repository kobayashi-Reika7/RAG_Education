"""Firestore 学習履歴の書き込み / 読み取り"""
import logging
from datetime import datetime, timezone

from google.cloud.firestore_v1 import FieldFilter

from src.firebase_app import get_firestore

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_quiz_result(uid: str, req, eval_result: dict) -> None:
    """クイズ判定結果を Firestore に保存する。"""
    try:
        db = get_firestore()
        doc = {
            "quiz_id": getattr(req, "quiz_id", ""),
            "difficulty": getattr(req, "difficulty", "beginner"),
            "question": getattr(req, "question", ""),
            "user_answer": getattr(req, "user_answer", ""),
            "expected_answer": getattr(req, "expected_answer", ""),
            "is_correct": eval_result.get("is_correct", False),
            "score": eval_result.get("score", 0.0),
            "feedback": eval_result.get("feedback", ""),
            "timestamp": _now_iso(),
        }
        db.collection("users").document(uid).collection("quiz_history").add(doc)
        _update_stats(uid)
    except Exception as e:
        logger.warning(f"クイズ履歴の保存に失敗: {e}")


def save_practice_result(uid: str, result: dict) -> None:
    """演習結果を Firestore に保存する。"""
    try:
        db = get_firestore()
        doc = {
            "practice_id": result.get("practice_id", ""),
            "question": result.get("question", ""),
            "selected": result.get("selected", ""),
            "correct": result.get("correct", ""),
            "is_correct": result.get("is_correct", False),
            "difficulty": result.get("difficulty", "beginner"),
            "timestamp": _now_iso(),
        }
        db.collection("users").document(uid).collection("practice_history").add(doc)
        _update_stats(uid)
    except Exception as e:
        logger.warning(f"演習履歴の保存に失敗: {e}")


def _update_stats(uid: str) -> None:
    """ユーザーの集計統計を再計算して保存する。"""
    try:
        db = get_firestore()
        user_ref = db.collection("users").document(uid)

        quiz_docs = list(user_ref.collection("quiz_history").stream())
        practice_docs = list(user_ref.collection("practice_history").stream())

        total_quizzes = len(quiz_docs)
        total_practices = len(practice_docs)

        quiz_scores = [d.to_dict().get("score", 0) for d in quiz_docs]
        practice_correct = sum(1 for d in practice_docs if d.to_dict().get("is_correct"))

        total_items = total_quizzes + total_practices
        if total_items > 0:
            quiz_total = sum(quiz_scores) if quiz_scores else 0
            avg_score = (quiz_total + practice_correct) / total_items
        else:
            avg_score = 0.0

        all_timestamps = []
        for d in quiz_docs:
            ts = d.to_dict().get("timestamp", "")
            if ts:
                all_timestamps.append(ts)
        for d in practice_docs:
            ts = d.to_dict().get("timestamp", "")
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
            "total_quizzes": total_quizzes,
            "total_practices": total_practices,
            "avg_score": round(avg_score, 2),
            "streak_days": streak_days,
            "last_active": last_active,
        }

        user_ref.collection("stats").document("summary").set(stats)

    except Exception as e:
        logger.warning(f"統計更新に失敗: {e}")


def _calc_streak(active_dates: set) -> int:
    """連続学習日数を計算する。"""
    if not active_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    sorted_dates = sorted(active_dates, reverse=True)

    if sorted_dates[0] != today and (len(sorted_dates) < 2 or sorted_dates[0] != today):
        if sorted_dates[0] < today:
            from datetime import timedelta
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
    db = get_firestore()
    user_ref = db.collection("users").document(uid)

    stats_doc = user_ref.collection("stats").document("summary").get()
    if stats_doc.exists:
        stats = stats_doc.to_dict()
    else:
        stats = {
            "total_quizzes": 0,
            "total_practices": 0,
            "avg_score": 0.0,
            "streak_days": 0,
            "last_active": None,
        }

    recent = []

    quiz_docs = (
        user_ref.collection("quiz_history")
        .order_by("timestamp", direction="DESCENDING")
        .limit(10)
        .stream()
    )
    for d in quiz_docs:
        data = d.to_dict()
        recent.append({
            "id": d.id,
            "type": "quiz",
            "question": data.get("question", ""),
            "is_correct": data.get("is_correct", False),
            "score": data.get("score", 0.0),
            "timestamp": data.get("timestamp", ""),
            "difficulty": data.get("difficulty", ""),
        })

    practice_docs = (
        user_ref.collection("practice_history")
        .order_by("timestamp", direction="DESCENDING")
        .limit(10)
        .stream()
    )
    for d in practice_docs:
        data = d.to_dict()
        recent.append({
            "id": d.id,
            "type": "practice",
            "question": data.get("question", ""),
            "is_correct": data.get("is_correct", False),
            "score": 1.0 if data.get("is_correct") else 0.0,
            "timestamp": data.get("timestamp", ""),
        })

    recent.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    recent = recent[:15]

    stats["recent_history"] = recent
    return stats
