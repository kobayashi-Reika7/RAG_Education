"""
Firebase Admin 初期化・IDトークン検証
認証は Firebase に一本化するため、バックエンドは IDトークンの検証だけ行う
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

_app: Optional[firebase_admin.App] = None


def init_firebase_admin() -> firebase_admin.App:
    """
    Admin SDK を初期化（多重初期化を防止）
    優先順:
    - FIREBASE_SERVICE_ACCOUNT_JSON
    - GOOGLE_APPLICATION_CREDENTIALS（ADC）
    """
    global _app
    if _app is not None:
        return _app

    svc_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if svc_json:
        try:
            info = json.loads(svc_json)
            cred = credentials.Certificate(info)
            _app = firebase_admin.initialize_app(cred)
            return _app
        except Exception as e:
            logger.exception("Firebase Admin init (FIREBASE_SERVICE_ACCOUNT_JSON) failed: %s", e)
            raise

    # GOOGLE_APPLICATION_CREDENTIALS があれば ADC が使われる
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    try:
        _app = firebase_admin.initialize_app()
        return _app
    except Exception as e:
        logger.exception("Firebase Admin init failed: %s", e)
        if not creds_path and not svc_json:
            raise RuntimeError(
                "Firebase の認証情報が設定されていません。"
                " backend/.env に GOOGLE_APPLICATION_CREDENTIALS または FIREBASE_SERVICE_ACCOUNT_JSON を設定してください。"
            ) from e
        raise


def verify_id_token(id_token: str) -> dict:
    """
    Firebase IDトークンを検証して claims を返す
    """
    init_firebase_admin()
    return auth.verify_id_token(id_token)

