"""
基本モデル定義モジュール

主にFastAPIで使用するPydanticモデル定義を提供
"""

from typing import Any, Dict, Optional

from pydantic import BaseModel


class MessageModel(BaseModel):
    """
    ユーザーメッセージモデル
    """

    text: str
    emotion: Optional[str] = "normal"


class HealthTestModel(BaseModel):
    """
    健康テスト用モデル
    """

    value: int


class EventModel(BaseModel):
    """
    ゲームイベントモデル
    """

    type: str
    data: Optional[Dict[str, Any]] = None


class BaseEvent:
    """
    イベントの基底クラス
    すべてのイベントはこのクラスを継承する
    """

    def __init__(self) -> None:
        pass
