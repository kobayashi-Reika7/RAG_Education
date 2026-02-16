"""Firebase Admin SDK 初期化（ローカル / Lambda 両対応）"""
import json
import os

import firebase_admin
from firebase_admin import credentials, firestore

_app = None
_db = None


def init_firebase():
    """Firebase Admin SDK を初期化する（冪等）。"""
    global _app
    if _app is not None:
        return _app

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    sa_json = os.getenv("FIREBASE_SA_JSON", "")
    project_id = os.getenv("FIREBASE_PROJECT_ID")

    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
    elif sa_json:
        info = json.loads(sa_json)
        cred = credentials.Certificate(info)
        _app = firebase_admin.initialize_app(cred)
    elif project_id:
        _app = firebase_admin.initialize_app(options={"projectId": project_id})
    else:
        _app = firebase_admin.initialize_app()

    return _app


def get_firestore():
    """Firestore クライアントを返す。"""
    global _db
    if _db is None:
        init_firebase()
        _db = firestore.client()
    return _db
