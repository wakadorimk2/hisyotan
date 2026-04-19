# 秘書たん (chill-assistant)

## 🐾 はじめに

画面のすみに、ふにゃっと秘書たん。  
作業中にあなたの画面を見守って、ときどき声をかけてくれるローカル AI 秘書アシスタント。

2026年4月、ゲーム専用（7 Days to Die + YOLO ゾンビ検出）から **汎用相棒 × ローカル Vision LLM** へ路線転換中 🐈️✨

---

## 🔄 リブートロードマップ (2026年4月〜)

このプロジェクトは現在、旧 YOLO/zombie 検出パイプラインを破棄し、ローカル Vision LLM (Qwen3-VL-8B + LM Studio) ベースの watcher / companion モジュールに作り直している最中。

| Step | 内容 | 状態 |
|---|---|---|
| Step 0 | LM Studio + Qwen3-VL-8B の生存確認 PoC | ✅ 完了 |
| Step 1 | YOLO/zombie 系破棄・依存整理・疎通確認 | ✅ 完了 (2026-04-19) |
| Step 2 | watcher モジュール新規実装 (画面キャプチャ + 差分検知) | 🔜 次 |
| Step 3 | companion モジュール新規実装 (LM Studio 連携・発話生成) | 📝 予定 |
| Step 4 | Step 2+3 の統合・発話体験チューニング | 📝 予定 |
| Step 5 | 運用機能 (時間帯ミュート / 設定 UI / 統計) 追加 | 📝 予定 |

詳細は [`docs/reboot/`](docs/reboot/) 配下を参照:
- [`00_survey_report.md`](docs/reboot/00_survey_report.md) — 旧コードの全体調査
- [`01_module_inventory.md`](docs/reboot/01_module_inventory.md) — モジュール棚卸し
- [`02_migration_plan_draft.md`](docs/reboot/02_migration_plan_draft.md) — 移行プラン素案
- [`03_open_questions.md`](docs/reboot/03_open_questions.md) — 未解決の判断ポイント
- [`legacy_snippets.md`](docs/reboot/legacy_snippets.md) — Step 2 で移植するレガシースニペット
- [`step1_log.md`](docs/reboot/step1_log.md) — Step 1 作業ログ

---

## 🧭 構成ガイド

### 📦 バックエンド (FastAPI + pydantic-settings)

- `app/config/` — 設定管理 (`pydantic_settings.BaseSettings`)
- `app/core/` — FastAPI アプリ生成、`asynccontextmanager lifespan` によるライフサイクル管理、ロガー
- `app/modules/voice/` — VOICEVOX 連携、音声合成・再生・キャッシュ、プリセット感情
- `app/modules/emotion/` — 感情推定 (今後拡張予定)
- `app/modules/ocr/` — 画面内テキストの OCR (pytesseract ベース)
- `app/modules/funya_watcher/` — キー入力アイドル検知 (pynput、ふにゃモード発動)
- `app/routers/` — API エンドポイント定義 (voice / health / funya / ocr / websocket)
- `app/services/` — 音声/状態管理サービス
- `app/ws/` — WebSocket 接続管理と通知ブロードキャスト

### 🖥️ フロントエンド (Vite + Electron)

- `src/core/` — API / ロガーなど共通ユーティリティ
- `src/emotion/` — 感情推定、SpeechManager、VOICEVOX クライアント、音声リアクション
- `src/main/` — Electron 起動・ウィンドウ管理
- `src/renderer/` — レンダリング
- `src/ui/` — 吹き出し UI、立ち絵、アニメーション
- `src/features/` — 肉球ボタン等の UI インタラクション
- `src/shared/` — 共通ハンドラ (マウスイベント等)

---

## ✨ 主な特徴

- **完全ローカル**: LLM 本家 API 呼び出しなし。Qwen3-VL-8B を LM Studio 経由で叩く
- **秘書たん口調**: 40 字以内の日本語、やさしく寄り添う発話
- **VOICEVOX 音声合成**: 感情プリセット別のピッチ/イントネーション制御
- **透過ウィンドウ**: Electron の frameless + transparent で画面端に常駐
- **ふにゃモード**: キー入力なし 30 秒でふにゃっと寝る

---

## 🔧 インストール & 起動

### 前提
- Node.js (v18+ 推奨) と pnpm
- Python 3.12 系
- VOICEVOX (ローカルエンジン)
- LM Studio (Step 3 以降で使用)

### セットアップ

```bash
# クローン
git clone https://github.com/youraccount/chill-assistant.git
cd chill-assistant

# Python 仮想環境 (3.12)
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# フロントエンド
pnpm install
```

### 起動

```bash
# バックエンド単体 (port 8000 が iphlpsvc で塞がれている場合は 8001 を指定)
pnpm run dev:backend
# もしくは: .venv\Scripts\python.exe -m uvicorn backend.main:app --port 8001

# Electron 起動
pnpm run dev:electron
```

注記: Windows で Hyper-V / WSL2 を有効にしていると、IP Helper (`iphlpsvc`) が 8000 / 8080 / 5173 などの定番ポートを LISTEN してバックエンドが bind 失敗することがある。代替ポートで起動するか、Hyper-V を切る運用で回避する。詳細は [`docs/reboot/03_open_questions.md`](docs/reboot/03_open_questions.md) §F-1 を参照。

---

## 💻 基本の使い方

1. 起動するとふにゃ秘書たんが画面端に現れる
2. 肉球ボタン左クリック → ランダム発話
3. 肉球ボタン右クリック → 設定パネル
4. 立ち絵はドラッグでウィンドウ移動

---

## 🗣 VOICEVOX 連携

- `backend/app/modules/voice/` が VOICEVOX に音声合成リクエストを送る
- 感情プリセット (通常 / にこにこ / 警戒・心配 / びっくり / やさしい / 眠そう / 不安・怯え / 疑問・思案) でピッチ / イントネーション / 速度を切替
- `voicevox_starter.py` が起動時に `%LOCALAPPDATA%\Programs\VOICEVOX\vv-engine\run.exe` 等のデフォルトパスから自動起動

---

## 🛠 開発者向け

### 設定管理 (pydantic-settings)

`backend/app/config/settings.py` の `Settings` クラスが `BaseSettings` ベース。`.env` の環境変数を自動読み込み。`get_settings()` は `@lru_cache` でシングルトン化。

### ライフサイクル

`backend/app/core/app.py` で `asynccontextmanager` lifespan を FastAPI に渡す。`startup_handler.on_startup` で VOICEVOX 起動・FunyaWatcher 初期化、`shutdown_handler.on_shutdown` でクリーンアップ。

### WebSocket

`backend/app/ws/manager.py` の `ConnectionManager.broadcast()` で全クライアント通知、`send_notification()` で型付きトーストを送信。フロントエンドは `/ws` に接続、`ping` / `status` コマンドを受け付ける。

---

## 📝 ライセンス

MIT License (詳細は `LICENSE` 参照)

---

## 🤝 貢献

- Issue / Pull Request 歓迎
- 世界観（やさしく寄り添う秘書たん）を壊さないやさしい雰囲気でお願いします 🐈️✨
