"""Step 0 Task 3 (改訂版): 日本語品質テスト.

秘書たんの口調プロンプトで5枚のスクショに応答生成、制約遵守率を自動集計。
LM Studio (OpenAI 互換 API) 経由で推論。

出力（ファイル名の `{slug}` は MODEL_ID をファイル名安全にしたもの）:
  - results/02_vision_quality_{slug}.md         — 人間向けレビュー用
  - results/02_vision_quality_{slug}_raw.json   — 全生成の生データ
  - results/02_vision_quality_{slug}_summary.json — マシン読み用サマリー (判定に使う)

モデルごとに別ファイルに書き出すので、MODEL_ID を切り替えて複数回実行すると
対比が可能。
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).parent
SAMPLES_DIR = ROOT / "samples"
PROMPT_PATH = ROOT / "prompts" / "hisyotan_system.txt"
PREV_RESULT_PATH = ROOT / "results" / "00_server_check.json"
RESULTS_DIR = ROOT / "results"

BASE_URL = "http://localhost:1234/v1"
API_KEY = "lm-studio"

N_GENERATIONS = 3
TEMPERATURE = 0.7
MAX_TOKENS = 80

SCENE_LABELS = {
    "01_base_daytime": "拠点・昼間",
    "02_base_night_watch": "拠点・夜間の見張り",
    "03_field_exploration": "フィールド探索",
    "04_zombie_combat": "ゾンビ戦闘",
    "05_blood_moon": "ブラッドムーン / 最大緊張",
}

EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F02F\U0001F0A0-\U0001F0FF]"
)
JP_RE = re.compile(r"[ぁ-んァ-ン]")


def _load_samples() -> list[Path]:
    paths = sorted(SAMPLES_DIR.glob("0?_*.jpg"))
    if not paths:
        print(
            "[02_vision_quality] FATAL: samples/0?_*.jpg が見つかりません。"
            "README の手順でリネーム済コピーを作成してください。",
            file=sys.stderr,
        )
        sys.exit(1)
    return paths


def _model_slug(model_id: str) -> str:
    """MODEL_ID をファイル名として安全な形に変換."""
    return re.sub(r"[^A-Za-z0-9._-]+", "_", model_id).strip("_")


def _load_previous_model_id() -> str:
    if not PREV_RESULT_PATH.exists():
        print(
            "[02_vision_quality] FATAL: 先に 00_server_check.py を実行してください。",
            file=sys.stderr,
        )
        sys.exit(1)
    data = json.loads(PREV_RESULT_PATH.read_text(encoding="utf-8"))
    if data.get("verdict") not in ("PASS", "WARN"):
        print(
            f"[02_vision_quality] FATAL: 00_server_check の verdict が "
            f"{data.get('verdict')!r} です。",
            file=sys.stderr,
        )
        sys.exit(1)
    model_id = os.environ.get("MODEL_ID") or data.get("picked_model_id")
    if not model_id:
        print(
            "[02_vision_quality] FATAL: モデル ID が取得できません。"
            "MODEL_ID 環境変数で指定してください。",
            file=sys.stderr,
        )
        sys.exit(1)
    return model_id


def _analyze(text: str) -> dict:
    length = len(text.strip())
    emoji_count = len(EMOJI_RE.findall(text))
    has_jp = bool(JP_RE.search(text))
    return {
        "length": length,
        "emoji_count": emoji_count,
        "is_japanese": has_jp,
        "meets_length": length <= 40,
        "meets_emoji": 0 <= emoji_count <= 2,
    }


def _image_data_url(path: Path) -> str:
    data = path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    mime = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
    return f"data:{mime};base64,{b64}"


def main() -> int:
    model_id = _load_previous_model_id()
    slug = _model_slug(model_id)
    results_md = RESULTS_DIR / f"02_vision_quality_{slug}.md"
    results_raw = RESULTS_DIR / f"02_vision_quality_{slug}_raw.json"
    results_summary = RESULTS_DIR / f"02_vision_quality_{slug}_summary.json"

    system_prompt = PROMPT_PATH.read_text(encoding="utf-8")
    samples = _load_samples()

    client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

    timestamp = datetime.now(timezone.utc).isoformat()
    raw: dict = {
        "timestamp_utc": timestamp,
        "base_url": BASE_URL,
        "model_id": model_id,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
        "n_generations_per_sample": N_GENERATIONS,
        "samples": [],
    }

    md_lines = [
        "# 日本語品質テスト結果",
        "",
        f"## モデル: `{model_id}`",
        f"## 実行日時: {timestamp}",
        "## バックエンド: LM Studio (OpenAI 互換 API)",
        "",
    ]

    per_sample_summaries: list[dict] = []
    all_generations = 0
    global_length_ok = 0
    global_emoji_ok = 0
    global_jp_ok = 0
    global_latencies: list[float] = []

    for sample_path in samples:
        stem = sample_path.stem
        label = SCENE_LABELS.get(stem, stem)
        print(f"[02_vision_quality] processing {sample_path.name} ({label})")
        data_url = _image_data_url(sample_path)

        sample_record: dict = {
            "path": str(sample_path),
            "scene": label,
            "generations": [],
        }
        latencies: list[float] = []
        lengths: list[int] = []
        emoji_counts: list[int] = []
        jp_ok = 0
        length_ok = 0
        emoji_ok = 0

        for i in range(N_GENERATIONS):
            start = time.perf_counter()
            try:
                resp = client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "この画面について一言お願い。"},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": data_url},
                                },
                            ],
                        },
                    ],
                    max_tokens=MAX_TOKENS,
                    temperature=TEMPERATURE,
                    timeout=60.0,
                )
                text = (resp.choices[0].message.content or "").strip()
            except Exception as e:
                text = f"[ERROR] {type(e).__name__}: {e}"
            latency = round(time.perf_counter() - start, 2)

            analysis = _analyze(text)
            sample_record["generations"].append(
                {"text": text, "latency_sec": latency, **analysis}
            )
            latencies.append(latency)
            lengths.append(analysis["length"])
            emoji_counts.append(analysis["emoji_count"])
            if analysis["is_japanese"]:
                jp_ok += 1
            if analysis["meets_length"]:
                length_ok += 1
            if analysis["meets_emoji"]:
                emoji_ok += 1

        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        avg_length = sum(lengths) / len(lengths) if lengths else 0.0
        avg_emoji = sum(emoji_counts) / len(emoji_counts) if emoji_counts else 0.0

        sample_summary = {
            "scene": label,
            "sample_name": sample_path.name,
            "avg_latency_sec": round(avg_latency, 2),
            "avg_length": round(avg_length, 1),
            "avg_emoji": round(avg_emoji, 1),
            "japanese_ratio": f"{jp_ok}/{N_GENERATIONS}",
            "meets_length_ratio": f"{length_ok}/{N_GENERATIONS}",
            "meets_emoji_ratio": f"{emoji_ok}/{N_GENERATIONS}",
        }
        sample_record["summary"] = sample_summary
        raw["samples"].append(sample_record)
        per_sample_summaries.append(sample_summary)

        all_generations += N_GENERATIONS
        global_length_ok += length_ok
        global_emoji_ok += emoji_ok
        global_jp_ok += jp_ok
        global_latencies.extend(latencies)

        md_lines.append(f"## サンプル: {sample_path.name} ({label})")
        md_lines.append("")
        for i, gen in enumerate(sample_record["generations"], start=1):
            md_lines.append(
                f"### 生成{i} (latency: {gen['latency_sec']}s, len: {gen['length']})"
            )
            md_lines.append(f"> {gen['text']}")
            md_lines.append("")
        md_lines.append("### 自動集計")
        md_lines.append(f"- 平均レイテンシ: {avg_latency:.2f}s")
        md_lines.append(
            f"- 平均文字数: {avg_length:.1f} (目標 ≤40: "
            f"{'OK' if avg_length <= 40 else 'NG'})"
        )
        md_lines.append(f"- 日本語判定: {jp_ok}/{N_GENERATIONS}")
        md_lines.append(
            f"- 絵文字平均: {avg_emoji:.1f}個 (目標 0〜2: "
            f"{'OK' if 0 <= avg_emoji <= 2 else 'NG'})"
        )
        md_lines.append("")

    overall = {
        "total_generations": all_generations,
        "meets_length_rate": (
            round(global_length_ok / all_generations, 3) if all_generations else 0.0
        ),
        "meets_emoji_rate": (
            round(global_emoji_ok / all_generations, 3) if all_generations else 0.0
        ),
        "japanese_rate": (
            round(global_jp_ok / all_generations, 3) if all_generations else 0.0
        ),
        "avg_latency_sec": (
            round(sum(global_latencies) / len(global_latencies), 2)
            if global_latencies
            else 0.0
        ),
    }

    summary = {
        "timestamp_utc": timestamp,
        "model_id": model_id,
        "overall": overall,
        "per_sample": per_sample_summaries,
    }

    md_lines.append("## 全体サマリー")
    md_lines.append("")
    md_lines.append(f"- 総生成数: {overall['total_generations']}")
    md_lines.append(f"- 40字以内率: {overall['meets_length_rate']*100:.1f}%")
    md_lines.append(f"- 絵文字 0〜2個率: {overall['meets_emoji_rate']*100:.1f}%")
    md_lines.append(f"- 日本語率: {overall['japanese_rate']*100:.1f}%")
    md_lines.append(f"- 平均レイテンシ: {overall['avg_latency_sec']}s")

    results_raw.parent.mkdir(parents=True, exist_ok=True)
    results_raw.write_text(
        json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    results_summary.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    results_md.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"[02_vision_quality] wrote {results_md}")
    print(f"[02_vision_quality] wrote {results_raw}")
    print(f"[02_vision_quality] wrote {results_summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
