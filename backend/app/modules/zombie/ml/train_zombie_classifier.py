import argparse
import os
import random
from pathlib import Path

import matplotlib.pyplot as plt
import seaborn as sns
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


class ZombieDataset(Dataset):
    """ゾンビ分類用のデータセット"""

    def __init__(self, root_dir, transform=None, train=True, valid_split=0.2):
        """
        Args:
            root_dir: データセットのルートディレクトリ
            transform: 適用する変換
            train: 訓練データか検証データか
            valid_split: 検証データの割合
        """
        self.root_dir = Path(root_dir)
        self.transform = transform
        self.train = train
        self.valid_split = valid_split

        # クラスを取得
        self.classes = [d.name for d in self.root_dir.iterdir() if d.is_dir()]
        self.class_to_idx = {cls: i for i, cls in enumerate(self.classes)}

        # 画像パスとラベルのリストを作成
        self.images = []
        for cls in self.classes:
            class_dir = self.root_dir / cls
            for img_path in class_dir.glob("*.png"):
                self.images.append((img_path, self.class_to_idx[cls]))

        # 訓練/検証データに分割
        random.seed(42)  # 再現性のため
        random.shuffle(self.images)

        split_idx = int(len(self.images) * (1 - valid_split))
        if train:
            self.images = self.images[:split_idx]
        else:
            self.images = self.images[split_idx:]

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_path, label = self.images[idx]
        image = Image.open(img_path).convert("RGB")

        if self.transform:
            image = self.transform(image)

        return image, label


def train_model(data_path, batch_size, epochs, lr, finetune, model_save_path):
    """モデルを訓練する関数

    Args:
        data_path: データセットのパス
        batch_size: バッチサイズ
        epochs: エポック数
        lr: 学習率
        finetune: 全層を微調整するかどうか
        model_save_path: モデルを保存するパス

    Returns:
        history: 学習履歴
        best_model_path: 保存した最良モデルのパス
    """
    # GPUが利用可能かチェック
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"使用デバイス: {device}")

    # データ変換の定義
    train_transform = transforms.Compose(
        [
            transforms.Resize((256, 256)),
            transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    valid_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    # データセットの作成
    train_dataset = ZombieDataset(data_path, transform=train_transform, train=True)
    valid_dataset = ZombieDataset(data_path, transform=valid_transform, train=False)

    # データローダーの作成
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=0
    )

    valid_loader = DataLoader(
        valid_dataset, batch_size=batch_size, shuffle=False, num_workers=0
    )

    # クラス情報の保存
    classes = train_dataset.classes
    print(f"クラス: {classes}")
    print(f"訓練データ数: {len(train_dataset)}, 検証データ数: {len(valid_dataset)}")

    # ResNet18モデルの作成
    model = models.resnet18(weights="IMAGENET1K_V1")

    # 転移学習の設定
    if not finetune:
        # 特徴抽出器の層をフリーズ（全結合層のみ学習）
        for param in model.parameters():
            param.requires_grad = False

    # 最終層を置き換え（分類クラス数に合わせる）
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, len(classes))

    # モデルをデバイスに転送
    model = model.to(device)

    # 損失関数と最適化手法の設定
    criterion = nn.CrossEntropyLoss()

    if finetune:
        # 全層の微調整
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    else:
        # 最後の全結合層のみ学習
        optimizer = torch.optim.Adam(model.fc.parameters(), lr=lr)

    # 学習率スケジューラ
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=2, verbose=True
    )

    # 学習履歴
    history = {"train_loss": [], "train_acc": [], "valid_loss": [], "valid_acc": []}
    best_valid_acc = 0
    best_model_path = None

    # 予測ラベルと真のラベルを保存する配列
    all_preds = []
    all_labels = []

    # 学習ループ
    print(f"開始: {epochs}エポックの学習を開始します...")
    for epoch in range(epochs):
        # 訓練フェーズ
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0

        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)

            # 勾配をゼロにリセット
            optimizer.zero_grad()

            # 順伝播、逆伝播、最適化
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            # 統計情報の更新
            train_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs, 1)
            train_total += labels.size(0)
            train_correct += (predicted == labels).sum().item()

        # エポックごとの訓練損失と精度
        train_loss = train_loss / train_total
        train_acc = train_correct / train_total

        # 検証フェーズ
        model.eval()
        valid_loss = 0
        valid_correct = 0
        valid_total = 0

        # 最終エポックの場合、予測と真のラベルを保存
        is_final_epoch = epoch == epochs - 1
        if is_final_epoch:
            all_preds = []
            all_labels = []

        with torch.no_grad():
            for inputs, labels in valid_loader:
                inputs, labels = inputs.to(device), labels.to(device)

                # 順伝播
                outputs = model(inputs)
                loss = criterion(outputs, labels)

                # 統計情報の更新
                valid_loss += loss.item() * inputs.size(0)
                _, predicted = torch.max(outputs, 1)
                valid_total += labels.size(0)
                valid_correct += (predicted == labels).sum().item()

                # 最終エポックなら予測と真のラベルを保存
                if is_final_epoch:
                    all_preds.extend(predicted.cpu().numpy())
                    all_labels.extend(labels.cpu().numpy())

        # エポックごとの検証損失と精度
        valid_loss = valid_loss / valid_total
        valid_acc = valid_correct / valid_total

        # 学習率の調整
        scheduler.step(valid_loss)

        # 結果の表示
        print(
            f"Epoch {epoch + 1}/{epochs} | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
            f"Valid Loss: {valid_loss:.4f} | Valid Acc: {valid_acc:.4f}"
        )

        # 履歴の更新
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["valid_loss"].append(valid_loss)
        history["valid_acc"].append(valid_acc)

        # 最良モデルの保存
        if valid_acc > best_valid_acc:
            best_valid_acc = valid_acc
            best_model_path = str(model_save_path / "zombie_classifier.pt")
            os.makedirs(model_save_path, exist_ok=True)

            # モデルの状態を保存
            state = {
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "valid_acc": valid_acc,
                "classes": classes,
                "epoch": epoch,
            }
            torch.save(state, best_model_path)
            print(f"モデルを保存しました: {best_model_path}")

    # 最終的な分類結果のレポート作成
    if all_preds and all_labels:
        print("\n分類レポート:")
        report = classification_report(
            all_labels, all_preds, target_names=classes, digits=4
        )
        print(report)

        # 混同行列の作成
        cm = confusion_matrix(all_labels, all_preds)
        plt.figure(figsize=(8, 6))
        sns.heatmap(
            cm,
            annot=True,
            fmt="d",
            cmap="Blues",
            xticklabels=classes,
            yticklabels=classes,
        )
        plt.title("混同行列")
        plt.ylabel("真のラベル")
        plt.xlabel("予測ラベル")
        plt.tight_layout()

        # 現在のスクリプトのパスを取得
        current_file = Path(__file__)
        confusion_matrix_path = current_file.parent / "confusion_matrix.png"
        plt.savefig(confusion_matrix_path)
        print(f"混同行列を保存しました: {confusion_matrix_path}")

    return history, best_model_path


def plot_training_history(history, save_path):
    """学習履歴をプロットする関数

    Args:
        history: 学習履歴
        save_path: 保存先のパス
    """
    plt.figure(figsize=(12, 4))

    # 損失の推移
    plt.subplot(1, 2, 1)
    plt.plot(history["train_loss"], label="訓練損失")
    plt.plot(history["valid_loss"], label="検証損失")
    plt.xlabel("エポック")
    plt.ylabel("損失")
    plt.title("損失の推移")
    plt.legend()
    plt.grid(True)

    # 精度の推移
    plt.subplot(1, 2, 2)
    plt.plot(history["train_acc"], label="訓練精度")
    plt.plot(history["valid_acc"], label="検証精度")
    plt.xlabel("エポック")
    plt.ylabel("精度")
    plt.title("精度の推移")
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
    print(f"学習履歴を保存しました: {save_path}")


def main():
    """メイン関数"""
    # コマンドライン引数のパース
    parser = argparse.ArgumentParser(description="ResNet18ベースのゾンビ分類器の学習")

    parser.add_argument(
        "--data_path",
        type=str,
        default="data/datasets/zombie_classifier",
        help="データセットのディレクトリパス",
    )
    parser.add_argument("--batch_size", type=int, default=32, help="バッチサイズ")
    parser.add_argument("--epochs", type=int, default=30, help="訓練エポック数")
    parser.add_argument("--lr", type=float, default=1e-4, help="学習率")
    parser.add_argument(
        "--finetune",
        action="store_true",
        help="全層を微調整する（指定しない場合は全結合層のみ学習）",
    )

    args = parser.parse_args()

    # モデルの保存先
    # rootディレクトリからの相対パスでモデル保存先を設定
    model_save_path = Path("backend/models")
    model_save_path.mkdir(exist_ok=True)

    print(f"データパス: {args.data_path}")
    print(f"モデル保存先: {model_save_path}")
    print(f"バッチサイズ: {args.batch_size}")
    print(f"エポック数: {args.epochs}")
    print(f"学習率: {args.lr}")
    print(f"微調整モード: {args.finetune}")

    # モデルの訓練
    history, best_model_path = train_model(
        args.data_path,
        args.batch_size,
        args.epochs,
        args.lr,
        args.finetune,
        model_save_path,
    )

    if best_model_path:
        print(f"最良モデルの保存先: {best_model_path}")

        # 学習履歴の可視化
        current_file = Path(__file__)
        history_plot_path = current_file.parent / "training_history.png"
        plot_training_history(history, history_plot_path)


if __name__ == "__main__":
    main()
