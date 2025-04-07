"""
ふにゃ見守りモードルーター

ふにゃ見守りモードの状態取得APIを提供
"""

import logging
from typing import Dict, Union

from fastapi import APIRouter, HTTPException

from ..services.funya_state import get_funya_state_service

# ロガーの設定
logger = logging.getLogger(__name__)

# ルーターの作成
router = APIRouter(
    prefix="/api/funya",
    tags=["funya"],
    responses={404: {"description": "見つかりません"}},
)


@router.get("/status")
async def get_funya_status() -> Dict[str, Union[bool, float]]:
    """
    ふにゃ見守りモードの状態を取得するエンドポイント

    Returns:
        Dict: ふにゃモードが発動中かどうかと最終アクティビティからの経過時間（秒）
    """
    try:
        # ふにゃ状態サービスから情報を取得
        funya_service = get_funya_state_service()
        status = funya_service.get_status()

        # フロントエンド用に必要な情報だけを返す
        return {
            "watching": status["watching"],
            "last_active_seconds": status["last_active_seconds"],
        }
    except Exception as e:
        logger.error(f"ふにゃ状態取得エラー: {e}")
        raise HTTPException(
            status_code=500, detail=f"ふにゃモード状態の取得に失敗しました: {str(e)}"
        )
