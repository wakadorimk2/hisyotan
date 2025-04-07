import os
import random
from typing import List, Optional

import pytesseract
from PIL import Image

from .ocr_capture import capture_screen_as_image

# デフォルトの除外キーワードリスト
DEFAULT_EXCLUDE_KEYWORDS = [
    "youtube",
    "subscribe",
    "vscode",
    "cursor",
    "file",
    "terminal",
    "秘書たん",
    "セリフ",
    "voicevox",
    ".py",
    ".js",
    ".json",
    "https",
]


def filter_ocr_results(
    texts: List[str],
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = None,
) -> List[str]:
    """
    OCR結果のテキストをフィルタリングします。

    Args:
        texts: フィルタリングするテキストのリスト
        include_keywords: 含まれるべきキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 除外すべきキーワードのリスト

    Returns:
        フィルタリングされたテキストのリスト
    """
    cleaned: List[str] = []
    for text in texts:
        if not text.strip():
            continue

        # エラーメッセージはそのまま残す
        if text.startswith("エラー:"):
            cleaned.append(text)
            continue

        # 除外キーワードのチェック
        if exclude_keywords and any(
            ng.lower() in text.lower() for ng in exclude_keywords
        ):
            continue

        # 含むべきキーワードのチェック
        if include_keywords:
            if any(kw.lower() in text.lower() for kw in include_keywords):
                cleaned.append(text)
        else:
            cleaned.append(text)

    return cleaned


def run_random_ocr(
    image_dir: str,
    num_samples: int = 5,
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = DEFAULT_EXCLUDE_KEYWORDS,
) -> List[str]:
    """
    指定したディレクトリ内の画像ファイル（.jpg/.png）からランダムに選んだ画像に対してOCRを実行し、
    フィルタリングされたテキスト結果を返します。

    Args:
        image_dir: 画像ファイルを含むディレクトリのパス
        num_samples: 処理する画像の数（デフォルト: 5）
        include_keywords: 結果に含めるキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 結果から除外するキーワードのリスト（デフォルトあり、Noneで無効化可能）

    Returns:
        フィルタリングされたOCR処理結果のテキストリスト
    """
    # Windowsの場合、Tesseractのパスを明示的に指定
    if os.name == "nt":  # Windows環境の場合
        tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
        else:
            # 一般的なインストールパスをチェック
            alternative_paths = [
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Tesseract-OCR\tesseract.exe",
            ]
            for path in alternative_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    break

    # 画像ディレクトリの確認
    if not os.path.exists(image_dir) or not os.path.isdir(image_dir):
        return [f"エラー: 指定されたディレクトリが存在しません: {image_dir}"]

    # JPGとPNGファイルの検索
    try:
        image_files = [
            f for f in os.listdir(image_dir) if f.lower().endswith((".jpg", ".png"))
        ]
        if not image_files:
            return [
                "エラー: 指定されたディレクトリに画像ファイル(.jpg/.png)が見つかりません"
            ]

        # ランダムにサンプル画像を選択
        sample_images = random.sample(image_files, min(num_samples, len(image_files)))
        results: List[str] = []

        for filename in sample_images:
            try:
                path = os.path.join(image_dir, filename)
                image = Image.open(path)
                # pytesseractの結果を常に文字列として扱う
                ocr_result = pytesseract.image_to_string(image, lang="eng")
                # pytesseractのレスポンスの型が不明確なため、Noneチェックは念のために残す
                text = str(ocr_result) if ocr_result is not None else ""

                if text.strip():
                    results.append(f"{filename}:\n{text.strip()}")
                else:
                    results.append(f"{filename}: テキストが検出されませんでした")
            except Exception as e:
                results.append(f"{filename}: 処理エラー - {str(e)}")

        # 結果をフィルタリング
        filtered_results = filter_ocr_results(
            results,
            include_keywords=include_keywords,
            exclude_keywords=exclude_keywords,
        )

        return filtered_results
    except Exception as e:
        return [f"エラー: {str(e)}"]


def ocr_from_screenshot(
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = DEFAULT_EXCLUDE_KEYWORDS,
) -> List[str]:
    """
    現在の画面をキャプチャしてOCRを実行し、フィルタリングされたテキスト結果を返します。

    Args:
        include_keywords: 結果に含めるキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 結果から除外するキーワードのリスト（デフォルトあり、Noneで無効化可能）

    Returns:
        フィルタリングされたOCR処理結果のテキストリスト
    """
    try:
        # Windowsの場合、Tesseractのパスを明示的に指定
        if os.name == "nt":  # Windows環境の場合
            tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            else:
                # 一般的なインストールパスをチェック
                alternative_paths = [
                    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                    r"C:\Tesseract-OCR\tesseract.exe",
                ]
                for path in alternative_paths:
                    if os.path.exists(path):
                        pytesseract.pytesseract.tesseract_cmd = path
                        break

        # 画面をキャプチャ
        img = capture_screen_as_image()

        # OCR処理を実行（日本語と英語に対応）
        text = pytesseract.image_to_string(img, lang="eng+jpn")

        # 結果を行ごとに分割
        lines = text.splitlines()

        # 空の行を除去
        non_empty_lines = [line for line in lines if line.strip()]

        # フィルタリングして結果を返す
        return filter_ocr_results(
            non_empty_lines,
            include_keywords=include_keywords,
            exclude_keywords=exclude_keywords,
        )
    except Exception as e:
        return [f"エラー: スクリーンショットOCR処理に失敗しました - {str(e)}"]
