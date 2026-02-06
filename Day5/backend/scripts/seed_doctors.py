"""
Firestore に doctors コレクションのシードデータを投入するスクリプト。
実行: Day5/backend で FIREBASE_SERVICE_ACCOUNT_JSON を設定したうえで
  .\venv\Scripts\python -m scripts.seed_doctors
環境変数が未設定の場合は backend/.env を読む（python-dotenv）。.env に
  FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
を1行で書く（改行は \\n に置換、または minify した JSON）。
"""
from __future__ import annotations

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# .env を読む（任意）
try:
    from dotenv import load_dotenv
    load_dotenv(backend_dir / ".env")
except ImportError:
    pass

from firebase_admin import firestore
from firebase_admin_client import init_firebase_admin
from scripts.seed_doctors_data import DOCTORS_SEED


def main():
    init_firebase_admin()
    db = firestore.client()

    for doc in DOCTORS_SEED:
        doc_id = doc["id"]
        data = {
            "name": doc["name"],
            "department": doc["department"],
            "schedules": doc["schedules"],
        }
        db.collection("doctors").document(doc_id).set(data)
        print(f"  wrote doctors/{doc_id} ({doc['name']} / {doc['department']})")

    print(f"Done. {len(DOCTORS_SEED)} doctors written to Firestore.")


if __name__ == "__main__":
    main()
