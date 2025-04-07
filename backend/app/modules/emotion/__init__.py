"""
感情分析モジュール

テキストの感情分析と適切な音声パラメータ生成を行います
"""

from .analyzer import analyze_emotion, analyze_text

__all__ = [
    "analyze_text",
    "analyze_emotion",
]
