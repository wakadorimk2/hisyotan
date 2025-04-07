#!/usr/bin/env python
"""
音声合成APIのテスト

FastAPIエンドポイントのテストを行います。
"""

import json

import requests

# サーバーURL
BASE_URL = "http://localhost:8000"


def test_analyze_endpoint():
    """感情分析エンドポイントのテスト"""
    print("\n=== 感情分析APIテスト ===")

    test_texts = [
        "こんにちは、元気ですか？",
        "危険です！ゾンビが接近しています！",
        "おつかれさま、ゆっくり休んでね♪",
    ]

    for text in test_texts:
        print(f"\nテスト: 「{text}」")

        try:
            # POSTリクエスト送信
            response = requests.post(
                f"{BASE_URL}/api/voice/analyze", json={"text": text}
            )

            # レスポンスコード表示
            print(f"ステータスコード: {response.status_code}")

            # レスポンス内容表示
            data = response.json()
            print(f"レスポンス: {json.dumps(data, ensure_ascii=False, indent=2)}")

            # 感情と説明を表示
            if response.status_code == 200 and "analysis" in data:
                analysis = data["analysis"]
                print(f"感情: {analysis.get('emotion')}")
                print(f"説明: {analysis.get('explanation')}")
                print(f"パラメータ: {analysis.get('parameters')}")

        except Exception as e:
            print(f"エラー: {e}")


def test_zombie_endpoint():
    """ゾンビ反応エンドポイントのテスト"""
    print("\n=== ゾンビ反応APIテスト ===")

    test_cases = [
        {"count": 0, "distance": 0.0, "force": False},
        {"count": 1, "distance": 5.0, "force": False},
        {"count": 3, "distance": 2.5, "force": True},
        {"count": 5, "distance": 1.0, "force": True},
    ]

    for case in test_cases:
        print(
            f"\nテスト: ゾンビ {case['count']}体、距離 {case['distance']}m、強制: {case['force']}"
        )

        try:
            # GETリクエスト送信
            response = requests.post(
                f"{BASE_URL}/api/voice/react_to_zombie", params=case
            )

            # レスポンスコード表示
            print(f"ステータスコード: {response.status_code}")

            # レスポンス内容表示
            try:
                data = response.json()
                print(f"レスポンス: {json.dumps(data, ensure_ascii=False, indent=2)}")
            except:
                print(f"レスポンス: {response.text}")

        except Exception as e:
            print(f"エラー: {e}")


def main():
    """メイン実行関数"""
    print("音声合成API テスト開始")

    # テスト実行
    test_analyze_endpoint()
    test_zombie_endpoint()

    print("\n音声合成API テスト完了")


if __name__ == "__main__":
    main()
