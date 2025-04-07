"""
音声キャッシュモジュール

音声合成結果のキャッシュを管理する機能を提供します。
"""

import hashlib
import logging
import os
from typing import Optional

# ロガーの設定
logger = logging.getLogger(__name__)

# 合成音声キャッシュのパス
CACHED_VOICE_DIR = os.path.join("assets", "sounds", "generated")


def get_voice_cache_path(text: str, speaker_id: int = 0) -> str:
    """
    テキストと話者IDからキャッシュパスを生成

    Args:
        text: テキスト
        speaker_id: 話者ID

    Returns:
        str: キャッシュファイルのパス
    """
    # テキストからハッシュ値を生成
    text_hash = hashlib.md5(text.encode("utf-8")).hexdigest()
    filename = f"voice_{speaker_id}_{text_hash}.wav"
    return os.path.join(CACHED_VOICE_DIR, filename)


def is_voice_cached(text: str, speaker_id: int = 0) -> bool:
    """
    テキストの音声がキャッシュされているかチェック

    Args:
        text: チェックするテキスト
        speaker_id: 話者ID

    Returns:
        bool: キャッシュが存在すればTrue
    """
    cache_path = get_voice_cache_path(text, speaker_id)
    return os.path.exists(cache_path)


def ensure_cache_dir() -> None:
    """
    キャッシュディレクトリが存在することを確認し、なければ作成
    """
    os.makedirs(CACHED_VOICE_DIR, exist_ok=True)
    logger.debug(f"キャッシュディレクトリを確認: {CACHED_VOICE_DIR}")


def save_to_cache(text: str, audio_data: bytes, speaker_id: int = 0) -> Optional[str]:
    """
    音声データをキャッシュに保存

    Args:
        text: テキスト
        audio_data: 音声データ（WAVバイト）
        speaker_id: 話者ID

    Returns:
        str: 保存したキャッシュファイルのパス、失敗時はNone
    """
    try:
        ensure_cache_dir()
        cache_path = get_voice_cache_path(text, speaker_id)

        with open(cache_path, "wb") as f:
            f.write(audio_data)

        logger.debug(f"音声をキャッシュに保存: {cache_path}")
        return cache_path
    except Exception as e:
        logger.error(f"キャッシュ保存エラー: {e}")
        return None
