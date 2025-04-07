"""
ふにゃ見守りモード状態管理サービス

ふにゃ見守りモードの状態やインスタンスを管理するサービス
"""

import logging
from typing import Dict, Optional, Union

from ..modules.funya_watcher import FunyaWatcher

# ロガーの設定
logger = logging.getLogger(__name__)


class FunyaStateService:
    """ふにゃ見守りモード状態管理サービス"""

    _instance: Optional["FunyaStateService"] = None

    def __new__(cls) -> "FunyaStateService":
        """シングルトンパターンの実装"""
        if cls._instance is None:
            cls._instance = super(FunyaStateService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self) -> None:
        """初期化"""
        # ふにゃ見守りモードのインスタンス
        self._watcher: Optional[FunyaWatcher] = None
        logger.info("✅ ふにゃ状態サービスを初期化しました")

    def get_watcher(self) -> Optional[FunyaWatcher]:
        """
        ふにゃ見守りモードのインスタンスを取得

        Returns:
            Optional[FunyaWatcher]: ふにゃ見守りモードインスタンス
        """
        return self._watcher

    def set_watcher(self, watcher: FunyaWatcher) -> None:
        """
        ふにゃ見守りモードのインスタンスを設定

        Args:
            watcher: ふにゃ見守りモードインスタンス
        """
        self._watcher = watcher
        logger.info("✅ ふにゃ見守りモードインスタンスを設定しました")

    def get_status(self) -> Dict[str, Union[bool, float, int]]:
        """
        ふにゃ見守りモードの状態を取得

        Returns:
            Dict[str, Union[bool, float, int]]: 状態情報を含む辞書
        """
        if not self._watcher:
            return {
                "watching": False,
                "initialized": False,
                "last_active_seconds": 0.0,
            }

        # FunyaWatcherのget_statusメソッドを使用
        status = self._watcher.get_status()

        # 初期化状態を追加
        status["initialized"] = self._watcher.is_watching

        return status


# グローバルなアクセス用の関数
def get_funya_state_service() -> FunyaStateService:
    """
    ふにゃ状態サービスのインスタンスを取得

    Returns:
        FunyaStateService: サービスインスタンス
    """
    return FunyaStateService()
