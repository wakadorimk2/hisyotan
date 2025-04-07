#!/usr/bin/env python
"""
音声合成モジュールの動作確認テスト

リファクタリング後の音声合成・感情分析ロジックが正しく動作するかを検証します。
"""

import logging
import os
import sys

# ロギングの設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)

# 必要に応じてパスを追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# モジュールのインポート
from app.modules.emotion.analyzer import analyze_text
from app.modules.voice import speak_with_emotion


def test_analyze_text():
    """テキスト感情分析のテスト"""
    print("\n--- テキスト感情分析テスト ---")
    test_texts = [
        "こんにちは、調子はどうですか？",
        "危険です！ゾンビが5体接近しています！",
        "お疲れさまです、ゆっくり休んでくださいね",
        "素晴らしい成果ですね！おめでとうございます！",
        "むにゃむにゃ...zzz...",
    ]

    for text in test_texts:
        result = analyze_text(text)
        print(f"\nテキスト: {text}")
        print(f"推定感情: {result['emotion']}")
        print(f"説明: {result['explanation']}")
        print(f"パラメータ: {result['parameters']}")


def test_speak_with_emotion():
    """speak_with_emotionのテスト"""
    print("\n--- 音声合成テスト ---")
    test_texts = [
        "こんにちは、私はヒショたんです。",
        "危険です！ゾンビが接近しています！",
        "おつかれさま、ゆっくり休んでね♪",
    ]

    for text in test_texts:
        print(f"\n「{text}」を音声合成します...")
        wav_path, analysis = speak_with_emotion(text, force=True)

        if wav_path:
            print(f"✅ 音声ファイル生成成功: {wav_path}")
            print(f"感情: {analysis['emotion']}")
            print(f"説明: {analysis['explanation']}")
        else:
            print("❌ 音声ファイル生成失敗")


if __name__ == "__main__":
    print("=== 音声合成モジュール動作確認テスト ===")

    # 各テストの実行
    test_analyze_text()
    test_speak_with_emotion()

    print("\n=== テスト完了 ===")
