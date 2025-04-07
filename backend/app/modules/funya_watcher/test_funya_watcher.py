"""
ふにゃ見守りモードのテスト用プログラム

このモジュールを直接実行することで、ふにゃ見守りモードの動作を確認できます。
5秒間キーボードやマウスの操作がないと、「ふにゃ見守りモード」が発動します。

使い方：
python -m backend.app.modules.funya_watcher.test_funya_watcher
"""

import signal
import sys
import time
from typing import Any, Optional

from .funya_watcher import FunyaWatcher


# 終了シグナル処理
def signal_handler(sig: int, frame: Any) -> None:
    """Ctrl+C等のシグナルを受け取ったときの処理"""
    print("\n🌸 プログラムを終了します...")
    if watcher:
        watcher.stop()
    sys.exit(0)


# カスタムコールバック関数
def on_enter_funya_mode() -> None:
    """ふにゃモード開始時のコールバック"""
    print("💫 ふにゃモードが発動しました！")


def on_exit_funya_mode() -> None:
    """ふにゃモード終了時のコールバック"""
    print("✨ ふにゃモードが終了しました")


if __name__ == "__main__":
    # シグナルハンドラの設定
    signal.signal(signal.SIGINT, signal_handler)

    # タイトル表示
    print("\n" + "=" * 50)
    print("🐾 ふにゃ見守りモードテスト 🐾")
    print("=" * 50)
    print("5秒間操作がないと「ふにゃ見守りモード」が発動します")
    print("終了するには Ctrl+C を押してください")
    print("=" * 50 + "\n")

    # グローバル変数としてwatcherを保持（signal_handlerで使用するため）
    watcher: Optional[FunyaWatcher] = None

    try:
        # ふにゃ見守りモードの初期化と開始
        watcher = FunyaWatcher(
            inactivity_threshold=5,  # 5秒の無操作でふにゃモード発動
            on_enter_funya_mode=on_enter_funya_mode,
            on_exit_funya_mode=on_exit_funya_mode,
        )
        watcher.start()

        # メインスレッドはキープ
        while True:
            time.sleep(1)

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        if watcher:
            watcher.stop()
        sys.exit(1)
