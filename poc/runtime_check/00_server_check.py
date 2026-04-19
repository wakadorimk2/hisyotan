"""Step 0 Task 1 (改訂版): LM Studio サーバー疎通確認.

LM Studio の OpenAI 互換 API (http://localhost:1234/v1) に繋がるか、
ロード済のモデル一覧を取って vision 対応っぽい Qwen2.5-VL 系モデルが
選べる状態か、だけを見る。

判定:
  - PASS: /v1/models が返り、id に "qwen" と "vl" を両方含むモデルが 1つ以上ある
  - WARN: /v1/models は返るが vision 対応モデルが見当たらない（テキストのみモデル）
  - FAIL: 接続不能、タイムアウト、非 200 応答

結果: results/00_server_check.json
      + 選ばれたモデル ID を stdout に print（後続スクリプトが環境変数等で受け取る想定）

FAIL 時の原因候補:
  - LM Studio 未起動
  - LM Studio の Local Server が起動していない (Developer タブ → Start Server)
  - ポート 1234 が別プロセスに占有されている
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent
RESULTS_PATH = ROOT / "results" / "00_server_check.json"

BASE_URL = "http://localhost:1234/v1"
TIMEOUT_SEC = 5.0


def _pick_vision_model(model_ids: list[str]) -> str | None:
    """id に qwen と vl を両方含むものを最優先、次に vl を含むもの。"""
    qwen_vl = [m for m in model_ids if "qwen" in m.lower() and "vl" in m.lower()]
    if qwen_vl:
        return qwen_vl[0]
    vl_only = [m for m in model_ids if "vl" in m.lower() or "vision" in m.lower()]
    if vl_only:
        return vl_only[0]
    return None


def main() -> int:
    record: dict = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE_URL,
    }

    try:
        resp = requests.get(f"{BASE_URL}/models", timeout=TIMEOUT_SEC)
    except requests.exceptions.ConnectionError as e:
        record["verdict"] = "FAIL"
        record["error"] = f"ConnectionError: {e}"
        _write(record)
        print(
            "\n[00_server_check] FAIL: LM Studio の Local Server に繋がらない。\n"
            "  1. LM Studio を起動\n"
            "  2. Qwen2.5-VL 7B (Q4_K_M + mmproj) をロード\n"
            "  3. Developer タブ → Start Server で http://localhost:1234 を起動\n"
            "  を確認してください。\n",
            file=sys.stderr,
        )
        return 2
    except requests.exceptions.Timeout as e:
        record["verdict"] = "FAIL"
        record["error"] = f"Timeout: {e}"
        _write(record)
        print(
            f"\n[00_server_check] FAIL: {BASE_URL}/models が {TIMEOUT_SEC}s 以内に応答しませんでした。\n",
            file=sys.stderr,
        )
        return 2
    except Exception as e:
        record["verdict"] = "FAIL"
        record["error"] = f"{type(e).__name__}: {e}"
        _write(record)
        print(f"\n[00_server_check] FAIL: {e}\n", file=sys.stderr)
        return 2

    record["http_status"] = resp.status_code
    if resp.status_code != 200:
        record["verdict"] = "FAIL"
        record["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        _write(record)
        print(
            f"\n[00_server_check] FAIL: HTTP {resp.status_code} 応答。LM Studio 側のログを確認してください。\n",
            file=sys.stderr,
        )
        return 2

    try:
        payload = resp.json()
        model_ids = [item["id"] for item in payload.get("data", [])]
    except Exception as e:
        record["verdict"] = "FAIL"
        record["error"] = f"JSON parse error: {e}"
        record["raw_text"] = resp.text[:500]
        _write(record)
        print(f"\n[00_server_check] FAIL: JSON パース失敗: {e}\n", file=sys.stderr)
        return 2

    record["model_ids"] = model_ids

    if not model_ids:
        record["verdict"] = "FAIL"
        record["error"] = "No models loaded in LM Studio"
        _write(record)
        print(
            "\n[00_server_check] FAIL: LM Studio にモデルがロードされていません。\n"
            "  LM Studio の Developer タブで Qwen2.5-VL 7B をロードしてください。\n",
            file=sys.stderr,
        )
        return 2

    picked = _pick_vision_model(model_ids)
    record["picked_model_id"] = picked

    if picked is None:
        record["verdict"] = "WARN"
        print(
            f"\n[00_server_check] WARN: ロード済モデル {model_ids} に vision 対応らしき "
            f"ID が見つかりません。テキストのみのモデルをロードしている可能性があります。\n"
            "Qwen2.5-VL-7B-Instruct (Q4_K_M + mmproj) をロードし直してください。\n",
            file=sys.stderr,
        )
        _write(record)
        return 1

    record["verdict"] = "PASS"
    _write(record)

    print(f"[00_server_check] PASS  picked_model_id={picked}")
    print(f"  all loaded models: {model_ids}")
    print(f"  wrote {RESULTS_PATH}")
    return 0


def _write(record: dict) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(
        json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
    )


if __name__ == "__main__":
    sys.exit(main())
