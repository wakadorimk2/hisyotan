#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Union

import cv2
from tqdm import tqdm

# ロガーセットアップをインポート
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
from backend.app.modules.zombie.logger_setup import setup_file_logging

# ロガーの設定
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("フレーム抽出ちゃん")


class FrameExtractor:
    """
    動画からフレームを抽出するクラス
    """

    def __init__(
        self,
        input_path: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        frame_interval: int = 30,
        file_prefix: str = "frame_",
        use_gpu: bool = False,
    ) -> None:
        """
        初期化関数

        Args:
            input_path: 入力動画ファイルパス
            output_dir: 出力ディレクトリ。指定がなければ動画名から自動生成
            frame_interval: フレーム抽出間隔。デフォルトは30（30FPS動画で1秒に1枚）
            file_prefix: 出力ファイル名の接頭辞
            use_gpu: GPUを使用するかどうか
        """
        self.input_path = Path(input_path)

        # 入力ファイルの存在確認
        if not self.input_path.exists():
            raise FileNotFoundError(f"動画ファイルが見つかりません: {input_path}")

        # 出力ディレクトリの設定
        if output_dir is None:
            # 入力ファイル名から出力ディレクトリを生成
            video_name = self.input_path.stem
            self.output_dir = Path("data/datasets/frames") / video_name
        else:
            self.output_dir = Path(output_dir)

        # フレーム間隔とファイル名接頭辞
        self.frame_interval = frame_interval
        self.file_prefix = file_prefix

        # GPU使用の設定
        self.use_gpu = use_gpu
        self.has_cuda = False

        # CUDAが利用可能かチェック
        if self.use_gpu:
            if cv2.cuda.getCudaEnabledDeviceCount() > 0:
                self.has_cuda = True
                gpu_name = cv2.cuda.getDevice()
                logger.info(f"✨ GPU処理が有効になりました！デバイス: {gpu_name} ✨")
            else:
                logger.warning(
                    "😢 GPUが見つからないか、"
                    "OpenCVがCUDAサポート付きでビルドされていません"
                )
                logger.warning("💻 CPUモードで処理を続行します")

    def create_output_directory(self) -> None:
        """出力ディレクトリを作成する"""
        os.makedirs(self.output_dir, exist_ok=True)
        logger.info(f"出力ディレクトリを準備しました: {self.output_dir}")

    def extract_frames(self) -> bool:
        """動画からフレームを抽出して保存する"""
        # 動画ファイルを開く
        cap = cv2.VideoCapture(str(self.input_path))

        # 動画ファイルが正常に開けたか確認
        if not cap.isOpened():
            logger.error(f"動画ファイルを開けませんでした: {self.input_path}")
            return False

        # 動画の情報を取得
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        logger.info(f"動画情報: {width}x{height}, {fps}fps, 全{total_frames}フレーム")
        logger.info(
            f"抽出間隔: {self.frame_interval}フレームごと"
            f"（約 {self.frame_interval / fps:.2f}秒に1枚）"
        )

        # 出力ディレクトリの作成
        self.create_output_directory()

        # 抽出するフレーム数の計算
        frames_to_extract = total_frames // self.frame_interval

        # フレーム抽出
        frame_count = 0
        saved_count = 0

        # GPUアップロードストリームの作成（GPUモード時）
        if self.has_cuda:
            gpu_stream = cv2.cuda.Stream()

        # プログレスバーの設定
        gpu_text = "🚀 GPU" if self.has_cuda else "💻 CPU"
        pbar = tqdm(
            total=frames_to_extract,
            desc=f"✨ ふにゃふにゃ抽出中 ({gpu_text}) ✨",
            ncols=100,
        )

        while True:
            ret, frame = cap.read()

            # 動画の終わりに達したらループを抜ける
            if not ret:
                break

            # frame_interval毎にフレームを保存
            if frame_count % self.frame_interval == 0:
                # GPU処理（CUDAが利用可能な場合）
                if self.has_cuda:
                    # CPUからGPUへフレームをアップロード
                    gpu_frame = cv2.cuda.GpuMat()
                    gpu_frame.upload(frame, gpu_stream)

                    # GPU上での処理（必要に応じて）
                    # 例: リサイズ、色変換など
                    # gpu_frame = cv2.cuda.resize(gpu_frame, (width, height))

                    # 結果をCPUにダウンロード
                    result_frame = gpu_frame.download(stream=gpu_stream)
                else:
                    # CPU処理モード
                    result_frame = frame

                # 保存するファイル名（4桁の連番）
                file_name = f"{self.file_prefix}{saved_count + 1:04d}.jpg"
                file_path = self.output_dir / file_name

                # フレームを保存
                cv2.imwrite(str(file_path), result_frame)
                saved_count += 1
                pbar.update(1)

            frame_count += 1

        # リソースの解放
        cap.release()
        pbar.close()

        logger.info(f"フレーム抽出完了！{saved_count}枚のフレームを保存しました🌟")
        return True


def parse_args() -> argparse.Namespace:
    """コマンドライン引数をパースする"""
    parser = argparse.ArgumentParser(description="動画からフレームを抽出するスクリプト")
    parser.add_argument("--input", "-i", required=True, help="入力動画ファイルのパス")
    parser.add_argument(
        "--output", "-o", help="出力ディレクトリのパス（指定しない場合は自動生成）"
    )
    parser.add_argument(
        "--interval",
        "-n",
        type=int,
        default=30,
        help="フレーム抽出間隔（デフォルト: 30、つまり30FPSの動画で1秒に1枚）",
    )
    parser.add_argument(
        "--prefix",
        "-p",
        default="frame_",
        help="出力ファイル名の接頭辞（デフォルト: frame_）",
    )
    parser.add_argument(
        "--gpu",
        "-g",
        action="store_true",
        help="GPUを使用してフレーム処理を高速化（CUDAが必要）",
    )
    return parser.parse_args()


def main() -> int:
    """メイン関数"""
    # コマンドライン引数の解析
    args = parse_args()

    # ファイルロギングのセットアップ
    log_file = setup_file_logging()
    logger.info(f"ログファイル: {log_file}")

    try:
        # フレーム抽出インスタンスの作成
        extractor = FrameExtractor(
            input_path=args.input,
            output_dir=args.output,
            frame_interval=args.interval,
            file_prefix=args.prefix,
            use_gpu=args.gpu,
        )

        # フレーム抽出の実行
        result = extractor.extract_frames()

        if result:
            logger.info("動画フレーム抽出が正常に完了しました✨")
            return 0
        else:
            logger.error("動画フレーム抽出中にエラーが発生しました😢")
            return 1

    except Exception as e:
        logger.exception(f"予期せぬエラーが発生しました: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
