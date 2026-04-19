# 03 — 未解決の判断ポイント

**作成日**: 2026-04-19
**目的**: 実装フェーズで手が止まる決定を先に洗い出し、わかどりちゃん（ユーザー）の判断を集約する。`02_migration_plan_draft.md` の Step 1 着手前に核心 5 項目を確定、Step 3 前に実測項目を潰す。

---

## A. 核心判断 — Step 3 着手前に確定したい

### A-1. モデル一本化 vs 段階切替

**論点**: Qwen2.5-VL 7B に固定するか、3B と 7B をトグル可能にするか。

- **固定の利点**: 実装・運用・プロンプト調整がシンプル
- **トグルの利点**:
  - ゲームフルスクリーン時は 3B、普段使いは 7B のような動的切替
  - VRAM 共有相手に合わせた柔軟性
- **トグルの欠点**: モデル 2 つ分のディスク消費、ロード時間の往復コスト

**推奨**: 最初は 7B 固定で始め、実使用感で必要になれば切替機構を追加。

**聞きたいこと**: 固定で良いか、最初からトグル前提で作るか。

---

### A-2. `modules/llm/openai_client.py` の去就

**論点**: 「ローカル LLM 完結」方針の厳格度は？

- **削除する**: 完全ローカル。API key 不要。外部通信なし
- **残す（フォールバック）**: LLM 起動失敗時に OpenAI API に fallback できる保険
- **残す（比較検証用）**: 実装中の品質ベンチマークに OpenAI を使う

**推奨**: 削除（方針通り、完全ローカル）。比較検証が必要なら一時的に別ブランチで運用。

**聞きたいこと**: 削除で良いか、一時フラグ付きで残すか。

---

### A-3. キャプチャ対象

**論点**: 全画面 or フォアグラウンドウィンドウのみ

- **全画面**: 情報量最大、サイドモニタの通知等も拾える
- **フォアグラウンドウィンドウのみ**:
  - トークン削減・LLM 推論が速い・VRAM 有利
  - プライバシー上も優しい
  - 欠点: ユーザーがサイドモニタで YouTube 見ていても気づかない

**推奨**: フォアグラウンドウィンドウのみ（初期）。必要なら Step 5 で全画面オプション追加。

**聞きたいこと**: フォアグラウンドのみで始めて良いか、最初から全画面か。

---

### A-4. 時間帯ミュート機能

**論点**: 夜 22時〜朝 7時 の自動ミュート機能を最初から入れるか。

- **初期搭載**: 実装は単純（設定で時刻範囲を指定、該当時間は speech_bus で drop）
- **後送り**: MVP 段階では不要、発話体験が固まってから追加

**推奨**: 後送り（Step 5 以降で任意追加）。Step 3-4 の時点で「深夜に作業してて勝手に喋られると集中できない」ことが分かれば即追加。

**聞きたいこと**: 必要性・優先度。

---

### A-5. Vision LLM 入力の保存

**論点**: companion が受け取った画像を `data/companion_samples/` に保存するか。

- **保存する**:
  - 後日の fine-tuning / プロンプト改善素材として価値
  - 誤発話時の原因追跡に便利
- **保存しない**:
  - プライバシー最優先（画面全体が記録される意味合い）
  - ディスク容量消費
- **中間案**: メタデータ（ウィンドウタイトル、発話テキスト、timestamp）のみ保存、画像本体は保存しない

**推奨**: 中間案（メタデータのみ）を初期実装、必要時に画像保存トグルを追加。

**聞きたいこと**: どこまで保存するか、保存するなら保存期間の上限。

---

## B. 実測で潰す「要確認」項目 — Step 3 着手前に結論を出す

### B-1. llama-cpp-python の RTX 5070 (Blackwell sm_120) 対応

**確認方法**:
- PyPI の `llama-cpp-python` 最新版の wheel が sm_120 を含むかリリースノート確認
- `pip install llama-cpp-python --prefer-binary` でインストールして `Llama(n_gpu_layers=-1)` で小モデルをロード → CUDA 実行確認
- 非対応なら `CMAKE_ARGS="-DLLAMA_CUDA=on" pip install llama-cpp-python --no-binary llama-cpp-python` でソースビルド（CUDA Toolkit 12.x 必要）

**Fallback**: ソースビルドでも通らなければ ONNX Runtime GenAI + Phi-3.5-Vision に切替（`02_migration_plan_draft.md` §9 参照）

---

### B-2. Qwen2.5-VL 7B-GGUF の vision projector

**確認方法**:
- Hugging Face で `Qwen/Qwen2.5-VL-7B-Instruct-GGUF` or コミュニティ変換版を取得
- llama.cpp mainline の最新で `./llama-mtmd-cli` or `./llama-qwen2vl-cli` コマンドの対応確認
- vision projector 層が mainline で完全マージされていない場合、別フォーク（例: `gguf-vl` 派生）を使うか、Qwen2.5-VL 3B に落とす

**確認時期**: Step 2 完了時、Step 3 着手前

---

### B-3. Phi-3.5-Vision 日本語品質の実サンプル比較

**確認方法**: 同一プロンプト・同一画像 30 枚で以下を並行実行、主観評価
- Qwen2.5-VL 7B (GGUF Q4_K_M)
- Qwen2.5-VL 3B (GGUF Q4_K_M)
- Phi-3.5-Vision (ONNX Runtime GenAI)

評価軸:
- 日本語の自然さ（秘書たん口調への近さ）
- 画像内容の認識精度
- 40字以内制約の遵守率
- 推論レイテンシ

**確認時期**: Step 2 と並行

---

### B-4. ONNX Runtime GenAI の Windows CUDA Provider 対応

**確認方法**:
- `onnxruntime-genai` の Windows wheel リリースノート確認
- `InferenceSession(providers=["CUDAExecutionProvider"])` でエラーなくセッション作成できるか
- DirectML にフォールバックされる場合、Phi-3.5-Vision のレイテンシが CUDA の 6〜7 割に落ちるか実測

**確認時期**: Phi-3.5-Vision を選ぶ場合のみ、Step 3 着手前

---

### B-5. pydantic / fastapi の 2026年4月時点バージョン移行

**確認方法**:
- `backend/app/config/settings.py` を pydantic 2.9 互換に書き換え可能か（`BaseSettings` → `pydantic_settings.BaseSettings`）
- `backend/app/events/startup_handler.py` の `@app.on_event("startup")` が fastapi 0.115 で動くか（警告のみか、エラーか）
- 動かない場合、`asynccontextmanager` lifespan に書き換え（10行程度）

**確認時期**: Step 1 の最初

---

## C. 既知の小課題 — Step 1 で吸収

### C-1. VOICEVOX エンジンパス運用

**現状**: `voice/voicevox_starter.py` の `default_paths` にユーザー環境 (`%LOCALAPPDATA%\Programs\VOICEVOX\vv-engine\run.exe`) が含まれていない。`.env` の `VOICEVOX_ENGINE_PATH` で逃げている。

**対応**: Step 1 で `default_paths` に `%LOCALAPPDATA%\Programs\VOICEVOX\vv-engine\run.exe` パターンを追加（1行）。 **[提案]**

---

### C-2. UAC 昇格プロセス配下での pynput 無操作誤判定

**現状**: 管理者として起動したゲームのキーマウス入力は pynput global listener から拾えない → 「無操作」と誤判定される。

**対応**: Step 5 の時点でログ・ドキュメントに明示。`window_watcher` がフォアグラウンドのプロセス情報を取れる場合は、「管理者昇格アプリが前面」を検知したら FunyaWatcher のアイドル判定を一時無効化するロジックを追加可能（**[提案]**、必須ではない）。

---

### C-3. マルチモニタ対応

**現状**: `zombie/monitor.py` は `monitor = sct.monitors[1]` でプライマリ固定。

**対応**: `watcher/window_watcher.py` で `GetForegroundWindow` → `MonitorFromWindow` → mss インデックスへマップする 3 ホップを実装。Step 2 で対応。

---

### C-4. 立ち絵・効果音アセットの実体

**現状**: `frontend/public/assets/` や `assets/images/`, `assets/sounds/` の実ファイルが git 追跡外の可能性。README では言及あり、コード上で参照はあるが検出されず。

**対応**: Step 1 で `.gitignore` と実運用配置を再確認。アセット管理方針（LFS 採用 / 別 repo / ローカル配布） を決める。

---

### C-5. 既存 pawButtonHandler のホルドモード

**現状**: `frontend/src/features/ui/handlers/pawButtonHandler.js` の「ホルドモード」は YOLO/ゾンビ連動前提の未完成コメント付き機能。

**対応**: Step 1 で該当ロジック削除、左クリックは純粋な「肉球でランダム発話」にシンプル化。右クリック設定パネルは温存。

---

### C-6. `voice/react.py` のゾンビ反応テンプレート

**現状**: `backend/app/modules/voice/react.py` はゾンビ数・距離をもとに反応メッセージを生成する専用テンプレート。

**対応**: Step 1 で削除。`backend/app/routers/voice.py:230-286` の `react_to_zombie` エンドポイントも削除。

---

## D. 運用系の任意判断（後回し可）

以下は Step 5 完了後に任意検討。

### D-1. 発話履歴ログ

- 1時間あたり何回、どんな発話をしたかをローカルに記録するか？
- プライバシー観点で、保存するなら暗号化 or 保存期間制限

### D-2. セリフ手動追加 UI

- `frontend/src/emotion/emotionHandler.js` のランダムセリフを、アプリの設定画面から追加できるようにするか？

### D-3. 話者切替

- VOICEVOX には多くの話者があるが、現状は speaker_id=8 固定。設定画面から切替可能にするか？

### D-4. 音量制御の精緻化

- 既存 `frontend/src/ui/helpers/volumeControl.js` で基本実装あり。ゲーム音量とは独立した companion 音量スライダー追加の必要性？

---

## E. ユーザーに直接確認したい質問まとめ

実装着手前に確定させたい **核心 5 項目**（§A の再掲）:

| # | 質問 | 既定案 |
|---|---|---|
| 1 | モデル固定 (Qwen2.5-VL 7B) か、3B / 7B トグルか | 7B 固定で開始 |
| 2 | `llm/openai_client.py` は削除か、フラグ付きで残すか | 削除 |
| 3 | キャプチャは全画面か、フォアグラウンドのみか | フォアグラウンドのみ |
| 4 | 時間帯ミュートは初期搭載か、後送りか | 後送り |
| 5 | Vision LLM 入力の保存範囲（画像 / メタのみ / 無保存） | メタのみ |

これらに返答が揃えば Step 1 に着手できる。実測項目（§B）の結論は Step 2 完了時にチェックポイント予定。

---

## F. Step 1 実行で発覚した事項（2026-04-19 追記）

### F-1. iphlpsvc がポート 8000 / 8080 / 5173 を LISTEN 中 (Windows 11 + Hyper-V)

**現状**: `netstat -ano | grep :8000` で PID 5616 (svchost `iphlpsvc` = IP Helper) が `0.0.0.0:8000` / `0.0.0.0:8080` / `0.0.0.0:5173` を LISTENING。`netsh interface ipv4 show excludedportrange protocol=tcp` には 50000+ と 60000+ しか現れず、8000 / 8080 / 5173 は「除外範囲に入ってないのに iphlpsvc が掴んでいる」状態。Hyper-V / WSL2 の仮想スイッチ初期化で起きる既知挙動。

**Step 1 での暫定対応**: uvicorn を `--port 8001` で起動して疎通確認した（backend 動作確認は問題なし）。

**判断したい**: 本運用で backend / frontend が期待するデフォルトポートを
- (a) 8001 / 5174 などの「取れるポート」に恒久シフトする（`package.json` の `dev:backend`, `dev:frontend`, `frontend/vite.config.js`、README を更新）
- (b) Hyper-V / WSL2 を止めて 8000 / 5173 を開放する運用に戻す（仮想化が必要な日常作業と両立しない）
- (c) 起動前に `net stop iphlpsvc && net start iphlpsvc` のようなリセットスクリプトを運用に組み込む

**推奨**: (a) が現実的。Step 2 で `PORT=8001` を `.env` で明示 + README 記載。

**決定 (2026-04-19、わかどりちゃん確認)**: **(a) を採用、8001 / 5174 に恒久シフト済み**。
- backend default port: 8001 (`backend/main.py` / `package.json#dev:backend` / `scripts/dev/*` / `config/config.json` / `frontend/src/**` 一括更新)
- Vite dev server port: 5174 (`package.json#dev`, `dev:frontend`, VITE_DEV_SERVER_URL / `paw-preload.js` / `scripts/dev/dev-electron.js` 一括更新)
- 環境変数 `PORT` / `BACKEND_PORT` / `FRONTEND_PORT` で上書き可能
- CSP の `connect-src` も 8001 に更新済み

### F-2. easyocr 依存で torch / torchvision が副次的にインストールされる

**現状**: Step 1 で `torch`, `torchvision`, `ultralytics`, `pyautogui` を requirements.txt から削除したが、`easyocr` が torch を必須依存として持つため `pip install -r requirements.txt` 後に `torch-2.11.0` と `torchvision-0.26.0` が入ってしまう。仕様書の DoD「`pip list | grep torch` が空」は満たせない。

**判断したい**:
- Step 2 で easyocr を削除するか（そもそも backend コード内で使用箇所ゼロ、`pytesseract` が OCR 本命）
- 残すなら torch が副次的に入ることを受け入れる

**推奨**: Step 2 の OCR モジュール去就判断時に easyocr 削除で torch も一緒に落とす。

### F-3. frontend に残った zombie 文字列

**現状**: backend は `grep zombie` ゼロ達成。frontend/src/ には以下が残存:
- `core/logger.js` の `logZombieWarning` 関数（実体は console.warn + ★★★ ZOMBIE_WARNING ★★★ マーカー）
- `emotion/SpeechManager/voicevoxClient.js` の `reactToZombie` 関数と `/api/voice/react_to_zombie` 呼び出し（呼び出し元ゼロ、dead code）
- `emotion/SpeechManager/speakCore.js` の `zombie_warning` / `zombie_few` イベント型クールダウン処理
- `emotion/audioReactor.js` の `zombie_near` / `zombie_few` / `zombie_horde` 感情マッピング
- `ui/helpers/speechBridge.js` の `zombie_warning` 型判定
- `ui/styles/components/_speech-bubble.css` の `.speech-bubble.zombie-warning` スタイル
- `renderer/assistantUI.js` / `ui/helpers/uiBuilder.js` の `zombieBubble` という変数名（実体は `speechBubble` DOM）

これらは **実害なし**（呼び出しのない dead code か、動作に影響しない名前）で、仕様書 DoD「frontend grep 0件」は満たせない。

**Step 1 暫定対応**: 壊れた import を持つ `shared/ui/handlers/contextMenuHandler.js` だけ削除済み（完全に unreachable な dead code で、右クリックメニュー処理は `setupMouseEvents.js` 経由に既に置き換わっていた）。

**判断したい**: Step 2/3 で companion/watcher のイベント型に置き換えるとき、命名も一般化して除去する方針で良いか（一括 rename でなく機会ごとに触るアプローチ）。

**推奨**: Step 2/3 で機会ごとに一般化、単独での大規模リネーム PR は打たない。

### F-4. pnpm がユーザー環境にインストールされていない

**現状**: Step 5 の起動疎通確認で `pnpm --version` → command not found。`pnpm-lock.yaml` は存在するが pnpm 本体が PATH にない。`npm` は `C:\Program Files\nodejs\npm.ps1` で利用可能。

**Step 1 暫定対応**: frontend ビルド/起動の自動確認はスキップ。backend + WebSocket のみ Python 側で疎通確認済み。

**判断したい**: pnpm を `npm install -g pnpm` でインストールするか、`npm ci` ベース運用に切替えるか。

**推奨**: pnpm を入れる（lock ファイルとの整合性のため）。READMEにも pnpm 前提の記載あり。

### F-5. 立ち絵アセットの実体未確認

**現状**: README / コード上で `assets/images/` や `frontend/public/...` にある立ち絵 (`secretary_*.png` 等) を参照するが、ワークツリーで実体を確認できていない。Step 5 の起動疎通で Electron を立ち上げなかったため、画面に立ち絵が描画されるかは未検証。

**判断したい**: C-4 と合わせ、アセットを git LFS / 別 repo / ローカル配布のどれで管理するか。

**推奨**: Step 2 着手前に実ファイルの所在を確認し、運用方針を決定。
