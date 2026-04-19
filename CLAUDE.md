# CLAUDE.md

## 振る舞いのガイドライン
・やさしく寄り添う秘書／パートナー
・語尾「〜だよ」「〜なの」、絵文字は1〜2個まで 🐈️
・ユーザーを「わかどりちゃん」と呼ぶ

---

## プロジェクトの現状 (2026-04-19)

- 2026年4月にゲーム専用（7DTD + YOLO）から汎用相棒（ローカル Vision LLM）へ路線転換中
- **Step 0 PoC 完了**: LM Studio + Qwen3-VL-8B (Q4_K_M) で秘書たん口調 + 40字以内発話確認済み
- **Step 1 完了 (2026-04-19)**: YOLO / zombie 破棄、依存整理、pydantic-settings + FastAPI lifespan 移行、backend + WebSocket 疎通確認
- 次は Step 2: watcher モジュール新規実装（画面キャプチャ + 差分検知）

---

## 温存する資産（壊さないで）

- `backend/app/modules/voice/` — VOICEVOX 連携・エンジン・プリセット感情・キャッシュ
- `backend/app/modules/funya_watcher/` — pynput ベースのキー入力アイドル検知
- `backend/app/modules/ocr/` — pytesseract ベースの OCR
- `backend/app/ws/manager.py` — WebSocket broadcast パターン（Step 2 の watcher でも使う）
- `backend/app/services/funya_state.py` — ふにゃ状態サービス
- 立ち絵 (`secretary_*.png`) / 吹き出し UI / pawButton のランダム発話
- `docs/reboot/legacy_snippets.md` — Step 2 移植用の mss キャプチャループ + broadcast パターン

---

## やってはいけないこと

- **外部 LLM API (OpenAI / Anthropic) の本家呼び出し** — 完全ローカル厳守。`backend/app/modules/llm/` は Step 1 で削除済み
- **PyTorch / ultralytics / YOLO の再導入** — リブートで破棄済み (easyocr が副次的に torch を入れるのは F-2 で認知済みの既知事象)
- **pydantic v1 形式の `from pydantic import BaseSettings`** — pydantic-settings 2 系の `SettingsConfigDict` を使う
- **`@app.on_event("startup"/"shutdown")`** — `asynccontextmanager` lifespan を使う
- **`/api/voice/react_to_zombie` / `/api/zombie_alert` / `start_monitoring` / `stop_monitoring` WebSocket コマンド** — 全て Step 1 で削除。復活させない

---

## 技術スタック

- バックエンド: FastAPI 0.115+, pydantic-settings 2.x, Python 3.12
- LLM: Qwen3-VL-8B Instruct (Q4_K_M) via LM Studio (OpenAI 互換 API, `http://localhost:1234/v1`)
- 音声合成: VOICEVOX (`http://127.0.0.1:50021`)
- フロントエンド: Electron + Vite + pnpm
- OS: Windows 11 Pro, CUDA 12.6, RTX 5070 12GB

---

## 既知の地雷

- **ポート 8000 / 8080 / 5173 が iphlpsvc に握られる** (Hyper-V / WSL2 環境) → 8001 や 5174 で回避 ([docs/reboot/03_open_questions.md](docs/reboot/03_open_questions.md) §F-1)
- **frontend に zombie 文字列が残存** (logZombieWarning, reactToZombie, CSS .zombie-warning など) → 実害なし、Step 2/3 で機会ごと一般化 (§F-3)
- **pnpm 未インストール環境** → `npm install -g pnpm` でセットアップ (§F-4)
- **立ち絵アセットの git 追跡状況不明** → Step 2 着手前に実体と運用方針を確定 (§F-5)

---

## 現在のマイルストーン

- **Step 2**: `backend/app/modules/watcher/` 新規実装
  - 画面キャプチャ + フレーム差分検知 (mss + opencv-python)
  - プロセス名フィルタ (7DTD 優先、他ゲーム拡張可能)
  - `adaptive_interval` は CPU 負荷 + LLM レイテンシ両方を考慮
  - 結果を WebSocket で broadcast
  - 移植素材: `docs/reboot/legacy_snippets.md`
- **Step 3**: `backend/app/modules/companion/` 新規実装
  - LM Studio の OpenAI 互換 API 経由で Qwen3-VL-8B を叩く
  - システムプロンプト + few-shot 5 例で秘書たん口調維持
  - Context 4K 固定、履歴ゼロ（VRAM 運用のため）
  - watcher のイベントを受けて 40 字以内の発話生成 → speech_bus へ