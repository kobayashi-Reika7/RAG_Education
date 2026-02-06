"""
Pydantic モデル（ユーザー・予約）
認証は Firebase に一本化するため、バックエンドは ID トークン検証後のユーザー情報のみ扱う
"""
from pydantic import BaseModel
from typing import Optional


class UserResponse(BaseModel):
    """ユーザー情報レスポンス（Firebase uid ベース）"""
    uid: str
    email: str

    class Config:
        from_attributes = True


class SyncUserBody(BaseModel):
    """フロントからユーザー同期するボディ（任意）"""
    uid: str
    email: str


class SlotItem(BaseModel):
    """空き枠1件（フロントは表示のみ、判定はバックエンド）"""
    time: str
    reservable: bool


class AvailabilityForDateResponse(BaseModel):
    """1日分の空き状況（祝日・過去日・理由をバックエンドで判定、フロントは表示のみ）"""
    date: str
    is_holiday: bool
    reservable: bool
    reason: Optional[str] = None  # "holiday" | "past" | "closed" | null
    slots: list[SlotItem]


class CreateReservationBody(BaseModel):
    """予約作成（診療科・日・時間のみ。担当医はバックエンドで自動割当）"""
    department: str
    date: str
    time: str


class ReservationCreated(BaseModel):
    """予約作成レスポンス（UIには doctorId を出さない）"""
    id: str
    date: str
    time: str
    department: str
