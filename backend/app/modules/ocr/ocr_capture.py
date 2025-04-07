import mss
from PIL import Image


def capture_screen_as_image() -> Image.Image:
    """
    メインモニタの画面をキャプチャして、PIL Image オブジェクトとして返します。

    Returns:
        Image.Image: キャプチャした画面のPIL Imageオブジェクト
    """
    with mss.mss() as sct:
        # monitor[1]は通常メインモニタを指します
        monitor = sct.monitors[1]
        screenshot = sct.grab(monitor)

        # mssの出力をPIL Imageに変換
        img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
        return img
