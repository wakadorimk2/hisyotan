import os
import random
import re
from typing import List, Optional, Set

import cv2
import numpy as np
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


def filter_ocr_lines(lines: List[str]) -> List[str]:
    """
    OCR結果の行リストをフィルタリングします。

    フィルタ条件:
    - 各行を strip() で前後トリム
    - 3文字未満、または50文字超の行は除外
    - 英数字（a-zA-Z0-9）が1文字も含まれない行は除外
    - 記号や記号類（!@#$%^&*()など）だけで構成されている行は除外
    - すべての行を小文字に変換し、重複行は除外

    Args:
        lines: フィルタリングする行のリスト

    Returns:
        フィルタリングされた行のリスト
    """
    if not lines:
        return []

    filtered: List[str] = []
    seen: Set[str] = set()

    for line in lines:
        # 前後の空白を削除
        trimmed = line.strip()

        # 長さチェック（3文字未満または50文字超は除外）
        if len(trimmed) < 3 or len(trimmed) > 50:
            continue

        # 英数字が含まれていないか確認
        if not re.search(r"[a-zA-Z0-9]", trimmed):
            continue

        # 記号だけで構成されているか確認
        if re.match(r'^[!@#$%^&*()\-_=+\[\]{}|\\;:\'",.<>/?`~]*$', trimmed):
            continue

        # 小文字に変換
        lower_line = trimmed.lower()

        # 重複チェック
        if lower_line in seen:
            continue

        seen.add(lower_line)
        filtered.append(lower_line)

    return filtered


def filter_ocr_lines_game(lines: List[str]) -> List[str]:
    """
    ゲーム画面のOCR結果に最適化されたフィルタリング関数です。
    ステータス情報、クエスト情報、位置情報などのゲーム内重要テキストを保持します。

    フィルタ条件:
    - 各行を strip() で前後トリム
    - 2文字未満の行は除外（短いステータス表示を許可）
    - 80文字超の行は除外（長めのクエスト情報を許可）
    - '%'や'/'を含む行は英数字がなくても許可（例: 15%、0/120）
    - 数値と記号の組み合わせは許可（例: HP:100、0/50）
    - すべての行を小文字に変換し、重複行は除外

    Args:
        lines: フィルタリングする行のリスト

    Returns:
        フィルタリングされた行のリスト
    """
    if not lines:
        return []

    filtered: List[str] = []
    seen: Set[str] = set()

    for line in lines:
        # 前後の空白を削除
        trimmed = line.strip()

        # 長さチェック（2文字未満または80文字超は除外）
        if len(trimmed) < 2 or len(trimmed) > 80:
            continue

        # '%'や'/'を含む行は特別に許可
        has_special_chars = re.search(r"[%/:]", trimmed)

        # 英数字チェック - 特殊文字があるか英数字があれば許可
        if not has_special_chars and not re.search(r"[a-zA-Z0-9]", trimmed):
            continue

        # 記号だけで構成されているか確認 - 数値と記号の組み合わせは許可
        if re.match(r'^[!@#$%^&*()\-_=+\[\]{}|\\;:\'",.<>/?`~]*$', trimmed):
            continue

        # LOCATION: やクエスト情報を特別に検出
        is_location = re.search(r"location\s*:\s*\w+", trimmed.lower())
        is_quest = re.search(
            r"(retrieve|clear|collect|find|kill|defeat)", trimmed.lower()
        )

        # 小文字に変換
        lower_line = trimmed.lower()

        # 重複チェック
        if lower_line in seen:
            continue

        seen.add(lower_line)

        # 元の大文字小文字を保持（クエスト情報などは大文字で表示されることが多い）
        if is_location or is_quest:
            filtered.append(trimmed)
        else:
            filtered.append(lower_line)

    return filtered


def extract_location_info(lines: List[str]) -> Optional[str]:
    """
    OCR結果からロケーション情報を抽出します。

    Args:
        lines: 処理する行のリスト

    Returns:
        ロケーション情報、または見つからない場合はNone
    """
    for line in lines:
        # LOCATION: XXX_XXX 形式を検索
        match = re.search(r"(?i)location\s*:\s*(\w+(?:_\w+)*)", line)
        if match:
            return match.group(1)
    return None


def filter_ocr_results(
    texts: List[str],
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = DEFAULT_EXCLUDE_KEYWORDS,
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
    use_game_filter: bool = False,
) -> List[str]:
    """
    指定したディレクトリ内の画像ファイル（.jpg/.png）からランダムに選んだ画像に対してOCRを実行し、
    フィルタリングされたテキスト結果を返します。

    Args:
        image_dir: 画像ファイルを含むディレクトリのパス
        num_samples: 処理する画像の数（デフォルト: 5）
        include_keywords: 結果に含めるキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 結果から除外するキーワードのリスト（デフォルトあり、Noneで無効化可能）
        use_game_filter: ゲーム用の軽量フィルタを使用するかどうか

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

        # 各OCR結果から行を抽出してフィルタリング
        enhanced_results: List[str] = []
        for result in filtered_results:
            if result.startswith("エラー:") or ":" not in result:
                enhanced_results.append(result)
                continue

            # ファイル名とOCR結果を分離
            filename, content = result.split(":", 1)
            if not content.strip():
                enhanced_results.append(result)
                continue

            # OCR結果の各行をフィルタリング（ゲームモードに応じて選択）
            if use_game_filter:
                filtered_lines = filter_ocr_lines_game(content.strip().splitlines())
            else:
                filtered_lines = filter_ocr_lines(content.strip().splitlines())

            if filtered_lines:
                enhanced_results.append(f"{filename}:\n" + "\n".join(filtered_lines))
            else:
                enhanced_results.append(
                    f"{filename}: フィルター後にテキストが残りませんでした"
                )

        return enhanced_results
    except Exception as e:
        return [f"エラー: {str(e)}"]


def preprocess_for_ocr(pil_image: Image.Image) -> Image.Image:
    """
    OCRの精度向上のための画像前処理を行います。

    処理内容:
    1. グレースケール変換
    2. 二値化処理（閾値: 160）
    3. ノイズ除去（メディアンフィルタ）

    Args:
        pil_image: 処理するPIL Image形式の画像

    Returns:
        前処理済みのPIL Image形式の画像
    """
    # PIL画像をOpenCV形式に変換
    cv_img = np.array(pil_image)

    # カラー画像の場合はBGR→RGBに変換（PIL→OpenCV変換のため）
    if len(cv_img.shape) == 3:
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)

    # グレースケール変換
    gray_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 二値化処理（閾値: 160）
    _, binary_img = cv2.threshold(gray_img, 160, 255, cv2.THRESH_BINARY)

    # ノイズ除去（メディアンフィルタ）
    denoised_img = cv2.medianBlur(binary_img, 3)

    # OpenCV画像をPIL形式に戻す
    pil_processed = Image.fromarray(denoised_img)

    return pil_processed


def crop_regions(image: Image.Image) -> dict[str, Image.Image]:
    """
    入力画像をステータス・インベントリ・クエスト領域に分割して返す

    画面サイズに対してパーセンテージ指定で領域を切り出します。
    座標範囲（パーセンテージベース）：
    - status (左下のステータス): x=0-20%, y=88-100%
    - inventory (所持品、下部): x=50-98%, y=80-100%
    - quest (右上のクエスト): x=83-100%, y=6-20%

    Args:
        image: 元の画像（PIL.Image形式）

    Returns:
        dict[str, Image.Image]: 3つの領域を含む辞書
            {
                'status': PIL.Image,    # 左下のステータス領域
                'inventory': PIL.Image, # 下部のインベントリ領域
                'quest': PIL.Image      # 右上のクエスト領域
            }
    """
    # 画像サイズを取得
    width, height = image.size

    # 座標範囲（パーセンテージベース）
    regions = {
        "status": {"x_start": 0.00, "y_start": 0.88, "x_end": 0.20, "y_end": 1.00},
        "inventory": {"x_start": 0.50, "y_start": 0.80, "x_end": 0.98, "y_end": 1.00},
        "quest": {"x_start": 0.83, "y_start": 0.06, "x_end": 1.00, "y_end": 0.20},
    }

    # 切り出した画像を格納する辞書
    cropped_images: dict[str, Image.Image] = {}

    # 各領域を切り出す
    for region_name, coords in regions.items():
        # パーセンテージからピクセル座標に変換
        left = int(width * coords["x_start"])
        top = int(height * coords["y_start"])
        right = int(width * coords["x_end"])
        bottom = int(height * coords["y_end"])

        # 領域を切り出す
        cropped_images[region_name] = image.crop((left, top, right, bottom))

    return cropped_images


def ocr_from_screenshot(
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = DEFAULT_EXCLUDE_KEYWORDS,
    use_game_filter: bool = True,
) -> List[str]:
    """
    現在の画面をキャプチャしてOCRを実行し、フィルタリングされたテキスト結果を返します。

    Args:
        include_keywords: 結果に含めるキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 結果から除外するキーワードのリスト（デフォルトあり、Noneで無効化可能）
        use_game_filter: ゲーム用の軽量フィルタを使用するかどうか

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

        # 前処理を適用
        img = preprocess_for_ocr(img)

        # OCR処理を実行（英語に対応）
        text = str(pytesseract.image_to_string(img, lang="eng"))

        # 結果を行ごとに分割
        lines = text.splitlines()

        # 空の行を除去
        non_empty_lines = [line for line in lines if line.strip()]

        # キーワードベースのフィルタリング
        keyword_filtered = filter_ocr_results(
            non_empty_lines,
            include_keywords=include_keywords,
            exclude_keywords=exclude_keywords,
        )

        # 追加のフィルタリングルールを適用（ゲームモードに応じて選択）
        if use_game_filter:
            return filter_ocr_lines_game(keyword_filtered)
        else:
            return filter_ocr_lines(keyword_filtered)
    except Exception as e:
        return [f"エラー: スクリーンショットOCR処理に失敗しました - {str(e)}"]


def ocr_regions_from_screenshot(
    include_keywords: Optional[List[str]] = None,
    exclude_keywords: Optional[List[str]] = DEFAULT_EXCLUDE_KEYWORDS,
    use_game_filter: bool = True,
    lang: str = "eng",
) -> dict[str, List[str]] | dict[str, str]:
    """
    画面をキャプチャして3つの領域（status、inventory、quest）に分割し、
    それぞれの領域でOCRを実行してフィルタリングされた結果をJSON形式で返します。

    Args:
        include_keywords: 結果に含めるキーワードのリスト（指定がない場合はフィルタしない）
        exclude_keywords: 結果から除外するキーワードのリスト（デフォルトあり、Noneで無効化可能）
        use_game_filter: ゲーム用の軽量フィルタを使用するかどうか
        lang: OCRに使用する言語（デフォルト: "eng"）

    Returns:
        dict[str, List[str]] | dict[str, str]: 各領域のOCR結果を含む辞書
        正常時:
        {
            "status": [テキスト1, テキスト2, ...],
            "inventory": [テキスト1, テキスト2, ...],
            "quest": [テキスト1, テキスト2, ...]
        }
        エラー時: {"error": エラーメッセージ}
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

        # 画像を3領域に分割
        regions = crop_regions(img)

        # 各領域のOCR結果を格納する辞書
        result: dict[str, List[str]] = {}

        # 各領域に対してOCRを実行
        for region_name, region_img in regions.items():
            # 前処理を適用
            processed_img = preprocess_for_ocr(region_img)

            # OCR処理を実行（型エラー回避のため明示的に文字列変換）
            # pytesseractの戻り値はNoneにはならないが、型チェックのため条件文を残す
            ocr_result = pytesseract.image_to_string(processed_img, lang=lang)
            text = str(ocr_result)

            # 結果を行ごとに分割
            lines = text.splitlines()

            # 空の行を除去
            non_empty_lines = [line for line in lines if line.strip()]

            # キーワードベースのフィルタリング
            keyword_filtered = filter_ocr_results(
                non_empty_lines,
                include_keywords=include_keywords,
                exclude_keywords=exclude_keywords,
            )

            # 追加のフィルタリングルールを適用
            if use_game_filter:
                filtered_lines = filter_ocr_lines_game(keyword_filtered)
            else:
                filtered_lines = filter_ocr_lines(keyword_filtered)

            # 結果を辞書に追加
            result[region_name] = filtered_lines

        return result
    except Exception as e:
        return {"error": f"スクリーンショットOCR処理に失敗しました - {str(e)}"}
