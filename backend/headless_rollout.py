import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict


def main() -> None:
    args = parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Playwright is required for headless rollouts. Install with "
            "`pip install playwright` and run `python -m playwright install chromium`."
        ) from exc

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"headless-{args.skill}-{int(time.time())}.jsonl"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        page.goto(args.url, wait_until="networkidle", timeout=60000)
        page.wait_for_function("() => !!window.airaTrainingBridge", timeout=60000)
        page.evaluate(
            """({ skill, mode }) => {
              window.airaTrainingBridge.setEnabled(true);
              window.airaTrainingBridge.setMode(mode);
              window.airaTrainingBridge.setSkill(skill);
            }""",
            {"skill": args.skill, "mode": "headless"},
        )

        started = time.time()
        last_tick = -1
        with output_path.open("w", encoding="utf-8") as f:
            while time.time() - started < args.seconds:
                obs: Dict[str, Any] = page.evaluate("() => window.airaTrainingBridge.getObservation()")
                if obs and obs.get("tick") != last_tick:
                    last_tick = obs.get("tick")
                    f.write(json.dumps({
                        "t": time.time(),
                        "observation": obs,
                    }, separators=(",", ":")) + "\n")
                time.sleep(max(0.01, args.sample_ms / 1000))

        browser.close()

    print(f"saved headless rollout: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Aira movement rollouts in hidden Chromium.")
    parser.add_argument("--url", default="http://localhost:3000", help="Simulator URL.")
    parser.add_argument("--seconds", type=float, default=60.0, help="Rollout duration.")
    parser.add_argument("--skill", default="stand", help="Training skill name.")
    parser.add_argument("--sample-ms", type=float, default=50.0, help="Observation sampling interval.")
    parser.add_argument("--width", type=int, default=640, help="Headless viewport width.")
    parser.add_argument("--height", type=int, default=480, help="Headless viewport height.")
    parser.add_argument("--output-dir", default="backend/data/movement/headless", help="Output JSONL directory.")
    return parser.parse_args()


if __name__ == "__main__":
    main()
