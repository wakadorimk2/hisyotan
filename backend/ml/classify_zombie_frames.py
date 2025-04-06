#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ゾンビ画像分類ツール 🧟‍♂️✨

7 Days to Dieのゲームフレームをゾンビ/非ゾンビに分類するスクリプト
ResNet18ベースの学習済みモデルを使用
"""

import os
import sys
import shutil
from pathlib import Path
import argparse
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import tqdm
import time

# 分類カテゴリ
CATEGORIES = ['non_zombie', 'zombie']
CONFIDENCE_THRESHOLD = 0.7  # 信頼度しきい値

def load_model(path):
    """
    PyTorchモデルを読み込む関数
    
    Args:
        path: モデルファイルへのパス
        
    Returns:
        学習済みモデル
    """
    # ResNet18ベースのモデルを作成
    model = models.resnet18(pretrained=False)
    model.fc = nn.Linear(model.fc.in_features, 2)  # 2クラス分類
    
    # モデルの重みを読み込み
    model.load_state_dict(torch.load(path, map_location='cpu'))
    model.eval()  # 評価モード
    return model

def process_image(image_path, transform):
    """
    画像を前処理する関数
    
    Args:
        image_path: 画像ファイルへのパス
        transform: 適用する変換
        
    Returns:
        前処理済みの画像テンソル
    """
    image = Image.open(image_path).convert('RGB')
    return transform(image).unsqueeze(0)  # バッチ次元を追加

def classify_images(input_dir, output_base_dir, model_path, confidence_threshold=CONFIDENCE_THRESHOLD):
    """
    ディレクトリ内の画像を分類する関数
    
    Args:
        input_dir: 入力画像のディレクトリパス
        output_base_dir: 出力先の基準ディレクトリパス
        model_path: モデルファイルへのパス
        confidence_threshold: 分類信頼度のしきい値
    
    Returns:
        各カテゴリに分類された画像の数
    """
    # 出力ディレクトリを作成
    output_dirs = {
        'zombie': Path(output_base_dir) / 'zombie',
        'non_zombie': Path(output_base_dir) / 'non_zombie',
        'unknown': Path(output_base_dir) / 'unknown'
    }
    
    for dir_path in output_dirs.values():
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"✅ 出力ディレクトリを作成しました: {dir_path}")
    
    # モデルを読み込む
    print(f"🔄 モデルを読み込んでいます: {model_path}")
    model = load_model(model_path)
    
    # 画像変換の定義
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    # 入力ディレクトリ内の全画像を列挙
    image_paths = list(Path(input_dir).glob('*.jpg')) + list(Path(input_dir).glob('*.png'))
    print(f"🖼️ 処理する画像の総数: {len(image_paths)}")
    
    # 分類結果のカウンター
    results = {'zombie': 0, 'non_zombie': 0, 'unknown': 0}
    
    # 進捗バー表示用
    for img_path in tqdm.tqdm(image_paths):
        # 画像を前処理
        img_tensor = process_image(img_path, transform)
        
        # 推論実行
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = torch.nn.functional.softmax(outputs, dim=1)[0]
            confidence, predicted = torch.max(probs, 0)
            
            # 予測クラスを取得
            predicted_class = CATEGORIES[predicted.item()]
            confidence_val = confidence.item()
            
            # 信頼度に基づいて出力先を決定
            if confidence_val >= confidence_threshold:
                dest_dir = output_dirs[predicted_class]
                results[predicted_class] += 1
            else:
                dest_dir = output_dirs['unknown']
                results['unknown'] += 1
            
            # 画像をコピー
            dest_path = dest_dir / img_path.name
            shutil.copy2(img_path, dest_path)
    
    # 結果を表示
    print("\n🏁 分類が完了しました！")
    print(f"🧟‍♂️ ゾンビと判定: {results['zombie']}枚")
    print(f"👨‍🌾 非ゾンビと判定: {results['non_zombie']}枚")
    print(f"❓ 不明と判定: {results['unknown']}枚")
    
    return results

def main():
    """メイン処理"""
    parser = argparse.ArgumentParser(description='7 Days to Dieのゲームフレームをゾンビ/非ゾンビに分類します')
    parser.add_argument(
        '--input_dir', '-i',
        default='backend/data/datasets/frames/video_001',
        help='入力画像のディレクトリパス'
    )
    parser.add_argument(
        '--output_dir', '-o',
        default='backend/data/datasets/classified',
        help='出力先の基準ディレクトリパス'
    )
    parser.add_argument(
        '--model_path', '-m',
        default='backend/models/zombie_classifier_state.pth',
        help='モデルファイルへのパス'
    )
    parser.add_argument(
        '--threshold', '-t',
        type=float, 
        default=CONFIDENCE_THRESHOLD,
        help='分類信頼度のしきい値'
    )
    
    args = parser.parse_args()
    
    # 開始時間
    start_time = time.time()
    
    # 分類処理を実行
    classify_images(
        args.input_dir,
        args.output_dir,
        args.model_path,
        args.threshold
    )
    
    # 実行時間を表示
    elapsed_time = time.time() - start_time
    print(f"⏱️ 実行時間: {elapsed_time:.2f} 秒")

if __name__ == '__main__':
    main() 