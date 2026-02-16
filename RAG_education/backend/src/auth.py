"""Firebase Authentication ミドルウェア"""
from fastapi import Depends, HTTPException, Request
from firebase_admin import auth

from src.firebase_app import init_firebase

init_firebase()


def get_current_uid(request: Request) -> str:
    """Authorization ヘッダーから Firebase ID Token を検証し uid を返す。"""
    header = request.headers.get("Authorization", "")

    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="認証トークンがありません")

    token = header[7:]

    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="無効な認証トークンです")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="認証トークンが期限切れです")
    except Exception:
        raise HTTPException(status_code=401, detail="認証に失敗しました")


def optional_uid(request: Request) -> str | None:
    """Token があればuid を返す。なければ None（ログインなしでも動作する API 用）。"""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:]
    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception:
        return None
