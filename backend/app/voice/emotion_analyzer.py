"""
セリフテキスト感情分析モジュール

テキストの内容から最適な音声パラメータを判定する機能を提供します。
"""

import logging
import re
from typing import Any, Dict, List, Tuple

# ロガー設定
logger = logging.getLogger(__name__)

# 感情カテゴリとそのデフォルトパラメータ
DEFAULT_EMOTION_PARAMS: Dict[str, Dict[str, float]] = {
    "にこにこ": {
        "pitch_scale": 0.06,
        "speed_scale": 1.05,
        "intonation_scale": 1.3,
        "volume_scale": 1.0,
    },
    "警戒・心配": {
        "pitch_scale": -0.03,
        "speed_scale": 0.95,
        "intonation_scale": 0.9,
        "volume_scale": 1.0,
    },
    "びっくり": {
        "pitch_scale": 0.12,
        "speed_scale": 1.2,
        "intonation_scale": 1.5,
        "volume_scale": 1.05,
    },
    "やさしい": {
        "pitch_scale": -0.06,
        "speed_scale": 0.9,
        "intonation_scale": 1.1,
        "volume_scale": 1.0,
    },
    "眠そう": {
        "pitch_scale": -0.09,
        "speed_scale": 0.8,
        "intonation_scale": 0.8,
        "volume_scale": 0.9,
    },
    "normal": {
        "pitch_scale": 0.0,
        "speed_scale": 1.0,
        "intonation_scale": 1.0,
        "volume_scale": 1.0,
    },
}

# 感情ルールの定義
# 各感情に対する正規表現パターンとスコア
EMOTION_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "にこにこ": [
        (r"おめでと", 1.0),
        (r"すごい[!！]", 1.0),
        (r"やりました", 0.8),
        (r"成功", 0.8),
        (r"素晴らしい", 0.9),
        (r"達成", 0.7),
        (r"レベルアップ", 1.0),
        (r"♪", 0.5),
        (r"[!！]{2,}", 0.7),  # 複数の感嘆符
    ],
    "警戒・心配": [
        (r"危険", 0.9),
        (r"気をつけて", 0.8),
        (r"注意", 0.8),
        (r"警告", 0.9),
        (r"ゾンビ.*[2-4]体", 1.0),  # 2-4体のゾンビの場合
        (r"体力が(少な|危険)", 0.9),
        (r"回復", 0.7),
        (r"\.{3}|…{1,}", 0.5),  # 三点リーダー
    ],
    "びっくり": [
        (r"[!！]{3,}", 1.0),  # 3つ以上の感嘆符
        (r"急いで|すぐに", 0.9),
        (r"緊急", 1.0),
        (r"ゾンビ.*5体以上", 1.0),  # 5体以上のゾンビの場合
        (r"ゾンビ.*接近", 0.8),
        (r"危険.*[!！]", 0.9),
        (r"逃げて", 0.9),
        (r"きゃっ[!！]", 1.0),
    ],
    "やさしい": [
        (r"ふにゃ[〜～]", 0.9),
        (r"頑張りましょう", 0.8),
        (r"お疲れ様", 0.7),
        (r"ゆっくり休んで", 0.7),
        (r"です(ね|よ)[♪]*$", 0.6),
        (r"[♪]+", 0.5),
    ],
    "眠そう": [
        (r"むにゃ", 1.0),
        (r"眠い", 1.0),
        (r"おはよう.*\.{3}", 0.8),
        (r"\.{3,}|…{2,}", 0.7),  # 多数の三点リーダー
        (r"zzz", 1.0),
        (r"ふわぁ", 0.9),
    ],
}

# 文末スタイルの判定パターン
SENTENCE_END_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "疑問": [(r"\?|？$", 0.9), (r"(ですか|かな|かしら|の\?|ましょうか)$", 0.8)],
    "命令": [
        (r"(てください|なさい|ください|すべき)[!！]*$", 0.9),
        (r"(しろ|しなさい|必要が)[!！]*$", 0.8),
    ],
    "感嘆": [(r"[!！]+$", 0.9), (r"([!！]|。)[!！]+$", 1.0)],
}

# 緊急度判定のパターン
URGENCY_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "緊急": [
        (r"すぐに|急いで|緊急|危険|[!！]{3,}", 0.9),
        (r"ゾンビ.*5体以上", 1.0),
        (r"逃げて[!！]", 1.0),
    ],
    "警告": [
        (r"注意|警告|気をつけて|ゾンビ.*[2-4]体", 0.8),
        (r"危険.*状態", 0.7),
        (r"体力.*危険", 0.8),
    ],
    "通常": [(r"ふにゃ|むにゃ|おはよう|頑張|です(ね|よ)", 0.7), (r"[♪]", 0.6)],
}


def analyze_text(text: str) -> Dict[str, Any]:
    """
    テキストの感情分析を行い、最適な音声パラメータを返します

    Args:
        text: 分析するテキスト

    Returns:
        音声パラメータ情報を含む辞書
    """
    # ステップ1: 感情分析
    emotion, _ = analyze_emotion(text)

    # ステップ2: 緊急度分析
    urgency, urgency_score = analyze_urgency(text)

    # ステップ3: 文末スタイル分析
    end_style, end_style_score = analyze_sentence_end(text)

    # ステップ4: ベースパラメータを取得
    params = dict(DEFAULT_EMOTION_PARAMS[emotion])

    # ステップ5: 緊急度によるパラメータ調整
    if urgency == "緊急":
        # 緊急時は速度とイントネーションを強調
        params["speed_scale"] += 0.1 * urgency_score
        params["intonation_scale"] += 0.2 * urgency_score
        params["volume_scale"] += 0.05 * urgency_score
    elif urgency == "警告":
        # 警告時は適度に速度を上げてピッチを少し下げる
        params["speed_scale"] += 0.05 * urgency_score
        params["pitch_scale"] -= 0.02 * urgency_score

    # ステップ6: 文末スタイルによるパラメータ調整
    if end_style == "疑問":
        # 疑問文はピッチを少し上げ、イントネーションを強める
        params["pitch_scale"] += 0.03 * end_style_score
        params["intonation_scale"] += 0.1 * end_style_score
    elif end_style == "命令":
        # 命令文は速度を上げ、イントネーションを強める
        params["speed_scale"] += 0.05 * end_style_score
        params["intonation_scale"] += 0.15 * end_style_score
    elif end_style == "感嘆":
        # 感嘆文はピッチを上げ、イントネーションを強める
        params["pitch_scale"] += 0.04 * end_style_score
        params["intonation_scale"] += 0.2 * end_style_score

    # パラメータの範囲を制限
    params["pitch_scale"] = max(-0.15, min(0.15, params["pitch_scale"]))
    params["speed_scale"] = max(0.8, min(1.1, params["speed_scale"]))
    params["intonation_scale"] = max(0.8, min(1.4, params["intonation_scale"]))
    params["volume_scale"] = max(0.9, min(1.05, params["volume_scale"]))

    # 説明文を生成
    explanation = generate_explanation(text, emotion, urgency, end_style)

    return {"emotion": emotion, "parameters": params, "explanation": explanation}


def analyze_emotion(text: str) -> Tuple[str, float]:
    """
    テキストから感情を分析して最も一致する感情とそのスコアを返します

    Args:
        text: 分析するテキスト

    Returns:
        Tuple[str, float]: (感情カテゴリ, 感情スコア)
    """
    scores = {
        "にこにこ": 0.0,
        "警戒・心配": 0.0,
        "びっくり": 0.0,
        "やさしい": 0.0,
        "眠そう": 0.0,
    }

    # 各感情パターンについてマッチングを行う
    for emotion, patterns in EMOTION_PATTERNS.items():
        for pattern, weight in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores[emotion] += weight

    # スコアが閾値を超えていない場合はnormalを返す
    score_threshold = 0.5
    max_emotion = max(scores.items(), key=lambda x: x[1])

    if max_emotion[1] < score_threshold:
        return "normal", 0.0

    return max_emotion[0], max_emotion[1]


def analyze_urgency(text: str) -> Tuple[str, float]:
    """
    テキストの緊急度を分析して最も一致する緊急度とそのスコアを返します

    Args:
        text: 分析するテキスト

    Returns:
        Tuple[str, float]: (緊急度カテゴリ, 緊急度スコア)
    """
    scores = {"緊急": 0.0, "警告": 0.0, "通常": 0.0}

    # 各緊急度パターンについてマッチングを行う
    for urgency, patterns in URGENCY_PATTERNS.items():
        for pattern, weight in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores[urgency] += weight

    # 最大スコアの緊急度を返す
    max_urgency = max(scores.items(), key=lambda x: x[1])

    if max_urgency[1] < 0.1:
        return "通常", 0.0

    return max_urgency[0], max_urgency[1]


def analyze_sentence_end(text: str) -> Tuple[str, float]:
    """
    文末スタイルを分析します

    Args:
        text: 分析するテキスト

    Returns:
        Tuple[str, float]: (文末スタイル, スタイルスコア)
    """
    scores = {"疑問": 0.0, "命令": 0.0, "感嘆": 0.0}

    # 各文末スタイルパターンについてマッチングを行う
    for style, patterns in SENTENCE_END_PATTERNS.items():
        for pattern, weight in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                scores[style] += weight

    # 最大スコアの文末スタイルを返す
    max_style = max(scores.items(), key=lambda x: x[1])

    if max_style[1] < 0.1:
        return "", 0.0

    return max_style[0], max_style[1]


def generate_explanation(text: str, emotion: str, urgency: str, end_style: str) -> str:
    """
    感情分析結果の説明文を生成します

    Args:
        text: 分析したテキスト
        emotion: 検出された感情
        urgency: 検出された緊急度
        end_style: 検出された文末スタイル

    Returns:
        str: 説明文
    """
    # 感情の日本語表現
    emotion_jp = {
        "にこにこ": "嬉しそう",
        "警戒・心配": "心配そう",
        "びっくり": "驚いた様子",
        "やさしい": "優しい口調",
        "眠そう": "眠そう",
        "normal": "通常",
    }.get(emotion, "通常")

    # 緊急度の日本語表現
    urgency_jp = {
        "緊急": "とても緊急",
        "警告": "警戒が必要",
        "通常": "通常の会話",
    }.get(urgency, "通常の会話")

    # 文末スタイルの日本語表現
    end_style_jp = {
        "疑問": "疑問形",
        "命令": "命令形",
        "感嘆": "感嘆形",
        "": "通常",
    }.get(end_style, "通常")

    # 説明文の生成
    explanation = f"{emotion_jp}な感情で{urgency_jp}"
    if end_style:
        explanation += f"、{end_style_jp}の文末"

    return explanation


def test_analyze_text(text: str) -> None:
    """
    テキスト感情分析のテスト関数

    Args:
        text: 分析するテキスト
    """
    result = analyze_text(text)
    print(f"入力テキスト: {text}")
    print(f"感情: {result['emotion']}")
    print(f"説明: {result['explanation']}")
    print(f"パラメータ: {result['parameters']}")
    print("---")


if __name__ == "__main__":
    # テスト実行
    test_texts = [
        "ゾンビが5体以上接近しています！すぐに逃げてください！",
        "むにゃ...おはようございます...まだ眠いです...",
        "レベルアップおめでとうございます！すごいですね！",
        "体力が危険な状態です...回復アイテムを使用してください",
        "ふにゃ〜、今日もお仕事頑張りましょうね♪",
    ]

    for text in test_texts:
        test_analyze_text(text)
