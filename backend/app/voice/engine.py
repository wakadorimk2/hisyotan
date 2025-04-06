"""
音声合成と再生を管理するモジュール

VOICEVOXを使用した音声合成と、生成された音声の再生を制御
"""

import concurrent.futures
import hashlib
import json
import logging
import os
import threading
import time
from typing import Any, Dict, Mapping, Optional, Tuple, Union

import requests

# 感情分析モジュールをインポート
from .emotion_analyzer import analyze_text

# ロガーの設定
logger = logging.getLogger(__name__)

# 音声再生の最終時刻を記録する変数
last_voice_time = 0
# 音声再生用の排他ロック
voice_lock = threading.Lock()
# 最後に再生したメッセージのキャッシュ
last_message_cache: Dict[str, Tuple[str, float]] = {}
# 音声再生中フラグ
audio_playing = False
# 合成音声キャッシュのパス
CACHED_VOICE_DIR = os.path.join("assets", "sounds", "generated")
# プリセット音声のパス
PRESET_VOICE_DIR = os.path.join("assets", "sounds", "presets")
# ThreadPoolExecutor for background tasks
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)


def reset_audio_playback() -> None:
    """
    音声再生の終了フラグをリセットする
    """
    global audio_playing
    with voice_lock:
        if audio_playing:
            # audioフラグをリセット
            audio_playing = False
            logger.info("音声再生の終了をリセットしました")


# メッセージキャッシュをチェックして短時間での重複メッセージを防ぐ
def is_message_duplicate(
    message_type: str, message: str, cooldown: float = 3.0
) -> bool:
    """
    短時間内に同じメッセージが再生されたかどうかをチェック

    Args:
        message_type: メッセージのタイプ
        message: メッセージ内容
        cooldown: クールダウン時間（秒）

    Returns:
        bool: 重複メッセージの場合True
    """
    current_time = time.time()

    if message_type in last_message_cache:
        cache_entry = last_message_cache[message_type]
        last_message = cache_entry[0]
        last_time = cache_entry[1]

        # 同じメッセージかつ、指定されたクールダウン時間内の場合
        if last_message == message and current_time - last_time < cooldown:
            logger.debug(f"重複メッセージを検出: '{message_type}' - '{message}'")
            return True

    # 新しいメッセージをキャッシュに記録
    last_message_cache[message_type] = (message, current_time)
    return False


# テキストの感情を分析して最適なパラメータで音声合成する関数
def speak_with_emotion(
    text: str, speaker_id: int = 0, force: bool = False, message_type: str = "default"
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    テキストの感情を自動分析して最適なパラメータで音声合成する

    Args:
        text: 発話するテキスト
        speaker_id: 話者ID
        force: クールダウンを無視して強制的に再生
        message_type: メッセージタイプ（重複チェック用）

    Returns:
        Tuple[str, Dict]: WAVファイルのパス（成功時）と分析結果の辞書
    """
    # テキストから感情を分析
    analysis_result = analyze_text(text)

    # 分析結果からパラメータを取得
    params = analysis_result["parameters"]
    emotion = analysis_result["emotion"]

    logger.info(f"感情分析結果: {emotion} - {analysis_result['explanation']}")
    logger.debug(f"音声パラメータ: {params}")

    # パラメータを適用して音声合成
    wav_path = safe_play_voice(
        text,
        speaker_id,
        speed=params["speed_scale"],
        pitch=params["pitch_scale"],
        intonation=params["intonation_scale"],
        volume=params["volume_scale"],
        force=force,
        message_type=message_type,
    )

    return wav_path, analysis_result


# 安全に音声を再生する（VOICEVOXが利用可能なら）
def safe_play_voice(
    text: str,
    speaker_id: int = 0,
    speed: float = 1.0,
    pitch: float = 0.0,
    intonation: float = 1.0,
    volume: float = 1.0,
    force: bool = False,
    message_type: str = "default",
) -> Optional[str]:
    """
    安全に音声を再生する（VOICEVOXが利用可能なら）

    Args:
        text: 再生するテキスト
        speaker_id: 話者ID
        speed: 話速（1.0が標準）
        pitch: ピッチ（0.0が標準）
        intonation: イントネーション（1.0が標準）
        volume: 音量（1.0が標準）
        force: 強制再生フラグ
        message_type: メッセージタイプ（重複チェック用）

    Returns:
        wav_path: 生成されたWAVファイルのパス、エラー時はNone
    """
    # 重複チェック
    if not force and is_message_duplicate(message_type, text, 3.0):
        logger.info(f"重複メッセージ抑制: {message_type} - {text}")
        return None

    # VOICEVOXとの通信
    try:
        return speak(text, speaker_id, speed, pitch, intonation, volume, force)
    except Exception as e:
        logger.error(f"音声再生エラー: {e}")
        return None


# 新しい関数: 音声データを直接返す（再生なし）
async def synthesize_direct(
    text: str,
    speaker_id: int = 0,
    emotion: str = "normal",
    speed: Optional[float] = None,
    pitch: Optional[float] = None,
    intonation: Optional[float] = None,
    volume: Optional[float] = None,
) -> Optional[bytes]:
    """
    VOICEVOXを使用してテキストを音声に変換し、音声データを直接返す（再生なし）

    Args:
        text: 合成するテキスト
        speaker_id: 話者ID
        emotion: 感情タイプ（normal, happy, surprised, serious等）
        speed: 話速（1.0が標準）- オプション
        pitch: ピッチ（0.0が標準）- オプション
        intonation: イントネーション（1.0が標準）- オプション
        volume: 音量（1.0が標準）- オプション

    Returns:
        bytes: WAV音声データ（成功時）、失敗時はNone
    """
    from ..config import get_settings

    try:
        # 設定を取得（VOICEVOX_HOSTを直接使用するため）
        settings = get_settings()

        logger.info(
            f"音声合成開始 (direct): text={text[:20]}..., "
            f"speaker={speaker_id}, emotion={emotion}"
        )
        logger.debug(
            f"音声パラメータ: speed={speed}, pitch={pitch}, intonation={intonation}"
        )

        # 音声合成クエリの作成リクエスト
        logger.debug(f"VOICEVOX APIリクエスト: {settings.VOICEVOX_HOST}/audio_query")
        query_response = requests.post(
            f"{settings.VOICEVOX_HOST}/audio_query",
            params={"text": text, "speaker": speaker_id},
        )

        if query_response.status_code != 200:
            logger.error(
                f"音声合成クエリの作成に失敗: "
                f"ステータスコード={query_response.status_code}"
            )
            logger.error(f"レスポンス内容: {query_response.text}")
            return None

        voice_params = query_response.json()

        # パラメータを設定
        # Noneでないものだけ上書きする（VOICEVOX仕様対応）
        if speed is not None:
            voice_params["speedScale"] = speed
        if pitch is not None:
            voice_params["pitchScale"] = pitch
        if intonation is not None:
            voice_params["intonationScale"] = intonation
        if volume is not None:
            voice_params["volumeScale"] = volume

        # 音声合成の実行
        logger.debug(f"VOICEVOX 音声合成実行: {settings.VOICEVOX_HOST}/synthesis")
        synthesis_response = requests.post(
            f"{settings.VOICEVOX_HOST}/synthesis",
            headers={"Content-Type": "application/json"},
            params={"speaker": speaker_id},
            data=json.dumps(voice_params),
        )

        if synthesis_response.status_code != 200:
            logger.error(
                f"音声合成に失敗: ステータスコード={synthesis_response.status_code}"
            )
            logger.error(f"レスポンス内容: {synthesis_response.text}")
            return None

        # 音声データを直接返す
        audio_data = synthesis_response.content
        logger.debug(f"音声合成完了: 音声データサイズ {len(audio_data)} バイト")

        return audio_data

    except Exception as e:
        import traceback

        logger.error(f"音声合成エラー (direct): {e}")
        logger.error(f"詳細なエラー情報: {traceback.format_exc()}")
        return None


def play_voice(wav_path: str) -> None:
    """
    音声ファイルを再生する

    Args:
        wav_path: WAVファイルのパス
    """
    global audio_playing
    with voice_lock:
        audio_playing = True
        try:
            # 音声再生の実装
            pass
        finally:
            audio_playing = False


def play_voice_async(wav_path: str) -> Optional[concurrent.futures.Future[None]]:
    """
    音声ファイルを非同期で再生する

    Args:
        wav_path: WAVファイルのパス

    Returns:
        Future: 非同期タスクのFutureオブジェクト
    """
    try:
        return executor.submit(play_voice, wav_path)
    except Exception as e:
        logger.error(f"音声再生エラー: {e}")
        return None


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


def play_preset_voice(filename: str) -> None:
    """
    プリセット音声を再生する

    Args:
        filename: プリセット音声ファイル名
    """
    global audio_playing
    with voice_lock:
        audio_playing = True
        try:
            # プリセット音声再生の実装
            pass
        finally:
            audio_playing = False


def speak(
    text: str,
    speaker_id: int = 0,
    speed: float = 1.0,
    pitch: float = 0.0,
    intonation: float = 1.0,
    volume: float = 1.0,
    force: bool = False,
) -> Optional[str]:
    """
    VOICEVOXを使用してテキストを音声に変換し、再生する

    Args:
        text: 合成するテキスト
        speaker_id: 話者ID
        speed: 話速（1.0が標準）
        pitch: ピッチ（0.0が標準）
        intonation: イントネーション（1.0が標準）
        volume: 音量（1.0が標準）
        force: 強制再生フラグ

    Returns:
        str: 生成されたWAVファイルのパス、エラー時はNone
    """
    from ..config import get_settings

    try:
        # 設定を取得
        settings = get_settings()

        # 音声キャッシュをチェック
        cache_path = get_voice_cache_path(text, speaker_id)
        if os.path.exists(cache_path):
            logger.info(f"キャッシュから音声を再生: {cache_path}")
            play_voice_async(cache_path)
            return cache_path

        # VOICEVOXとの通信
        params: Mapping[str, Union[str, int, float]] = {
            "text": text,
            "speaker": speaker_id,
            "speed": speed,
            "pitch": pitch,
            "intonation": intonation,
            "volume": volume,
        }

        response = requests.post(
            f"{settings.VOICEVOX_HOST}/audio_query",
            params=params,
            timeout=10,
        )
        response.raise_for_status()

        # 音声合成
        audio_query = response.json()
        response = requests.post(
            f"{settings.VOICEVOX_HOST}/synthesis",
            headers={"Content-Type": "application/json"},
            params={"speaker": speaker_id},
            data=json.dumps(audio_query),
            timeout=10,
        )
        response.raise_for_status()

        # WAVファイルを保存
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "wb") as f:
            f.write(response.content)

        # 非同期で再生
        play_voice_async(cache_path)
        return cache_path

    except Exception as e:
        logger.error(f"音声合成エラー: {e}")
        return None


def speak_with_preset(
    text: str,
    preset_name: str,
    speaker_id: int = 0,
    speed: float = 1.0,
    pitch: float = 0.0,
    intonation: float = 1.0,
    volume: float = 1.0,
    delay: float = 0.5,
) -> None:
    """
    プリセットを使用して音声を合成・再生する

    Args:
        text: 発話するテキスト
        preset_name: プリセット名
        speaker_id: 話者ID
        speed: 話速
        pitch: ピッチ
        intonation: イントネーション
        volume: 音量
        delay: 遅延時間（秒）
    """
    # 実装
    pass


def safe_speak_with_preset(
    text: str,
    preset_name: str,
    speaker_id: Optional[int] = None,
    emotion: str = "normal",
    force: bool = False,
) -> None:
    """
    プリセットを使用して安全に音声を合成・再生する

    Args:
        text: 発話するテキスト
        preset_name: プリセット名
        speaker_id: 話者ID（オプション）
        emotion: 感情タイプ
        force: 強制再生フラグ
    """
    # 実装
    pass


# ゾンビ検出に対するリアクションを生成
def react_to_zombie(
    count: int,
    distance: float = 0.0,
    reaction_type: str = "confirm",
    resnet_result: bool = False,
    resnet_prob: float = 0.0,
) -> None:
    """
    ゾンビ検出に対する反応を再生する

    Args:
        count: ゾンビの数
        distance: 距離
        reaction_type: 反応タイプ
        resnet_result: ResNetの結果
        resnet_prob: ResNetの確信度
    """
    # 実装
    pass


# 旧バージョンとの互換性のために残す
def legacy_react_to_zombie(count: int, distance: float = 0.0) -> None:
    """
    レガシーなゾンビ検出に対する反応を再生する

    Args:
        count: ゾンビの数
        distance: 距離
    """
    # 実装
    pass
