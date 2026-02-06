"""
ユーザーデータの保持（メモリ上の DB）
認証は Firebase に一本化するため、バックエンドは uid / email のみ記録する
"""
from typing import Dict, List, Optional

# users: uid -> { uid, email }
users_db: Dict[str, dict] = {}


def upsert_user(uid: str, email: str) -> dict:
    """ユーザーを作成/更新する（uid 単位）"""
    key = (uid or "").strip()
    if not key:
        raise ValueError("uid is required")
    payload = {"uid": key, "email": (email or "").strip().lower()}
    users_db[key] = payload
    return payload


def get_user(uid: str) -> Optional[dict]:
    """uid でユーザーを取得"""
    key = (uid or "").strip()
    return users_db.get(key)


def get_all_users() -> List[dict]:
    """全ユーザー一覧（確認用）"""
    return list(users_db.values())
