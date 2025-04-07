import os

from openai import OpenAI


def ask_hisyotan_agent(prompt: str) -> str:
    """
    秘書たんらしいやさしい一言を返す短文エージェント

    Args:
        prompt (str): プレイヤーの状況を表すテキスト

    Returns:
        str: 秘書たんからの優しい返答（40文字以内）
    """
    # 環境変数からAPIキーを取得
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEYが設定されていません。.envファイルを確認してください。"
        )

    # OpenAIクライアントの初期化
    client = OpenAI(api_key=api_key)

    # システムメッセージの設定
    system_message = (
        "あなたはふにゃっと優しく寄り添う秘書キャラクターです。"
        "以下のプレイヤー状況に対して、40文字以内で一言だけ反応してください。"
        "感情を込めて、丁寧語で話してください。"
    )

    # APIリクエストの送信
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
        max_tokens=100,
    )

    # レスポンスから返答を抽出
    return response.choices[0].message.content.strip()
