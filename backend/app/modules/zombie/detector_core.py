import asyncio
import logging
import os
import time
import traceback  # スタックトレース取得用
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Tuple,
    TypeVar,
    Union,
)

import cv2
import mss
import mss.base
import numpy as np
import psutil  # CPU使用率の取得
import torch
from numpy.typing import NDArray
from ultralytics import YOLO

# 内部モジュールのインポート
from .performance import PERFORMANCE_SETTINGS

# ロガーの設定
logger = logging.getLogger(__name__)

# データ保存用のディレクトリ設定
WORKSPACE_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
DATA_DIR = os.path.join(WORKSPACE_ROOT, "data")
DETECTION_DIR = os.path.join(DATA_DIR, "detections")
DEBUG_DIR = os.path.join(DATA_DIR, "debug")

# 検出保持設定
MAX_DETECTIONS_PER_DAY = 100  # 1日あたりの最大保存数
MAX_DETECTION_DIR_SIZE_MB = 500  # 検出ディレクトリの最大サイズ（MB）

# 型定義のヘルパー
T = TypeVar("T")


class ZombieDetector:
    """ゾンビ検出クラス"""

    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = None,
        confidence: float = 0.45,
        debug_mode: bool = False,
        target_classes: Optional[List[int]] = None,
        resnet_enabled: bool = True,
        use_gpu: bool = True,
    ) -> None:
        """
        ZombieDetectorクラスのコンストラクタ

        Args:
            model_path: YOLOモデルファイルのパス（指定がなければデフォルトのYOLOv8nを使用）
            confidence: 検出信頼度の閾値（デフォルト: 0.45）
            debug_mode: デバッグモードフラグ
            target_classes: 検出対象のクラスIDリスト（デフォルトは人物クラス[0]のみ）
            resnet_enabled: ResNet分類器を有効にするかどうか
            use_gpu: GPUを使用するかどうか（デフォルト: True）
        """

        self.model_path = model_path
        self.confidence = confidence
        self.debug_mode = debug_mode
        self.model: Optional[YOLO] = None
        self.is_monitoring = False
        self.frame_count = 0
        self.last_cpu_check_time = 0
        self.cpu_check_interval = 10  # CPU使用率チェックの間隔（秒）
        self.adaptive_interval = PERFORMANCE_SETTINGS["frame_interval"]
        self.resize_factor = PERFORMANCE_SETTINGS["resize_factor"]
        self.skip_ratio: float = float(PERFORMANCE_SETTINGS["skip_ratio"])
        self.cpu_threshold = PERFORMANCE_SETTINGS["cpu_threshold"]

        # GPU設定
        self.use_gpu = use_gpu and torch.cuda.is_available()
        self.device = torch.device("cuda" if self.use_gpu else "cpu")

        # ResNet分類器の設定
        self.resnet_enabled = resnet_enabled
        self.resnet_classifier: Optional[Any] = None

        # 検出対象クラスの設定
        self.target_classes = (
            target_classes if target_classes is not None else [0]
        )  # デフォルトは人物クラスのみ

        # 検出履歴の初期化（パラメータ調整）
        self.detection_history: List[bool] = []
        self.history_size: int = 3
        self.required_consecutive_detections: int = 1  # 緩和：1フレームの検出でOKに変更

        # クールダウン時間の調整
        self.cooldown_timestamps: Dict[str, float] = {
            "few": 0.0,  # 少数ゾンビ（1〜4体）
            "warning": 0.0,  # 警戒レベル（5〜9体）
            "many": 0.0,  # 多数ゾンビ（10体以上）
        }
        self.cooldown_periods: Dict[str, int] = {
            "few": 5,  # 少数ゾンビ: 5秒
            "warning": 8,  # 警戒レベル: 8秒
            "many": 10,  # 多数ゾンビ: 10秒
        }

        # ディレクトリ準備
        os.makedirs(DETECTION_DIR, exist_ok=True)
        os.makedirs(DEBUG_DIR, exist_ok=True)

        logger.info(
            f"ZombieDetector初期化完了: confidence={self.confidence}, "
            f"debug_mode={self.debug_mode}, frame_interval={self.adaptive_interval}秒, "
            f"resize_factor={self.resize_factor}, skip_ratio={self.skip_ratio}, "
            f"resnet_enabled={self.resnet_enabled}"
        )

    async def load_model(self) -> bool:
        """
        YOLOモデルの非同期ロード

        Returns:
            bool: モデルのロードが成功したかどうか
        """
        try:
            # モデルのロードは重い処理なので非同期で行う
            loop = asyncio.get_event_loop()

            # GPUサポート状態のログ出力
            if self.use_gpu:
                gpu_info = (
                    f"GPU: {torch.cuda.get_device_name(0)}"
                    if torch.cuda.is_available()
                    else "GPU利用可能だがデバイスが見つかりません"
                )
                logger.info(f"GPU検出: {gpu_info}")
            else:
                logger.info("CPU モードで実行します")

            # YOLOモデルをロード（デバイスパラメータなしで初期化）
            self.model = await loop.run_in_executor(None, lambda: YOLO(self.model_path))

            # モデル読み込み後にデバイスを設定
            if self.use_gpu and torch.cuda.is_available():
                await loop.run_in_executor(None, lambda: self.model.to(self.device))

            logger.info(
                f"YOLOモデルのロードに成功: {self.model_path} (デバイス: {self.device})"
            )

            # ResNet分類器も初期化
            if self.resnet_enabled:
                try:
                    # 絶対パスではなく相対パスを使ってインポート
                    import sys

                    sys.path.append(
                        str(Path(__file__).parent.parent.parent.parent.parent)
                    )
                    from backend.app.modules.zombie.ml.infer_zombie_classifier import (
                        ZombieClassifier,
                    )

                    logger.info("ZombieClassifierをインポートしました")

                    # 分類器のインスタンス化と実行（デバイスを指定）
                    self.resnet_classifier = await loop.run_in_executor(
                        None,
                        lambda: ZombieClassifier(
                            data_path=os.path.join(
                                DATA_DIR, "datasets", "zombie_classifier"
                            ),
                            device=str(self.device),
                        ),
                    )
                    logger.info(
                        f"ResNet分類器の初期化に成功しました (デバイス: {self.device})"
                    )
                except ImportError as e:
                    logger.error(f"ZombieClassifierのインポートに失敗: {e}")

                    # 最小限のダミー実装を提供
                    class DummyClassifier:
                        def predict_image(self, img_path: str) -> Tuple[str, float]:
                            logger.warning("ダミー分類器が使用されています！")
                            return "not_zombie", 0.0

                    self.resnet_classifier = DummyClassifier()
                    logger.warning("ダミーのResNet分類器を使用します")
                except Exception as e:
                    logger.error(f"ResNet分類器の初期化に失敗: {e}")
                    logger.exception("詳細なスタックトレース:")
                    self.resnet_enabled = False

            return True
        except Exception as e:
            logger.error(f"YOLOモデルのロードに失敗: {e}")
            return False

    async def start_monitoring(
        self,
        callback: Optional[Callable[[int, Any], Any]] = None,
        few_zombies_callback: Optional[Callable[[int, Any], Any]] = None,
        warning_zombies_callback: Optional[Callable[[int, Any], Any]] = None,
    ) -> asyncio.Task[Any]:
        """
        ゾンビ検出監視を開始する

        Args:
            callback: 多数ゾンビ検出時のコールバック関数
            few_zombies_callback: 少数ゾンビ検出時のコールバック関数
            warning_zombies_callback: 警戒レベルゾンビ検出時のコールバック関数

        Returns:
            asyncio.Task: 監視タスク
        """
        if self.is_monitoring:
            logger.warning("すでに監視中です。既存のタスクを返します。")
            # すでに監視中の場合は、新しいタスクは作成しない
            # ここでは仮の空タスクを返す（実際には使用中のタスクを管理する必要がある）
            return asyncio.create_task(asyncio.sleep(0))

        # モデルがロードされていなければロードする
        if self.model is None:
            success = await self.load_model()
            if not success:
                logger.error("モデルのロードに失敗したため、監視を開始できません。")
                # エラー時も空タスクを返す
                return asyncio.create_task(asyncio.sleep(0))

        self.is_monitoring = True
        logger.info("ゾンビ検出監視を開始します...")

        # 非同期の監視ループを開始
        return asyncio.create_task(
            self._monitor_loop(
                zombie_callback=callback,
                few_zombies_callback=few_zombies_callback,
                warning_zombies_callback=warning_zombies_callback,
            )
        )

    async def stop_monitoring(self) -> None:
        """ゾンビ検出監視を停止する"""
        if not self.is_monitoring:
            logger.warning("監視は実行されていません。")
            return

        logger.info("ゾンビ検出監視を停止します...")
        self.is_monitoring = False

        # 安全のため少し待機して、監視ループが確実に停止するようにする
        await asyncio.sleep(0.5)

    async def _monitor_loop(
        self,
        zombie_callback: Optional[Callable[[int, Any], Any]] = None,
        few_zombies_callback: Optional[Callable[[int, Any], Any]] = None,
        warning_zombies_callback: Optional[Callable[[int, Any], Any]] = None,
    ) -> None:
        """
        ゾンビ検出の非同期監視ループ

        Args:
            zombie_callback: 多数ゾンビ検出時のコールバック関数
            few_zombies_callback: 少数ゾンビ検出時のコールバック関数
            warning_zombies_callback: 警戒レベルゾンビ検出時のコールバック関数
        """
        logger.info("監視ループを開始します")

        # 画面キャプチャの設定
        with mss.mss() as sct:
            # モニターの取得
            monitor = sct.monitors[1]  # プライマリーモニター

            while self.is_monitoring:
                try:
                    # フレームカウントを更新
                    self.frame_count += 1

                    # スキップレートが設定されている場合、一部のフレームをスキップ
                    if self.skip_ratio > 1 and self.frame_count % self.skip_ratio != 0:
                        # スキップする場合は短い待機時間
                        await asyncio.sleep(0.1)
                        continue

                    # CPU使用率を定期的にチェックし、高負荷時はパフォーマンス設定を調整
                    current_time = time.time()
                    if (
                        current_time - self.last_cpu_check_time
                        > self.cpu_check_interval
                    ):
                        self._adjust_performance_settings()
                        self.last_cpu_check_time = current_time

                    # 画面キャプチャを実行
                    screenshot = await self._capture_screen(sct, monitor)
                    if screenshot is None:
                        logger.warning("画面キャプチャに失敗しました")
                        await asyncio.sleep(1)
                        continue

                    # ゾンビ検出を実行
                    results, zombie_count = await self._detect_zombies(screenshot)
                    if results is None:
                        await asyncio.sleep(self.adaptive_interval)
                        continue

                    # YOLOの結果を辞書形式に変換
                    processed_results = {
                        "detection_count": zombie_count,
                        "timestamp": current_time,
                        "boxes": results,
                        "resnet_result": {"is_zombie_scene": False, "probability": 0.0},
                    }

                    # 検出結果を処理
                    await self._process_detection_results(
                        processed_results,
                        screenshot,
                        zombie_callback,
                        few_zombies_callback,
                        warning_zombies_callback,
                    )

                    # 次のフレームまで待機
                    await asyncio.sleep(self.adaptive_interval)

                except asyncio.CancelledError:
                    logger.info("監視タスクがキャンセルされました")
                    break
                except Exception as e:
                    logger.error(f"監視ループ中にエラーが発生しました: {e}")
                    logger.error(traceback.format_exc())
                    await asyncio.sleep(2)  # エラー発生時は少し長めの待機

        logger.info("監視ループを終了しました")

    def _adjust_performance_settings(self) -> None:
        """
        CPU使用率に基づいてパフォーマンス設定を調整する
        """
        try:
            # 現在のCPU使用率を取得
            cpu_percent = psutil.cpu_percent(interval=0.5)

            # 高負荷時の調整
            if cpu_percent > self.cpu_threshold:
                # CPU使用率が閾値を超えた場合、フレーム間隔を増やし、リサイズ率を下げる
                self.adaptive_interval = min(
                    PERFORMANCE_SETTINGS["frame_interval"] * 1.5, 2.0
                )
                self.resize_factor = max(
                    PERFORMANCE_SETTINGS["resize_factor"] * 0.8, 0.3
                )
                self.skip_ratio = min(PERFORMANCE_SETTINGS["skip_ratio"] + 1, 5)
                logger.info(
                    f"高CPU負荷 ({cpu_percent:.1f}%)のため設定調整: "
                    f"interval={self.adaptive_interval:.1f}s, "
                    f"resize={self.resize_factor:.2f}"
                )
            else:
                # 通常負荷時は標準設定に戻す
                self.adaptive_interval = PERFORMANCE_SETTINGS["frame_interval"]
                self.resize_factor = PERFORMANCE_SETTINGS["resize_factor"]
                self.skip_ratio = PERFORMANCE_SETTINGS["skip_ratio"]
        except Exception as e:
            logger.error(f"パフォーマンス設定の調整中にエラー発生: {e}")
            # エラー時はデフォルト設定に戻す
            self.adaptive_interval = PERFORMANCE_SETTINGS["frame_interval"]
            self.resize_factor = PERFORMANCE_SETTINGS["resize_factor"]
            self.skip_ratio = PERFORMANCE_SETTINGS["skip_ratio"]

    async def _capture_screen(
        self, sct: mss.mss, monitor: Dict[str, int]
    ) -> Optional[NDArray[np.uint8]]:
        """
        画面キャプチャを行う

        Args:
            sct: mssのスクリーンキャプチャオブジェクト
            monitor: キャプチャする画面領域の情報

        Returns:
            Optional[NDArray[np.uint8]]: キャプチャした画像（OpenCV形式）またはNone
        """
        try:
            # スクリーンキャプチャを実行
            screenshot = sct.grab(monitor)

            # mssの出力をnumpy配列に変換
            img = np.array(screenshot)

            # BGRAからBGRに変換 (OpenCV形式)
            img_bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

            # リサイズが必要なら実行
            if self.resize_factor < 1.0:
                width = int(img_bgr.shape[1] * self.resize_factor)
                height = int(img_bgr.shape[0] * self.resize_factor)
                img_bgr = cv2.resize(img_bgr, (width, height))

            return img_bgr
        except Exception as e:
            logger.error(f"画面キャプチャ中にエラーが発生: {e}")
            return None

    async def _detect_zombies(
        self, screenshot: NDArray[np.uint8]
    ) -> Tuple[Optional[Any], int]:
        """
        スクリーンショットからゾンビを検出する

        Args:
            screenshot: 検出対象の画像（OpenCV形式）

        Returns:
            Tuple[Optional[Any], int]: (YOLOの検出結果, 検出したゾンビの数)
        """
        if self.model is None:
            return None, 0

        try:
            results = self.model(screenshot, conf=self.confidence)
            zombie_count = sum(
                1
                for r in results
                for box in r.boxes
                if int(box.cls[0]) in self.target_classes
            )
            return results, zombie_count
        except Exception as e:
            logger.error(f"ゾンビ検出に失敗: {e}")
            return None, 0

    async def _process_detection_results(
        self,
        results: Any,
        screenshot: NDArray[np.uint8],
        zombie_callback: Optional[Callable[[int, Any], Any]],
        few_zombies_callback: Optional[Callable[[int, Any], Any]],
        warning_zombies_callback: Optional[Callable[[int, Any], Any]],
    ) -> None:
        """
        検出結果を処理し、必要に応じてコールバックを呼び出す

        Args:
            results: YOLOの検出結果
            screenshot: 検出元の画像
            zombie_callback: 多数ゾンビ検出時のコールバック関数
            few_zombies_callback: 少数ゾンビ検出時のコールバック関数
            warning_zombies_callback: 警戒レベルゾンビ検出時のコールバック関数
        """
        if results is None:
            return

        count = results["detection_count"]
        resnet_info = results.get(
            "resnet_result", {"is_zombie_scene": False, "probability": 0.0}
        )
        resnet_result = resnet_info.get("is_zombie_scene", False)
        resnet_prob = resnet_info.get("probability", 0.0)

        # ① ゾンビ検出直後にログ出力を追加
        print(f"[BACKEND] ゾンビ検出数: {count}")
        if "boxes" in results:
            print(f"[BACKEND] 検出内容: {results['boxes']}")
        else:
            print("[BACKEND] 検出内容: 詳細なし")

        # ③ 閾値（confidence threshold）の確認
        print(f"[BACKEND] 現在の信頼度しきい値: {self.confidence}")

        # 検出数に応じた処理
        try:
            # 検出履歴に追加
            self.detection_history.append(count)
            self.detection_history = self.detection_history[-self.history_size :]

            # 一定数以上の連続検出があるか確認
            if (
                sum(1 for c in self.detection_history if c > 0)
                >= self.required_consecutive_detections
            ):
                # ログに記録
                from .monitor import log_zombie_detection

                log_zombie_detection(count)

                # 通知処理用の追加データ
                callback_data = {
                    "count": count,
                    "resnet_result": resnet_result,
                    "resnet_probability": resnet_prob,
                    "timestamp": results["timestamp"],
                }

                current_time = time.time()

                # 【即時プリセット】- バウンディングボックス検出時の即時反応
                # 即時プリセットはクールダウン対象外
                if count > 0:
                    try:
                        # 即時の音声反応処理
                        from ..voice.engine import react_to_zombie

                        await asyncio.to_thread(
                            react_to_zombie,
                            count,
                            0.0,
                            "immediate",
                            resnet_result,
                            resnet_prob,
                        )
                        print(f"[BACKEND] 即時プリセットボイス再生完了: {count}体")
                    except Exception as e:
                        print(f"[BACKEND] 即時プリセットボイス再生エラー: {e}")
                        logger.error(f"即時プリセットボイス再生エラー: {e}")

                # 【補足リアクション】- ResNet分類後の補足
                # 特定の条件でのみ実行（軽い遅延を追加して実行）
                if count > 0 or (resnet_result and resnet_prob > 0.7):
                    try:
                        # 補足リアクションは0.5秒の軽い遅延を追加
                        await asyncio.sleep(0.5)
                        await asyncio.to_thread(
                            react_to_zombie,
                            count,
                            0.0,
                            "followup",
                            resnet_result,
                            resnet_prob,
                        )
                        print(
                            f"[BACKEND] 補足リアクションボイス再生完了: {count}体, "
                            f"ResNet結果={resnet_result}({resnet_prob:.2f})"
                        )
                    except Exception as e:
                        print(f"[BACKEND] 補足リアクションボイス再生エラー: {e}")
                        logger.error(f"補足リアクションボイス再生エラー: {e}")

                # 【確定アラート】- 従来のコールバック処理（cooldown対象）
                # 多数のゾンビ検出時（10体以上）
                if count >= 10:
                    if (
                        current_time - self.cooldown_timestamps["many"]
                        > self.cooldown_periods["many"]
                    ):
                        if zombie_callback:
                            print(
                                f"[BACKEND] 多数のゾンビ検出コールバック呼び出し: {count}体"
                            )
                            await self._call_callback(
                                zombie_callback, count, screenshot, callback_data
                            )
                        self.cooldown_timestamps["many"] = current_time

                # 警戒レベルのゾンビ検出時（5〜9体）
                elif count >= 5:
                    if (
                        current_time - self.cooldown_timestamps["warning"]
                        > self.cooldown_periods["warning"]
                    ):
                        if warning_zombies_callback:
                            print(
                                f"[BACKEND] 警戒レベルゾンビ検出コールバック呼び出し: {count}体"
                            )
                            await self._call_callback(
                                warning_zombies_callback,
                                count,
                                screenshot,
                                callback_data,
                            )
                        self.cooldown_timestamps["warning"] = current_time

                # 少数のゾンビ検出時（1〜4体）
                elif count > 0:
                    if (
                        current_time - self.cooldown_timestamps["few"]
                        > self.cooldown_periods["few"]
                    ):
                        if few_zombies_callback:
                            print(
                                f"[BACKEND] 少数ゾンビ検出コールバック呼び出し: {count}体"
                            )
                            await self._call_callback(
                                few_zombies_callback, count, screenshot, callback_data
                            )
                        self.cooldown_timestamps["few"] = current_time

                # ResNetが検出したがYOLOが検出しなかった場合（気配感知）
                elif count == 0 and resnet_result and resnet_prob > 0.7:
                    if (
                        current_time - self.cooldown_timestamps["few"]
                        > self.cooldown_periods["few"]
                    ):
                        # 「気配」として少数ゾンビコールバックを使用
                        if few_zombies_callback:
                            print(
                                f"[BACKEND] ゾンビの気配検出コールバック呼び出し: "
                                f"ResNet確率={resnet_prob:.2f}"
                            )
                            await self._call_callback(
                                few_zombies_callback, 0, screenshot, callback_data
                            )
                        self.cooldown_timestamps["few"] = current_time
                        logger.info(f"ゾンビの気配を検出: ResNet確率={resnet_prob:.2f}")

                # デバッグ画像保存
                if self.debug_mode and count > 0:
                    self._save_detection_image(screenshot, results["boxes"])

        except Exception as e:
            logger.error(f"検出結果の処理中にエラーが発生: {e}")
            traceback.print_exc()  # フルスタックトレースを出力

    async def _call_callback(
        self,
        callback: Optional[Callable[[int, Any], Any]],
        zombie_count: int,
        screenshot: NDArray[np.uint8],
        additional_data: Any = None,
    ) -> None:
        """
        非同期でコールバック関数を呼び出す

        Args:
            callback: 呼び出すコールバック関数
            zombie_count: 検出したゾンビの数
            screenshot: 検出元の画像
            additional_data: コールバックに渡す追加データ
        """
        try:
            # コールバックのシグネチャに応じて引数を調整
            import inspect

            from .notification import notification_manager

            sig = inspect.signature(callback)

            # ゾンビ数ごとの通知タイプを決定
            if zombie_count >= 10:
                notification_type = "many"
            elif zombie_count >= 5:
                notification_type = "warning"
            elif zombie_count > 0:
                notification_type = "few"
            else:
                # ResNetが検出したが、YOLOが検出しなかった場合
                resnet_result = (
                    additional_data.get("resnet_result", False)
                    if additional_data
                    else False
                )
                if resnet_result:
                    notification_type = "presence"  # ゾンビの気配
                else:
                    notification_type = "few"  # デフォルト

            # 通知マネージャから権限を取得
            allowed, notification_id = notification_manager.try_acquire_notification(
                zombie_count, source="detector", detection_type=notification_type
            )

            if not allowed:
                logger.debug(
                    f"通知マネージャが{notification_type}タイプのコールバック実行を拒否"
                )
                return

            try:
                # コールバック関数の実行
                if len(sig.parameters) >= 3:  # additional_dataを受け取れる場合
                    result = await callback(zombie_count, screenshot, additional_data)
                else:
                    result = await callback(zombie_count, screenshot)

                logger.debug(f"ゾンビコールバック実行結果: {result}")
            finally:
                # 通知権限を解放
                notification_manager.release_notification(notification_id)

        except Exception as e:
            logger.error(f"コールバック呼び出し中にエラーが発生: {e}")

    def _save_detection_image(
        self, screenshot: NDArray[np.uint8], boxes: List[List[float]]
    ) -> str:
        """
        検出結果の画像を保存する

        Args:
            screenshot: 元の画像
            boxes: 検出されたバウンディングボックスのリスト

        Returns:
            str: 保存したファイルのパス
        """
        try:
            from datetime import datetime

            import cv2

            # タイムスタンプの取得
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # 画像のコピーを作成
            debug_img = screenshot.copy()

            # バウンディングボックスの描画
            for box in boxes:
                if "bbox" in box:
                    x1, y1, x2, y2 = box["bbox"]
                    conf = box.get("confidence", 0.0)
                    class_id = box.get("class_id", 0)

                    # 色の設定 (クラスIDによって変える)
                    color = (0, 255, 0)  # 基本は緑色
                    if class_id != 0:
                        color = (0, 0, 255)  # 人物以外は赤色

                    # バウンディングボックスと信頼度の描画
                    cv2.rectangle(debug_img, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(
                        debug_img,
                        f"{conf:.2f}",
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2,
                    )

            # 画像の保存
            detection_count = len(boxes)
            debug_path = os.path.join(
                DEBUG_DIR, f"detection_{timestamp}_{detection_count}.jpg"
            )
            cv2.imwrite(debug_path, debug_img)

            logger.debug(f"検出画像を保存しました: {debug_path}")

            return debug_path

        except Exception as e:
            logger.error(f"検出画像の保存中にエラーが発生: {e}")
            # エラーが起きても処理を続行
            return ""
