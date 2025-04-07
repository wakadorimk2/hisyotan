# image_sorter.py
import shutil
from pathlib import Path

import cv2

INPUT_DIR = Path("runs/detect/predict/crops")
ZOMBIE_DIR = Path("backend/data/datasets/zombie_classifier/train/zombie")
NON_ZOMBIE_DIR = Path("backend/data/datasets/zombie_classifier/train/non_zombie")
UNKNOWN_DIR = Path(
    "backend/data/datasets/zombie_classifier/train/unknown"
)  # 再仕分けでもう一度入れ直すとき用

# 履歴スタックで戻れるように
history = []


def move_file(file_path, dest_dir):
    dest_dir.mkdir(parents=True, exist_ok=True)
    target_path = dest_dir / file_path.name
    shutil.move(str(file_path), str(target_path))
    history.append((target_path, file_path))  # for undo


def undo_last():
    if history:
        dest_path, original_path = history.pop()
        shutil.move(str(dest_path), str(original_path))


def main():
    files = sorted(INPUT_DIR.glob("*.jpg")) + sorted(INPUT_DIR.glob("*.png"))
    index = 0

    while index < len(files):
        img_path = files[index]
        img = cv2.imread(str(img_path))
        if img is None:
            index += 1
            continue

        cv2.imshow("Image Sorter (Z:ゾンビ, X:非ゾンビ, U:不明, ←:戻る, ESC:終了)", img)
        key = cv2.waitKey(0)

        if key == 27:  # ESC
            break
        elif key == ord("z"):
            move_file(img_path, ZOMBIE_DIR)
        elif key == ord("x"):
            move_file(img_path, NON_ZOMBIE_DIR)
        elif key == ord("u"):
            move_file(img_path, UNKNOWN_DIR)
        elif key == 8:  # Backspace
            undo_last()
            index = max(0, index - 2)  # 1つ前に戻ってやり直す
        else:
            print("未対応キー:", key)
            continue

        index += 1

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
