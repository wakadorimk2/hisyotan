# Step 1 作業ログ

**実施日**: 2026-04-19
**ブランチ**: `poc/runtime-check`
**目的**: YOLO / zombie 検出系の完全削除、依存整理、pydantic-settings + lifespan 移行、起動疎通確認

---

## 成果サマリ

- backend の zombie 参照ゼロ達成（`grep -r "zombie" backend/ --include="*.py"` で 0 件）
- YOLO / ultralytics 参照ゼロ達成
- Python 3.12.10 の新 venv で `pip install -r requirements.txt` 完走
- `pydantic_settings.BaseSettings` + `asynccontextmanager` lifespan 移行完了、deprecation warning なし
- uvicorn 起動 → `/`, `/docs`, `/openapi.json`, WebSocket 全応答確認 (ポート 8001 で実施)
- 178MB (trained_models/\*.pth) + 学習資産 + 死んだコード合計 1300+ 行を削除

---

## 時系列

### 18:20〜18:30 - Phase 1 調査

- 3 エージェント並列で backend / frontend / docs を探索
- 仕様書と実態の乖離発見:
  - `requirements.txt` はルート直下、`backend/requirements.txt` は存在せず
  - `settings.py` は pydantic 未使用の生シングルトン（仕様書の BaseSettings 前提と相違）
  - `.python-version` = 3.10.13 (実機には未インストール、実行環境は 3.14.3)
  - `pawButtonHandler` のホルドモードは実処理不在
  - `@app.on_event` は `main.py` ではなく `core/app.py:121-134`
  - `trained_models/*.pth` が 134MB + 44MB 実在（仕様書言及なし）
- ユーザー確認: settings.py は pydantic-settings に全面移行 / Python は 3.12 / .pth は全部削除

### 18:30〜18:35 - Task 1-A (commit: c180501)

- `docs/reboot/legacy_snippets.md` 作成
- WS broadcast パターン (ConnectionManager.broadcast, send_notification, zombie_warning_data 構造) を抜粋保存
- mss キャプチャループ + adaptive_interval 構造 (`_monitor_loop`, `_adjust_performance_settings`, `_capture_screen`) を抜粋保存

### 18:35〜18:42 - Task 1-B (commit: 7c8a842 に統合)

削除したもの:
- `backend/app/modules/zombie/` (11 ファイル + `ml/` サブ)
- `backend/app/modules/llm/` (`__init__.py` + `openai_client.py`)
- `backend/app/modules/voice/react.py`
- `backend/ml/` (9 ファイル)
- `backend/trained_models/` (zombie_classifier.pth + state.pth + zombie_detector_v2/24 ファイル)
- `backend/debug_start.py` (YOLO デバッグ専用エントリポイント)
- `backend/test_api.py` (手動テストスクリプト、削除 API に依存)
- `backend/app/routers/events.py` (zombie_detected イベント専用)
- `backend/app/routers/settings.py` (`get_zombie_config` 専用)
- `backend/app/core/init.py` (使われていない古い create_application、削除した events.py 参照)

調査で新たに発覚した削除対象が5つ。仕様書より掘り下げた。

### 18:42〜18:43 - Task 1-C (commit: 7c8a842)

修正したもの:
- `main.py`: `ZOMBIE_DETECTION_ENABLED` 削除
- `events/startup_handler.py`: start_zombie_monitoring 呼び出し + 関数定義削除
- `events/shutdown_handler.py`: stop_zombie_monitoring 呼び出し + 関数定義削除
- `routers/websocket.py`: 全面書き換え（start_monitoring/stop_monitoring コマンド完全削除、is_monitoring_started 廃止）
- `routers/voice.py`: react_to_zombie import + エンドポイント削除
- `routers/__init__.py`: settings_router export 削除
- `modules/voice/__init__.py`: react モジュール export 削除
- `core/app.py`: register_routers から settings_router 削除
- `schemas/events.py`: ZombieDetectedEvent / ThreatLevel / EventType.ZOMBIE_DETECTED 削除
- `schemas/__init__.py`: 対応 export 削除
- `services/voice.py`: get_random_dialogue / play_dialogue (zombie_detection.json 依存) 削除
- `ws/manager.py`: コメント内の zombie 言及を一般化
- `data/dialogues/zombie_detection.json` 削除

追加変更: -669 行 / +10 行。

### 18:43〜18:44 - Task 2 (commit: 1e95864)

- `py -3.12 --version` → 3.12.10 確認 (3.14.3 がデフォルト、3.10 は未インストール)
- `.python-version` を `3.10.13` → `3.12.10` 変更
- `requirements.txt` 書き換え:
  - 削除: `ultralytics`, `torch`, `pyautogui`
  - 追加: `pydantic-settings`, `openai`, `aiohttp` (既存 voicevox_starter で暗黙依存)
  - 緩い範囲 pin (`>=x,<y` 形式) に変更
- `py -3.12 -m venv .venv` で新規作成
- `pip install --upgrade pip` (25.0.1 → 26.0.1)
- `pip install -r requirements.txt` → 全インストール成功

問題:
- **easyocr が torch/torchvision を副次依存として持ってくる** → 仕様書 DoD「torch が空」は満たせず、F-2 として 03_open_questions に記録

### 18:44〜18:45 - Task 3 (commit: 8f4e68b)

- `config/settings.py` を全面書き換え:
  - `BaseSettings` (from pydantic_settings) + `SettingsConfigDict` 形式
  - `VOICE_PRESETS` / `PRESET_SOUNDS` は ClassVar に
  - `_ensure_directories` を `model_post_init` から呼ぶ
  - `get_settings` に `@lru_cache` 適用
  - zombie 関連 (ZOMBIE_DETECTION, CALLBACK_COOLDOWN.zombie_*, load_dialogues のデフォルト引数) を完全除去
  - `VOICEVOX_ENGINE_PATH` のデフォルトを空に変更 (default_paths 探索に委譲)
- `core/app.py` を `asynccontextmanager` lifespan 形式に書き換え、`register_event_handlers` を廃止
- `modules/voice/voicevox_starter.py` の `default_paths` 先頭に `%LOCALAPPDATA%\Programs\VOICEVOX\vv-engine\run.exe` を追加、`os.path.expandvars` でラップ

import テスト: `from backend.app.core import create_application; app = create_application()` → 警告なく通過。

### 18:45〜18:46 - Task 4 (commit: 20f1134)

- `frontend/src/` の zombie 参照を確認 → case-insensitive grep で多数発見
- 実害のある dead code (`contextMenuHandler.js`): 存在しない `@core/websocketHandler.js` から `sendTestZombieWarning`, `sendTestDetection` を import していた。`setupContextMenuEvents` / `showMultipleSettings` ともどこからも呼ばれていない。右クリックメニュー処理は既に `setupMouseEvents.js` に移行済み → ファイルごと削除
- 他の残存 zombie 文字列 (`logZombieWarning`, `reactToZombie`, CSS クラスなど) は動作に実害なし。F-3 として 03_open_questions に記録、Step 2/3 で一般化

### 18:46〜18:48 - Task 5 起動疎通確認

- uvicorn 起動 (port 8000): **失敗** `[winerror 10013]` アクセスが禁止された方法でソケットにアクセスしようとした
- ポート占有を調査: `iphlpsvc` (IP Helper, PID 5616) が 0.0.0.0:**8000, 8080, 5173** を LISTENING 中
- `netsh interface ipv4 show excludedportrange` には 50000+ と 60000+ しかなく、8000 は「除外に入ってないのに iphlpsvc が掴んでる」状態 (Hyper-V / WSL2 影響と推定)
- 8080 でも同症状。8001 で再起動 → 成功
- Python requests で疎通確認 (curl は permission 制限で使えず):
  - `GET /` → 200 + {"message":"秘書たん...","status":"running"}
  - `GET /docs` → 200 (932 bytes)
  - `GET /openapi.json` → 16 エンドポイント。zombie 系は完全に消えている
- Python websockets で WS 疎通確認:
  - 接続 → welcome / status メッセージ受信
  - ping → pong (timestamp=42 で echo)
  - command=status → status レスポンス
- frontend 側: `pnpm --version` → command not found。pnpm が未インストールのため自動ビルド確認スキップ。F-4 として記録

DoD 達成状況:
- ✅ backend 起動成功、`/` と `/docs` 応答
- ✅ WebSocket 接続成功
- ⚠️ frontend 起動成功 → pnpm 未インストールのため自動確認不可、手動確認タスクに
- ⚠️ 肉球ボタン左クリック発話 / ドラッグなど UI 動作 → 手動確認に

### 18:48〜 - Task 6 ドキュメント更新

- `docs/reboot/03_open_questions.md` に §F 「Step 1 実行で発覚した事項」追加 (F-1〜F-5)
- `docs/reboot/step1_log.md` 作成 (このファイル)
- `README.md` をリブート後スタックに合わせて全面改訂 (YOLO / ML 記述削除、リブートロードマップ追加)
- `CLAUDE.md` にプロジェクト現状 / 温存資産 / 禁止事項 / マイルストーンを追記

---

## 次のステップ (Step 2 引き継ぎ事項)

1. **pnpm をインストール** (`npm install -g pnpm`)、`pnpm install` → `pnpm run dev:electron` で UI 確認
2. **ポート運用**: 8001 を恒久化するか Hyper-V 回避策を打つか決定 (F-1)
3. **easyocr 去就**: OCR モジュールの用途確認、削除なら torch も一緒に消える (F-2)
4. **立ち絵アセットの所在**: git LFS / 別 repo / ローカル配布の方針確定 (F-5 / C-4)
5. **watcher モジュール新規実装**: `docs/reboot/legacy_snippets.md` の WS broadcast + mss キャプチャループを参考に、gaming-agnostic な差分検知 + Vision LLM 問い合わせに作り直す
