import random
import shutil
from pathlib import Path

# -------------------------
# 設定
# -------------------------
val_ratio = 0.2
random.seed(42)

image_dir = Path("backend/data/datasets/labeled/images")
label_dir = Path("backend/data/datasets/labeled/labels/train")
output_root = Path("backend/data/datasets/yolov8")

# 出力ディレクトリ作成
for split in ["train", "val"]:
    (output_root / "images" / split).mkdir(parents=True, exist_ok=True)
    (output_root / "labels" / split).mkdir(parents=True, exist_ok=True)

# -------------------------
# データ収集
# -------------------------
all_images = list(image_dir.glob("*.jpg"))
zombie_imgs = [img for img in all_images if (label_dir / f"{img.stem}.txt").exists()]
nonzombie_imgs = [
    img for img in all_images if not (label_dir / f"{img.stem}.txt").exists()
]


# -------------------------
# 分割関数
# -------------------------
def split_dataset(images, val_ratio):
    random.shuffle(images)
    val_count = int(len(images) * val_ratio)
    return images[val_count:], images[:val_count]


# -------------------------
# データ分割
# -------------------------
z_train, z_val = split_dataset(zombie_imgs, val_ratio)
nz_train, nz_val = split_dataset(nonzombie_imgs, val_ratio)


# -------------------------
# コピー関数
# -------------------------
def copy_items(images, split):
    for img in images:
        # 画像
        shutil.copy(img, output_root / "images" / split / img.name)

        # ラベル
        label_path = label_dir / f"{img.stem}.txt"
        target_label = output_root / "labels" / split / f"{img.stem}.txt"

        if label_path.exists():
            shutil.copy(label_path, target_label)
        else:
            target_label.touch()  # 空ファイル作成


# -------------------------
# コピー実行
# -------------------------
copy_items(z_train + nz_train, "train")
copy_items(z_val + nz_val, "val")

# -------------------------
# 結果出力
# -------------------------
print("📦 分割完了！")
print(f"Train: ゾンビ {len(z_train)} / 非ゾンビ {len(nz_train)}")
print(f"Val  : ゾンビ {len(z_val)} / 非ゾンビ {len(nz_val)}")
print(f"合計: 画像 {len(all_images)} 枚")
