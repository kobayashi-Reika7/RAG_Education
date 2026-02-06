"""
Firebase のユーザーデータを削除するスクリプト。
- Firestore: users コレクション（各 users/{uid} と users/{uid}/reservations）を削除
- Authentication: 全ユーザーを削除（オプション）

実行: Day5/backend で FIREBASE_SERVICE_ACCOUNT_JSON を設定したうえで
  python -m scripts.delete_user_data
  python -m scripts.delete_user_data --auth   # Auth ユーザーも削除
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from dotenv import load_dotenv
    load_dotenv(backend_dir / ".env")
except ImportError:
    pass

from firebase_admin import auth, firestore
from firebase_admin_client import init_firebase_admin


def delete_collection(coll_ref, batch_size: int = 100) -> int:
    """コレクション内のドキュメントを再帰的に削除。削除した件数を返す。"""
    deleted = 0
    docs = coll_ref.limit(batch_size).stream()
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    if deleted >= batch_size:
        deleted += delete_collection(coll_ref, batch_size)
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Firebase ユーザーデータ削除")
    parser.add_argument("--auth", action="store_true", help="Authentication のユーザーも削除する")
    args = parser.parse_args()

    init_firebase_admin()
    db = firestore.client()
    users_ref = db.collection("users")

    # Firestore: users とそのサブコレクション reservations を削除
    user_count = 0
    for user_doc in users_ref.stream():
        uid = user_doc.id
        reservations_ref = users_ref.document(uid).collection("reservations")
        res_deleted = delete_collection(reservations_ref)
        user_doc.reference.delete()
        user_count += 1
        print(f"  users/{uid} と reservations {res_deleted} 件を削除しました")

    print(f"Firestore: users ドキュメント {user_count} 件を削除しました。")

    # オプション: Authentication ユーザーを削除
    if args.auth:
        page = auth.list_users()
        auth_count = 0
        while page:
            for user in page.users:
                auth.delete_user(user.uid)
                auth_count += 1
                print(f"  Auth ユーザー削除: {user.uid} ({user.email})")
            page = page.get_next_page() if page.has_next_page else None
        print(f"Authentication: {auth_count} ユーザーを削除しました。")
    else:
        print("Authentication は削除していません。--auth を付けると Auth ユーザーも削除します。")


if __name__ == "__main__":
    main()
