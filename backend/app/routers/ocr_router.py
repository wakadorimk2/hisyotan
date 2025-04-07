"""
OCRルーター

画像からテキストを抽出するOCR機能のAPIエンドポイントを提供
"""

from typing import Dict, List, Union

from fastapi import APIRouter, HTTPException, Query

from ..modules.ocr.ocr_text import (
    ocr_from_screenshot,  # 追加する関数がある前提で！
    run_random_ocr,
)

# ルーターの作成
router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.get("/sample")
async def sample_ocr(
    image_dir: str = Query(..., description="画像が格納されているディレクトリのパス"),
    num_samples: int = Query(
        5, description="処理する画像サンプル数（デフォルト: 5）", gt=0, le=20
    ),
) -> Dict[str, Union[str, List[str]]]:
    """
    指定したディレクトリからランダムに画像を選択してOCR処理を実行

    Args:
        image_dir: 画像ファイルが格納されているディレクトリのパス
        num_samples: 処理する画像の数（デフォルト: 5、最大: 20）

    Returns:
        OCR処理結果を含むレスポンス
    """
    try:
        # OCR処理を実行
        ocr_results = run_random_ocr(image_dir=image_dir, num_samples=num_samples)

        # 結果が空の場合またはエラーメッセージがある場合
        if not ocr_results:
            return {"status": "warning", "message": "処理結果が空です", "results": []}

        # エラーメッセージが含まれているか確認
        if any(result.startswith("エラー:") for result in ocr_results):
            error_msgs = [r for r in ocr_results if r.startswith("エラー:")]
            return {"status": "error", "message": error_msgs[0], "results": ocr_results}

        # 正常な処理結果
        return {
            "status": "success",
            "message": f"{len(ocr_results)}件の画像からテキストを抽出しました",
            "results": ocr_results,
        }

    except Exception as e:
        # 予期しないエラーが発生した場合
        raise HTTPException(
            status_code=500, detail=f"OCR処理中にエラーが発生しました: {str(e)}"
        )


@router.get("/screenshot")
async def screenshot_ocr() -> Dict[str, Union[str, List[str]]]:
    """
    現在の画面をキャプチャしてOCR処理を実行
    """
    try:
        ocr_results = ocr_from_screenshot()

        if not ocr_results:
            return {"status": "warning", "message": "処理結果が空です", "results": []}

        if any(result.startswith("エラー:") for result in ocr_results):
            error_msgs = [r for r in ocr_results if r.startswith("エラー:")]
            return {"status": "error", "message": error_msgs[0], "results": ocr_results}

        return {
            "status": "success",
            "message": f"画面から{len(ocr_results)}件のテキストを抽出しました",
            "results": ocr_results,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"OCR処理中にエラーが発生しました: {str(e)}"
        )
