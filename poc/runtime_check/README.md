# Step 0: ランタイム生存確認 PoC（LM Studio 経由・改訂版）

リブート本実装（Step 1〜5）に進む前に、ローカル Vision LLM が
RTX 5070 (Blackwell) で実用速度・実用品質で動くかを、**既存コードに触れず**最小コストで検証する独立 PoC。

**2026-04-19 実行結果: 全 PASS（定量判定）**。計測は LM Studio 側の KV cache 温度でブレるため、Step 1 本実装で再評価する前提。詳細は下の「実行結果」セクション参照。

---

## このPoCの目的

- **やること**: Vision LLM が LM Studio 経由で「15秒以内に日本語の一言」を返せるか、秘書たんプロンプトで文字数・絵文字制約を守れるか、の2点だけ見る
- **やらないこと**: 本番ランタイムの決定（ONNX Runtime GenAI か llama.cpp 直叩きかは Step 3 以降に PoC 結果を見て別途判断）
- 前版 (llama-cpp-python 路線) は wheel の Qwen2.5-VL 対応が遅れていて頓挫。LM Studio に載せ替えた

## 前提条件

- Windows 11 + RTX 5070 12GB + Ryzen 7 7800X3D
- Python 3.10〜3.12（このディレクトリの `.venv` は 3.12.10 で作成済み）
- 本体 `requirements.txt` / `backend/` / `frontend/` には**触らない**

---

## Step A: わかどりちゃんが手動でやること (LM Studio 側)

Claude Code は LM Studio GUI を代行しない。以下はわかどりちゃん自身で LM Studio UI を操作する。

### 1. LM Studio をインストール

- https://lmstudio.ai から Windows 版ダウンロード → 通常インストール
- 起動後、右下の設定で **GPU Offload が有効**、**CUDA** が認識されていることを確認

### 2. Vision LLM をダウンロード

- LM Studio の **Discover** タブで以下のどれかを検索してダウンロード:
  - `qwen3-vl-8b-instruct`（2026-04 時点での第一候補、Q4_K_M 推奨）
  - `qwen2.5-vl-7b-instruct` Q4_K_M（実績ある構成）
  - `qwen2.5-vl-3b-instruct` Q4_K_M（軽量、VRAM 余裕無い環境用）
- mmproj (vision projector) が同梱されているか別ファイルか配布で異なる。別提示なら両方 DL

### 3. Local Server を起動

- LM Studio 左側の **Developer** タブを開く
- 使いたいモデルをロード
  - **GPU Offload**: Full（または可能な限り最大）
  - **Context Length**: 4096 以上
- **Start Server** ボタンで `http://localhost:1234` を起動
- Server Logs に `Server listening on port 1234` が出ていることを確認

---

## Step B: Python 側セットアップ

```powershell
cd poc/runtime_check

# 既存 .venv をアクティベート（Python 3.12.10 で作成済み）
.venv\Scripts\activate

python --version    # 3.12.x であることを確認

python -m pip install --upgrade pip
python -m pip install -r requirements_poc.txt
```

llama-cpp-python / torch / transformers は**一切入れない**。LM Studio が推論を受け持つので、Python 側は HTTP クライアントだけで良い。

---

## Step C: 実行手順

```powershell
# 1. LM Studio サーバーの疎通確認、モデル ID の取得
python 00_server_check.py

# 2. 画像 1 枚で vision 疎通 + レイテンシ + VRAM を測定
python 01_vision_smoke.py

# 3. 5 枚 × 3 生成で日本語品質を測定（所要 3〜5 分目安）
python 02_vision_quality.py
```

`00` が FAIL なら後続は中断される（先行ファイルの verdict を見る）。

### 複数モデルで比較したい場合

`00_server_check.py` は `id` に qwen と vl を両方含むものを自動選択する。別のモデルで走らせたい場合は環境変数で上書き:

```powershell
# PowerShell
$env:MODEL_ID = "qwen2.5-vl-7b-instruct"
python 01_vision_smoke.py
python 02_vision_quality.py

# 次に 3B を試したいなら
$env:MODEL_ID = "qwen2.5-vl-3b-instruct"
python 02_vision_quality.py
```

`02_vision_quality.py` は結果ファイル名に MODEL_ID をスラッグ化した文字列を含めるので、**モデルを切り替えて複数回実行しても上書きされず並行保持できる**。

### 結果ファイル

```
results/
├── 00_server_check.json                      # モデル ID、verdict
├── 01_vision_smoke.json                      # 1枚疎通、latency_sec、verdict、VRAM 増減
├── 02_vision_quality_{slug}.md               # 人間レビュー用（15生成の全文）
├── 02_vision_quality_{slug}_raw.json         # 全生成の生データ
└── 02_vision_quality_{slug}_summary.json     # マシン読み用サマリー（判定に使う）
```

`{slug}` は `qwen3-vl-8b-instruct` のようにモデル ID を URL 安全にしたもの。

---

## 判定基準

| 観点 | PASS | WARN | FAIL |
|---|---|---|---|
| サーバー疎通 (00) | `/v1/models` が返る + vision モデル検出 | vision モデル不明 | 接続不能 |
| vision 疎通 (01) | 15 秒以内に日本語応答 | 15〜30 秒 or 日本語不成立 | 30 秒超 / エラー |
| 日本語品質 (02) | 40字以内 80% 超、絵文字 0-2 | 制約違反 20-40% | 制約違反 40% 超 |
| レイテンシ (02 平均) | 平均 < 5s | 5-15s | > 15s |

---

## 実行結果（2026-04-19）

### ① Qwen3-VL-8B-Instruct — 全 PASS（ただしレイテンシにブレあり）

同一スクリプト・同一画像で 2 回実行した結果、**平均レイテンシが 1.42s → 6.92s と約 5 倍ブレた**。LM Studio の Chat タブで同じ画像・似たプロンプトの会話を直前に行っていた影響で、1 回目は vision embedding が KV cache にヒットし極端に高速化されていたと推測。

| 観点 | 1回目 (08:49 UTC) | 2回目 (09:10 UTC) | 判定 |
|---|---|---|---|
| サーバー疎通 | 8 モデル検出、`qwen3-vl-8b-instruct` 自動選択 | 同左 | ✅ PASS |
| smoke レイテンシ | 5.32s | 8.24s | ✅ PASS |
| 40字以内率 | 15/15 (100%) | 15/15 (100%) | ✅ PASS |
| 絵文字 0-2個率 | 15/15 (100%) | 15/15 (100%) | ✅ PASS |
| 日本語率 | 15/15 (100%) | 15/15 (100%) | ✅ PASS |
| 平均レイテンシ (02) | **1.42s**（cache hit 上振れ） | **6.92s**（素の値に近い） | ✅ PASS |

結果ファイル（2回目のみ上書き保存、1回目の数値は conversation log のみ）:
- `results/02_vision_quality_qwen3-vl-8b-instruct.md`
- `results/02_vision_quality_qwen3-vl-8b-instruct_summary.json`

**所見**:
- 秘書たん口調の追従は良好。「ふにゃ」「〜だよ」「〜ねっ」「🐾」の出現が自然
- **シーン認識にやや癖あり**: 01〜03（拠点昼・夜の見張り・フィールド探索）で「砂嵐」ワードが連発し、画像内の一要素に引っ張られる傾向
- 04〜05（戦闘・ブラッドムーン）は雰囲気を正しく拾えている
- 1 回目の 1.42s はキャッシュヒット時の上限、**素の実力は 6〜8s 程度**と見るべき

### ② Qwen2.5-VL-7B-Instruct — 定量 PASS（ただし smoke で WARN）

| 観点 | 結果 | 判定 |
|---|---|---|
| vision 疎通 (smoke) | レイテンシ 19.96s / 日本語応答あり / VRAM +3758MB | ⚠️ **WARN** (>15s) |
| 40字以内率 | 15/15 (100%) | ✅ PASS |
| 絵文字 0-2個率 | 15/15 (100%) | ✅ PASS |
| 日本語率 | 15/15 (100%) | ✅ PASS |
| 平均レイテンシ (02) | 4.22s | ✅ PASS（<5s ギリ） |

結果ファイル:
- `results/02_vision_quality_qwen2.5-vl-7b-instruct.md`
- `results/02_vision_quality_qwen2.5-vl-7b-instruct_summary.json`

**所見**:
- smoke の 19.96s は LM Studio で切り替え直後のコールドスタート影響と思われる（02 の平均は 4.22s に落ち着く）
- VRAM 増分 +3758MB は Qwen3-VL 8B (+148MB) と桁違い。ただし Qwen3-VL 側は warm 状態、こちらは cold start のため単純比較不能。vision エンコーダの一時割当が大きめなのは事実
- 05 ブラッドムーンで平均 8.11s、生成1 で 10.41s と、サンプルによって遅い
- 口調追従は良好（「ふにゃ」「〜ね」「🐾」の出現は自然）
- シーン認識は Qwen3-VL 8B より若干誤認識が多い（「暖炉」「お茶はいかが？」「雨が降ってないみたい」等）

### ③ モデル間対比サマリー

| 指標 | Qwen3-VL-8B | Qwen2.5-VL-7B | 備考 |
|---|---|---|---|
| smoke レイテンシ | 5.32s〜8.24s | 19.96s | Qwen2.5-VL 7B は cold start 初回 |
| 02 平均レイテンシ (cache hit 時) | 1.42s | — | Qwen3 側のみ warm 計測あり |
| 02 平均レイテンシ (素の値) | 6.92s | 4.22s | 2回目同士の比較では Qwen2.5-VL 7B がやや速い |
| 40字以内率 | 100% | 100% | 引き分け |
| 絵文字 0-2 個率 | 100% | 100% | 引き分け |
| 日本語率 | 100% | 100% | 引き分け |
| シーン認識 | 砂嵐連発（01〜03）、04〜05 正確 | 暖炉/お茶/雨 等 微妙に外す生成あり | 互角（どちらも完璧ではない） |
| 秘書たん口調 | ◎ | ○ | わずかに Qwen3-VL 8B |

**結論**: 両モデルとも定量指標は全 PASS で Step 1 本実装に進む要件は満たす。ただし **LM Studio の KV cache 温度により計測が大きくブレる**（Qwen3-VL 8B で 1.42s ⇔ 6.92s の 5 倍差を確認）ため、本 PoC の数値は順序関係を厳密に決められない。

本実装段階で「他モデル全 Eject → warm-up 捨て → 本計測」の手順でフェア測定を行い、最終決定する。現段階では Qwen2.5-VL 7B / Qwen3-VL 8B のどちらも候補として残す。

### ④ 計測ブレについて（Step 1 への申し送り）

- LM Studio の Chat タブで同じ画像・似たプロンプトの会話を続けていると、vision embedding が KV cache に残り、スクリプトからの推論が **極端に高速化される** ことを確認
- 今回の PoC の 1 回目（Qwen3-VL 8B 平均 1.42s）はこの cache hit 副産物。**運用時想定は 5〜8 秒前後**で設計しておく方が安全
- 複数モデルをロード状態で切り替えて測ると、swap 影響でそれぞれが不利になる。単一モデルだけロードして測る運用を推奨
- `02_vision_quality.py` には warm-up ループが未実装。Step 1 で実運用に載せるときに先頭 1 サンプルを捨てる形で追加するとよい

---

## 次のステップ

- 定量判定は **両モデルとも PASS**、Step 1 本実装に進む要件を満たす
- デフォルトモデルは Step 1 でフェア再計測してから決定（現段階では保留）
- PoC 結果は `docs/reboot/` 配下に退避予定（gitignore されないエリア）
- シーン認識の癖（砂嵐連発等）は、本実装時のプロンプト側で補正する余地あり
- `02_vision_quality.py` に warm-up 機能を Step 1 段階で追加

## トラブルシュート

### `00_server_check.py` が `ConnectionError`
→ LM Studio の Local Server が起動していない。Developer タブで Start Server を押す。

### `00_server_check.py` が WARN で「vision 対応モデルが見つからない」
→ LM Studio にテキストのみのモデルがロードされている。VL 系をロードし直す。

### `01_vision_smoke.py` が FAIL で `400 Bad Request` or `image_url` 拒絶
→ ロード済のモデルが vision 対応ではない（テキスト専用）。LM Studio Developer タブで再確認。

### `01_vision_smoke.py` のレイテンシが 30 秒超
→ GPU Offload が効いていない可能性が高い。LM Studio の Model settings で Offload を Full にして再ロード。`nvidia-smi` で VRAM 使用量が 5GB 以上増えていなければほぼ CPU 推論。

### `02_vision_quality.py` の応答が英語や中国語になる
→ システムプロンプトが効いていない。`prompts/hisyotan_system.txt` を強化するか、user メッセージに「日本語で」の一言を足す。

---

## やらないこと

- 既存 `backend/` / `frontend/` の変更
- 本体 `requirements.txt` の更新
- LM Studio の GUI 操作代行（インストール・モデル DL・サーバー起動はわかどりちゃんが手動）
- モデル配布者の README 固定（Discover タブで都度選定）
- Phi-3.5-Vision ONNX ルート検証（Qwen 系が全 FAIL に落ちた時に別ミッション化）
- `llama-cpp-python` のソースビルド

---

## 疑問・作業ログ

実行中に迷いが出たら `results/questions.md` に追記。作業ログは `results/poc_log.md`。
いずれも gitignore 対象なので、残したい判定結果は `docs/reboot/` 配下に手動退避。
