"""
予約・空き枠の業務ロジック（バックエンド専用）
- 勤務判定・空き判定・医師割当はすべてここで行う
- フロントは API の { time, reservable } のみ表示する
- 予約の正規情報は Firestore（doctorId 付き）で、キャンセル時もスロットが正しく解放される
- 環境変数 USE_DEMO_SLOTS=1 のとき、医師データが無い場合にデモ用の○を返す（シード未実行時用）
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)

from firebase_admin_client import init_firebase_admin

# 15分刻み 09:00〜16:45（フロント getTimeSlots と一致）
TIME_SLOTS = [
    f"{h:02d}:{m:02d}"
    for h in range(9, 17)
    for m in (0, 15, 30, 45)
]

WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _get_firestore():
    init_firebase_admin()
    return firestore.client()


def _weekday_key(date_str: str) -> str:
    """YYYY-MM-DD → mon, tue, ... (0=Mon)"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return WEEKDAY_KEYS[dt.weekday()]
    except (ValueError, IndexError):
        return "sun"


def _normalize_schedules(schedules: dict[str, Any] | None) -> dict[str, list[str]]:
    """schedules を WEEKDAY_KEYS ごとの list に正規化（キー欠損・非list を [] に）"""
    schedules = schedules or {}
    out: dict[str, list[str]] = {}
    for k in WEEKDAY_KEYS:
        val = schedules.get(k)
        out[k] = list(val) if isinstance(val, list) else []
    return out


def _get_doctors_by_department(department_label: str) -> list[dict[str, Any]]:
    """Firestore doctors から診療科（表示名）で医師一覧を取得"""
    db = _get_firestore()
    coll = db.collection("doctors")
    q = coll.where("department", "==", department_label.strip())
    snap = q.stream()
    out = []
    for doc in snap:
        d = doc.to_dict()
        schedules = _normalize_schedules(d.get("schedules"))
        out.append({
            "id": doc.id,
            "name": d.get("name") or "",
            "department": d.get("department") or "",
            "schedules": schedules,
        })
    return out


def _has_reservation(doctor_id: str, date: str, time: str) -> bool:
    """Firestore collectionGroup で該当医師・日・時間の予約が1件でもあれば True"""
    db = _get_firestore()
    coll = db.collection_group("reservations")
    q = coll.where("doctorId", "==", doctor_id).where("date", "==", date).where("time", "==", time).limit(1)
    return len(list(q.stream())) > 0


def _is_working(doctor: dict[str, Any], date: str, time: str) -> bool:
    """その日・その時間に勤務しているか（schedules の配列に time が含まれるか）"""
    key = _weekday_key(date)
    slots = doctor.get("schedules") or {}
    arr = slots.get(key) or []
    return time in arr


def _get_available_doctors(department_label: str, date: str, time: str) -> list[dict[str, Any]]:
    """その診療科・日・時間で空いている医師一覧（勤務かつ未予約）"""
    doctors = _get_doctors_by_department(department_label)
    return [
        d for d in doctors
        if _is_working(d, date, time) and not _has_reservation(d["id"], date, time)
    ]


def is_reservable(department_label: str, date: str, time: str) -> bool:
    """
    診療科・日・時間で予約可能か（1人でも空いていれば True）。
    get_slots（availability API）と create_reservation の両方で使用する共通判定。
    """
    return len(_get_available_doctors(department_label, date, time)) > 0


def assign_doctor(available_doctors: list[dict[str, Any]]) -> dict[str, Any] | None:
    """空いている医師から1人を選択（先頭を返す）"""
    if not available_doctors:
        return None
    return available_doctors[0]


def _is_japanese_holiday(date_str: str) -> bool:
    """日本の祝日かどうか（簡易判定）。フロント utils/holiday.js isJapaneseHoliday と同一条件にすること。"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return False
    y, m, d = dt.year, dt.month, dt.day
    fixed = [
        (1, 1), (2, 11), (4, 29), (5, 3), (5, 4), (5, 5),
        (8, 11), (11, 3), (11, 23), (12, 23),
    ]
    if (m, d) in fixed:
        return True
    if m == 2 and d == 23:
        return True  # 天皇誕生日
    # 1月第2月曜（成人の日）。weekday(): 0=Mon, 6=Sun
    first_jan = datetime(y, 1, 1)
    second_monday_jan = 8 + (7 - first_jan.weekday()) % 7
    if m == 1 and d == second_monday_jan:
        return True
    if m == 7 and d == 18 and y >= 2023:
        return True  # 海の日
    if m == 9 and d == 23:
        return True  # 秋分の日（近似）
    first_oct = datetime(y, 10, 1)
    second_monday_oct = 8 + (7 - first_oct.weekday()) % 7
    if m == 10 and d == second_monday_oct:
        return True  # スポーツの日
    return False


def _demo_reservable(date_str: str, time_str: str) -> bool:
    """デモ用: 平日の 09:00〜11:45 を予約可とする（シード未実行時用）"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if dt.weekday() >= 5:  # 土日は×
            return False
    except (ValueError, TypeError):
        return False
    demo_times = [t for t in TIME_SLOTS if t < "12:00"]  # 09:00〜11:45
    return time_str in demo_times


def get_slots(department_label: str, date: str) -> list[dict[str, str | bool]]:
    """
    診療科・日付に対する全時間枠の予約可否を返す（祝日はバックエンドで判定し全枠×）。
    フロントはこの結果だけを表示する（○×の計算はしない）。
    """
    if not department_label or not date:
        return [{"time": t, "reservable": False} for t in TIME_SLOTS]
    if _is_japanese_holiday(date):
        return [{"time": t, "reservable": False} for t in TIME_SLOTS]
    use_demo_fallback = os.environ.get("USE_DEMO_SLOTS", "1").strip() != "0"
    try:
        doctors = _get_doctors_by_department(department_label)
    except Exception:
        doctors = []
    if not doctors and use_demo_fallback:
        return [
            {"time": t, "reservable": _demo_reservable(date, t)}
            for t in TIME_SLOTS
        ]
    try:
        return [
            {"time": t, "reservable": is_reservable(department_label, date, t)}
            for t in TIME_SLOTS
        ]
    except Exception:
        if use_demo_fallback:
            return [
                {"time": t, "reservable": _demo_reservable(date, t)}
                for t in TIME_SLOTS
            ]
        return [{"time": t, "reservable": False} for t in TIME_SLOTS]


def _get_reservations_bulk(doctor_ids: list[str], dates: list[str]) -> set[tuple[str, str, str]]:
    """
    複数医師・複数日付の予約を一括取得し、(doctorId, date, time) の set を返す。
    Firestore の collectionGroup + "in" で最大30件の日付をまとめて取得。
    """
    if not doctor_ids or not dates:
        return set()
    db = _get_firestore()
    reserved: set[tuple[str, str, str]] = set()
    # Firestore "in" は最大30件 → 7日分なら余裕
    chunk_size = 30
    for i in range(0, len(dates), chunk_size):
        date_chunk = dates[i:i + chunk_size]
        try:
            q = db.collection_group("reservations").where("date", "in", date_chunk)
            for doc in q.stream():
                d = doc.to_dict()
                did = d.get("doctorId", "")
                if did in doctor_ids:
                    reserved.add((did, d.get("date", ""), d.get("time", "")))
        except Exception as e:
            logger.warning("_get_reservations_bulk failed for dates %s: %s", date_chunk, e)
    return reserved


def get_availability_for_dates(department_label: str, dates: list[str]) -> list[dict[str, Any]]:
    """
    複数日分の空き状況を一括で返す（高速版）。
    医師取得1回 + 予約取得1回 = Firestore 2クエリで全日分を計算。
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    use_demo = os.environ.get("USE_DEMO_SLOTS", "1").strip() != "0"
    all_false = [{"time": t, "reservable": False} for t in TIME_SLOTS]

    # 過去日・祝日は即決定
    results: dict[str, dict[str, Any]] = {}
    dates_to_compute: list[str] = []
    for date in dates:
        if not date or not department_label:
            results[date] = {"date": date or "", "is_holiday": False, "reservable": False, "reason": "closed", "slots": all_false}
            continue
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            if dt.date() < today.date():
                results[date] = {"date": date, "is_holiday": False, "reservable": False, "reason": "past", "slots": all_false}
                continue
        except (ValueError, TypeError):
            results[date] = {"date": date, "is_holiday": False, "reservable": False, "reason": "closed", "slots": all_false}
            continue
        if _is_japanese_holiday(date):
            results[date] = {"date": date, "is_holiday": True, "reservable": False, "reason": "holiday", "slots": all_false}
            continue
        dates_to_compute.append(date)

    # 計算対象の日付がなければ即返却
    if not dates_to_compute:
        return [results[d] for d in dates]

    # 医師取得（1回のみ）
    try:
        doctors = _get_doctors_by_department(department_label)
    except Exception:
        doctors = []

    if not doctors and use_demo:
        for date in dates_to_compute:
            slot_list = [{"time": t, "reservable": _demo_reservable(date, t)} for t in TIME_SLOTS]
            any_ok = any(s["reservable"] for s in slot_list)
            results[date] = {"date": date, "is_holiday": False, "reservable": any_ok, "reason": None, "slots": slot_list}
        return [results[d] for d in dates]

    if not doctors:
        for date in dates_to_compute:
            results[date] = {"date": date, "is_holiday": False, "reservable": False, "reason": None, "slots": all_false}
        return [results[d] for d in dates]

    # 予約一括取得（1回のみ）
    doctor_ids = [doc["id"] for doc in doctors]
    doctor_id_set = set(doctor_ids)
    try:
        reserved = _get_reservations_bulk(doctor_ids, dates_to_compute)
    except Exception as e:
        logger.warning("get_availability_for_dates: bulk reservation fetch failed: %s", e)
        reserved = set()

    # メモリ上で各日・各時間の空き判定
    for date in dates_to_compute:
        slot_list = []
        for t in TIME_SLOTS:
            available = False
            for doc in doctors:
                if _is_working(doc, date, t) and (doc["id"], date, t) not in reserved:
                    available = True
                    break
            slot_list.append({"time": t, "reservable": available})
        any_ok = any(s["reservable"] for s in slot_list)
        results[date] = {"date": date, "is_holiday": False, "reservable": any_ok, "reason": None, "slots": slot_list}

    return [results[d] for d in dates]


def get_availability_for_date(department_label: str, date: str) -> dict[str, Any]:
    """
    1日分の空き状況を返す。祝日・過去日はバックエンドで判定し、レスポンスに含める。
    判定優先: 過去日 → 祝日 → 休診 → 医師勤務なし → 可。
    """
    slots = [{"time": t, "reservable": False} for t in TIME_SLOTS]
    if not department_label or not date:
        return {
            "date": date or "",
            "is_holiday": False,
            "reservable": False,
            "reason": "closed",
            "slots": slots,
        }
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if dt.date() < today.date():
            return {
                "date": date,
                "is_holiday": False,
                "reservable": False,
                "reason": "past",
                "slots": slots,
            }
    except (ValueError, TypeError):
        return {
            "date": date,
            "is_holiday": False,
            "reservable": False,
            "reason": "closed",
            "slots": slots,
        }
    # 祝日は必ず is_holiday: True と全枠 reservable: False を返す（フロントは isHoliday で表示制御）
    if _is_japanese_holiday(date):
        return {
            "date": date,
            "is_holiday": True,
            "reservable": False,
            "reason": "holiday",
            "slots": slots,
        }
    slot_list = get_slots(department_label, date)
    any_reservable = any(s.get("reservable") for s in slot_list)
    return {
        "date": date,
        "is_holiday": False,
        "reservable": any_reservable,
        "reason": None,
        "slots": slot_list,
    }


def create_reservation(department_label: str, date: str, time: str, user_id: str) -> dict[str, Any]:
    """
    予約を確定する。担当医は自動割当。
    Firestore users/{uid}/reservations に doctorId 付きで保存（一覧・キャンセル・空き判定の正規情報）。
    判定は get_availability_for_date と同一：過去日 → 祝日 → is_reservable（勤務・空き）。
    """
    logger.info(
        "create_reservation start: department=%r date=%r time=%r user_id=%r",
        department_label, date, time, user_id,
    )
    # 入力の正規化（None / 空は業務上 400 で弾く想定だが、ここでも安全のため）
    department_label = (department_label or "").strip()
    date = (date or "").strip()
    time = (time or "").strip()
    user_id = (user_id or "").strip()
    if not user_id:
        raise ValueError("ユーザーIDが取得できません。再ログインしてください。")
    if not department_label or not date or not time:
        raise ValueError("診療科・日付・時間は必須です。")

    # 過去日チェック（availability API と同一）
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if dt.date() < today.date():
            raise ValueError("過去の日付は予約できません。別の日をお選びください。")
    except ValueError as e:
        if "過去の日付" in str(e):
            raise
        pass  # 日付パース失敗は下の is_reservable で弾かれる
    except TypeError:
        pass
    if _is_japanese_holiday(date):
        raise ValueError("祝日のため予約できません。別の日をお選びください。")

    # 今日の過去時刻チェック（フロントの currentTimeStr 更新遅れがあっても二重で防ぐ）
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        now_str = datetime.now().strftime("%H:%M")
        if dt.date() == today.date() and time <= now_str:
            raise ValueError("この時刻はすでに過ぎています。別の時間をお選びください。")
    except ValueError as e:
        if "すでに過ぎています" in str(e):
            raise
        pass  # strptime 失敗等
    except TypeError:
        pass

    logger.info("create_reservation passed validation: past/holiday/today-time checks ok")

    # 空き判定は is_reservable と同一（_get_available_doctors を使用）。医師未登録時はデモ枠で許可
    use_demo = os.environ.get("USE_DEMO_SLOTS", "1").strip() != "0"
    try:
        available = _get_available_doctors(department_label, date, time)
    except Exception as e:
        logger.exception("create_reservation _get_available_doctors failed: %s", e)
        raise
    doctor = assign_doctor(available)
    logger.info(
        "create_reservation doctors: available_count=%s use_demo=%s doctor=%s",
        len(available), use_demo, (doctor.get("id"), doctor.get("name")) if isinstance(doctor, dict) else doctor,
    )
    if not doctor and use_demo and _demo_reservable(date, time):
        doctor = {"id": "demo", "name": "（自動割当）"}
    if not doctor:
        raise ValueError("この時間は現在予約できません。別の時間をお選びください。")

    # 担当医の id/name を安全に取得（型不整合・キー欠損で 500 にしない）
    doctor_dict = doctor if isinstance(doctor, dict) else {}
    doctor_id = doctor_dict.get("id")
    doctor_name = doctor_dict.get("name")
    if doctor_id is None:
        doctor_id = "demo"
    if doctor_name is None:
        doctor_name = "（自動割当）"
    doctor_id = str(doctor_id).strip() or "demo"
    doctor_name = str(doctor_name).strip() or "（自動割当）"

    # Firestore 保存用ペイロード（None を渡さない・文字列は str に統一。キー存在チェック済み）
    payload = {
        "date": str(date) if date is not None else "",
        "time": str(time) if time is not None else "",
        "category": "",
        "department": str(department_label) if department_label is not None else "",
        "purpose": "",
        "doctor": doctor_name,
        "doctorId": doctor_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    # 最終ガード: いずれも None にしない（Firestore が受け付けない場合がある）
    for k in list(payload.keys()):
        if payload[k] is None and k != "createdAt":
            payload[k] = ""

    path_log = f"users/{user_id}/reservations"
    logger.info("create_reservation Firestore add: path=%s payload_keys=%s", path_log, list(payload.keys()))

    if not user_id:
        raise ValueError("ユーザーIDが空のため保存できません。")

    try:
        db = _get_firestore()
    except Exception as e:
        logger.exception("create_reservation _get_firestore failed: %s", e)
        raise
    try:
        ref = db.collection("users").document(user_id).collection("reservations")
        _, doc_ref = ref.add(payload)
        doc_id = doc_ref.id if doc_ref else ""
    except Exception as e:
        logger.exception("create_reservation Firestore ref.add failed: path=%s error=%s", path_log, e)
        raise

    logger.info("create_reservation done: doc_id=%s", doc_id)
    return {
        "id": doc_id,
        "departmentId": department_label,
        "doctorId": doctor_id,
        "date": date,
        "time": time,
        "userId": user_id,
    }
