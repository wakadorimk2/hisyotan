# キャラクター差分管理システム

秘書たんの表情・ポーズなどの差分を柔軟に管理するシステムです。タグベースの構造で将来的なLive2D/3Dモデル対応も視野に入れた設計になっています。

## 機能概要

- **タグベースの差分管理**
  - 表情（expression）、ポーズ（pose）、エフェクト/小物（extras）の3カテゴリでタグ管理
  - 複数タグの組み合わせにも対応
  - 差分辞書（JSON）で定義

- **柔軟な表示モード**
  - 静的画像モード（現在）
  - Live2Dモード（将来対応）
  - 3Dモデル/VRMモード（将来対応）

- **既存システムとの互換性**
  - emotionalBridgeで既存のexpressionManagerとシームレスに連携

## 初期化方法

アプリケーション起動時に感情システム全体を初期化:

```javascript
import { initEmotionSystem } from '@emotion/index.js';

// アプリ起動時に実行
initEmotionSystem();
```

## 基本的な使い方

### タグベースの表情設定

```javascript
import { emotionalBridge } from '@emotion/index.js';

// 表情タグを設定
emotionalBridge.setExpressionByTag('HAPPY');

// ポーズタグを設定
emotionalBridge.setPose('SEIZA');

// エフェクト/小物タグを追加
emotionalBridge.addExtra('BLUSH');

// 複数のエフェクトを一度に設定
emotionalBridge.setTag('extras', ['BLUSH', 'SWEAT']);

// 現在のタグを確認
const currentTags = emotionalBridge.getCurrentTags();
console.log(currentTags);
// 出力例: { expression: 'HAPPY', pose: 'SEIZA', extras: ['BLUSH', 'SWEAT'] }
```

### 組み合わせ表情の設定

事前に定義された組み合わせを使用:

```javascript
// 「眠そうな表情＋睡眠エフェクト」の組み合わせを設定
emotionalBridge.setCombination('SLEEPY_WITH_ZZZ');

// 「正座で嬉しそうな表情」の組み合わせを設定
emotionalBridge.setCombination('HAPPY_SEIZA');
```

### 便利なヘルパー関数

簡単に使えるファサード関数:

```javascript
import { expressWithTags } from '@emotion/index.js';

// タグベースの表情システムを使用して表情変更とセリフ表示
expressWithTags(
  'SURPRISED',      // 表情タグ
  'ARMSCROSSED',    // ポーズタグ
  'SWEAT',          // エフェクト/小物タグ
  'えっ！？なになに？' // 表示するメッセージ（オプション）
);
```

## 定義済みのタグ一覧

### 表情タグ（expressions）

- `NORMAL` - 通常表情
- `HAPPY` - 嬉しい表情
- `SURPRISED` - 驚いた表情
- `SERIOUS` - 真面目な表情
- `SLEEPY` - 眠そうな表情
- `RELIEVED` - 安心した表情
- `SMILE` - 微笑んだ表情

### ポーズタグ（poses）

- `NEUTRAL` - 通常のポーズ
- `ARMSCROSSED` - 腕を組んだポーズ
- `SEIZA` - 正座のポーズ

### エフェクト/小物タグ（extras）

- `SFX_ZZZ` - 睡眠エフェクト
- `BLUSH` - 頬を赤らめるエフェクト
- `SWEAT` - 汗エフェクト

### 定義済み組み合わせ（combinations）

- `SLEEPY_WITH_ZZZ` - 眠そうな表情＋睡眠エフェクト
- `HAPPY_SEIZA` - 正座で嬉しそうな表情

## 差分辞書のカスタマイズ

`characterDictionary.json` を編集することで、独自の差分やタグを追加できます。

### ファイル名の命名規則

今後の差分追加時の命名規則:

```
secretary_<expression>[_<pose>][_<extras>].png
```

例:
- `secretary_happy.png` (嬉しい表情)
- `secretary_normal_arms.png` (通常表情＋腕組み)
- `secretary_sleepy_sfx_zzz.png` (眠そうな表情＋睡眠エフェクト)

## Live2D/3Dモデル対応

差分辞書には既にLive2D/VRMパラメータの項目があり、将来的な拡張に備えています。実装時はモード切替だけで対応できる設計です。

```javascript
// モード切替
import { emotionalBridge, DisplayMode } from '@emotion/index.js';

// Live2Dモードに切り替え
emotionalBridge.setDisplayMode(DisplayMode.LIVE2D);

// 3Dモデルモードに切り替え
emotionalBridge.setDisplayMode(DisplayMode.VRM);
``` 