"""Amazon Cognito JWT 検証ミドルウェア"""
import logging
import os

import requests
from fastapi import HTTPException, Request
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")

_JWKS_URL = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/"
    f"{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
)
_ISSUER = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
)

_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    """Cognito の JWKS を取得してキャッシュする。"""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        resp = requests.get(_JWKS_URL, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache
    except Exception as e:
        logger.error("JWKS 取得に失敗: %s", e)
        raise HTTPException(status_code=500, detail="認証サーバーへの接続に失敗しました")


def _verify_token(token: str) -> dict:
    """Cognito ID Token を検証し、クレームを返す。"""
    jwks = _get_jwks()

    try:
        headers = jwt.get_unverified_headers(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="無効な認証トークンです")

    kid = headers.get("kid")
    key_data = None
    for k in jwks.get("keys", []):
        if k["kid"] == kid:
            key_data = k
            break

    if key_data is None:
        raise HTTPException(status_code=401, detail="無効な認証トークンです")

    try:
        claims = jwt.decode(
            token,
            key_data,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,
            issuer=_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="認証トークンが期限切れです")
    except JWTError:
        raise HTTPException(status_code=401, detail="無効な認証トークンです")

    if claims.get("token_use") != "id":
        raise HTTPException(status_code=401, detail="無効なトークン種別です")

    return claims


def get_current_uid(request: Request) -> str:
    """Authorization ヘッダーから Cognito ID Token を検証し sub を返す。"""
    header = request.headers.get("Authorization", "")

    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="認証トークンがありません")

    token = header[7:]
    claims = _verify_token(token)
    return claims["sub"]


def optional_uid(request: Request) -> str | None:
    """Token があれば sub を返す。なければ None（ログインなしでも動作する API 用）。"""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:]
    try:
        claims = _verify_token(token)
        return claims["sub"]
    except Exception:
        return None
