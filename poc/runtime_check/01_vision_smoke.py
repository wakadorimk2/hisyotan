"""Step 0 Task 2 (改訂版): vision 入力疎通・レイテンシ測定.

目的: LM Studio 上のモデルに vision 入力付きリクエストを1回投げ、
      返ってくるまでの時間と VRAM 増加分だけを確認する。品質は見ない
      （それは 02_vision_quality.py の仕事）。

判定:
  - PASS: 15秒以内に日本語テキストが返ってくる
  - WARN: 15-30秒、または日本語ではあるが明らかに短すぎる/長すぎる
  - FAIL: タイムアウト、HTTP エラー、vision 入力が拒絶される、30秒超

FAIL 時の原因候補:
  - LM Studio に vision 対応モデルとしてロードしていない（テキストのみをロードした）
  - Qwen2.5-VL の mmproj (vision projector) が欠落している
  - GPU Offload が無効で CPU 推論になっている → LM Studio UI で再確認
  - Context Length が画像込みで不足 → LM Studio UI で 4096 以上に
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).parent
SAMPLES_DIR = ROOT / "samples"
PREV_RESULT_PATH = ROOT / "results" / "00_server_check.json"
RESULTS_PATH = ROOT / "results" / "01_vision_smoke.json"

BASE_URL = "http://localhost:1234/v1"
API_KEY = "lm-studio"  # LM Studio は値を検証しない。SDK が要求するため適当な文字列

PROMPT = "この画面を一言で説明してください。"
MAX_TOKENS = 80
TEMPERATURE = 0.3
TIMEOUT_FAIL = 30.0
TIMEOUT_WARN = 15.0
JP_CHARS = tuple("ぁあいうえおかがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン")


def _load_previous_model_id() -> str:
    if not PREV_RESULT_PATH.exists():
        print(
            "[01_vision_smoke] FATAL: 先に 00_server_check.py を実行してください。\n"
            f"  {PREV_RESULT_PATH} が存在しません。",
            file=sys.stderr,
        )
        sys.exit(1)
    data = json.loads(PREV_RESULT_PATH.read_text(encoding="utf-8"))
    if data.get("verdict") not in ("PASS", "WARN"):
        print(
            f"[01_vision_smoke] FATAL: 00_server_check の verdict が "
            f"{data.get('verdict')!r} です。サーバー疎通を先に直してください。",
            file=sys.stderr,
        )
        sys.exit(1)
    model_id = os.environ.get("MODEL_ID") or data.get("picked_model_id")
    if not model_id:
        print(
            "[01_vision_smoke] FATAL: モデル ID が取得できませんでした。"
            "MODEL_ID 環境変数で明示してください。",
            file=sys.stderr,
        )
        sys.exit(1)
    return model_id


def _find_smoke_sample() -> Path:
    for name in ["01_base_daytime.jpg", "01_base_daytime.png"]:
        p = SAMPLES_DIR / name
        if p.is_file():
            return p
    for p in sorted(SAMPLES_DIR.glob("0?_*.jpg")):
        return p
    print("[01_vision_smoke] FATAL: samples/ に 01_*.jpg がありません。", file=sys.stderr)
    sys.exit(1)


def _image_data_url(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    mime = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
    return f"data:{mime};base64,{b64}"


def _vram_used_mb() -> int | None:
    try:
        r = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=memory.used",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode == 0:
            return int(r.stdout.strip().splitlines()[0])
    except Exception:
        pass
    return None


def _is_japanese(text: str) -> bool:
    return any(c in JP_CHARS for c in text)


def main() -> int:
    model_id = _load_previous_model_id()
    sample = _find_smoke_sample()

    record: dict = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE_URL,
        "model_id": model_id,
        "sample_path": str(sample),
        "prompt": PROMPT,
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
    }

    record["vram_before_mb"] = _vram_used_mb()

    client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
    data_url = _image_data_url(sample)

    start = time.perf_counter()
    try:
        resp = client.chat.completions.create(
            model=model_id,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            timeout=TIMEOUT_FAIL + 5.0,
        )
    except Exception as e:
        latency = time.perf_counter() - start
        record["latency_sec"] = round(latency, 2)
        record["verdict"] = "FAIL"
        record["error"] = f"{type(e).__name__}: {e}"
        _write(record)
        print(f"\n[01_vision_smoke] FAIL  error={e}", file=sys.stderr)
        return 2

    latency = time.perf_counter() - start
    record["latency_sec"] = round(latency, 2)
    record["vram_after_mb"] = _vram_used_mb()

    try:
        text = resp.choices[0].message.content or ""
    except Exception as e:
        record["verdict"] = "FAIL"
        record["error"] = f"Unexpected response shape: {e}"
        record["raw_response"] = str(resp)
        _write(record)
        print(f"\n[01_vision_smoke] FAIL  response shape error={e}", file=sys.stderr)
        return 2

    record["response_text"] = text
    try:
        record["usage"] = {
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "total_tokens": resp.usage.total_tokens,
        }
    except Exception:
        record["usage"] = None

    record["is_japanese"] = _is_japanese(text)

    if latency > TIMEOUT_FAIL or not text.strip():
        verdict = "FAIL"
    elif latency > TIMEOUT_WARN or not record["is_japanese"]:
        verdict = "WARN"
    else:
        verdict = "PASS"
    record["verdict"] = verdict

    _write(record)

    print(f"[01_vision_smoke] verdict={verdict}  latency={latency:.2f}s")
    print(f"  model: {model_id}")
    print(f"  response: {text[:120]}{'...' if len(text) > 120 else ''}")
    if record["vram_before_mb"] is not None and record["vram_after_mb"] is not None:
        diff = record["vram_after_mb"] - record["vram_before_mb"]
        print(
            f"  vram: {record['vram_before_mb']} → {record['vram_after_mb']} MB "
            f"(diff {diff:+d})"
        )
    print(f"  wrote {RESULTS_PATH}")

    return 0 if verdict != "FAIL" else 2


def _write(record: dict) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(
        json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())
