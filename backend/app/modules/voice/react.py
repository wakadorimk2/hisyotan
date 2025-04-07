"""
リアクション音声モジュール

ゾンビ検出など、特定のイベントに対する音声反応を管理します。
"""

import logging
import random
from typing import Dict, List

# 自モジュールからのインポート
from .player import is_message_duplicate
from .presets import play_preset_voice

# ロガーの設定
logger = logging.getLogger(__name__)

# ゾンビ検出反応のテンプレート
ZOMBIE_REACTION_TEMPLATES: Dict[str, List[str]] = {
    "confirm": [
        "ゾンビを{count}体確認しました",
        "ゾンビが{count}体います",
        "注意してください、ゾンビ{count}体です",
    ],
    "warn": [
        "危険です！ゾンビが{count}体接近中です",
        "ゾンビ{count}体が近づいています！",
        "警告！ゾンビ{count}体、距離{distance:.1f}メートルです",
    ],
    "panic": [
        "きゃっ！ゾンビがすぐそこに！",
        "危険です！ゾンビ{count}体が目の前です！",
        "やばいです！ゾンビ群が接近しています！",
    ],
    "relief": [
        "大丈夫そうです、ゾンビは見当たりません",
        "周囲にゾンビはいないようです",
        "安全を確認しました",
    ],
}

# スクリーム音声ファイル
SCREAM_SOUNDS = [
    "scream_short_1.wav",
    "surprise_1.wav",
    "gasp_1.wav",
]


def react_to_zombie(
    count: int,
    distance: float = 0.0,
    reaction_type: str = "confirm",
    resnet_result: bool = False,
    resnet_prob: float = 0.0,
    force: bool = False,
) -> dict:
    """
    ゾンビ検出に対する反応を再生する

    Args:
        count: ゾンビの数
        distance: 距離
        reaction_type: 反応タイプ
        resnet_result: ResNetの結果
        resnet_prob: ResNetの確信度
        force: 強制再生フラグ（重複チェックを無視する）

    Returns:
        dict: 反応データ（メッセージなど）
    """
    try:
        logger.info(f"ゾンビ反応: {count}体, {distance}m, タイプ={reaction_type}")

        # 反応データを格納する辞書
        reaction_data = {
            "count": count,
            "distance": distance,
            "type": reaction_type,
            "message": "",
        }

        # 重複抑制チェック（forceがTrueの場合はスキップ）
        if not force:
            message_key = f"zombie_{reaction_type}"
            message_content = f"{count}_{distance:.1f}"
            if is_message_duplicate(message_key, message_content, 5.0):
                logger.debug("ゾンビ反応を抑制: 短時間に同じ反応がありました")
                reaction_data["suppressed"] = True
                return reaction_data

        # パニック時は効果音を再生
        if reaction_type == "panic" and count > 0:
            scream_file = random.choice(SCREAM_SOUNDS)
            play_preset_voice(scream_file)
            logger.debug(f"パニック効果音を再生: {scream_file}")
            reaction_data["sound_effect"] = scream_file

        # 反応メッセージを選択
        if reaction_type in ZOMBIE_REACTION_TEMPLATES and count > 0:
            templates = ZOMBIE_REACTION_TEMPLATES[reaction_type]
            message = random.choice(templates).format(count=count, distance=distance)

            # 音声合成の実装（未実装）
            # ここで実際の音声合成を行う代わりに、とりあえずログ出力
            logger.info(f"ゾンビ反応メッセージ: {message}")
            reaction_data["message"] = message

        elif reaction_type == "relief" or count == 0:
            # ゾンビがいない場合の安心メッセージ
            if (
                random.random() < 0.3 or force
            ):  # 30%の確率でのみ反応（forceがTrueなら必ず）
                templates = ZOMBIE_REACTION_TEMPLATES["relief"]
                message = random.choice(templates)

                # 音声合成の実装（未実装）
                logger.info(f"安全確認メッセージ: {message}")
                reaction_data["message"] = message

        return reaction_data

    except Exception as e:
        logger.error(f"ゾンビ反応エラー: {e}")
        return {"error": str(e)}


def legacy_react_to_zombie(count: int, distance: float = 0.0) -> dict:
    """
    レガシーなゾンビ検出に対する反応を再生する

    Args:
        count: ゾンビの数
        distance: 距離

    Returns:
        dict: 反応データ
    """
    # 適切な反応タイプを決定
    if count > 3:
        reaction_type = "panic"
    elif count > 0:
        reaction_type = "warn" if distance < 5.0 else "confirm"
    else:
        reaction_type = "relief"

    # 新しい関数に転送
    return react_to_zombie(count, distance, reaction_type)
