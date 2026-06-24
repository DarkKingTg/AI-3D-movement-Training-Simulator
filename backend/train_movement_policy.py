import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List


DEFAULT_DATA_DIR = Path(__file__).parent / "data" / "movement"


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir)
    if args.command == "dataset":
        dataset = build_dataset(data_dir)
        out = data_dir / "datasets" / "movement_dataset.jsonl"
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as f:
            for row in dataset:
                f.write(json.dumps(row, separators=(",", ":")) + "\n")
        print(json.dumps({"rows": len(dataset), "path": str(out)}, indent=2))
        return

    if args.command == "status":
        print(json.dumps(training_status(data_dir), indent=2))
        return

    if args.command == "bc":
        print(json.dumps(behavior_clone_plan(data_dir), indent=2))
        return

    if args.command == "ppo":
        print(json.dumps(ppo_plan(data_dir), indent=2))


def build_dataset(data_dir: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for frame in iter_rollout_frames(data_dir / "rollouts"):
        obs = frame.get("observation") or {}
        action = frame.get("action")
        if not obs or not action:
            continue
        rows.append({
            "schema": "aira-movement-dataset-v1",
            "skill": obs.get("skill") or "unknown",
            "observation": {
                "airaState": obs.get("airaState"),
                "goalState": obs.get("goalState"),
                "injuryState": obs.get("injuryState"),
                "jointsActual": obs.get("jointsActual"),
                "objects": obs.get("objects"),
                "objectPoses": obs.get("objectPoses"),
            },
            "action": action,
            "reward": frame.get("reward") or {},
        })
    return rows


def training_status(data_dir: Path) -> Dict[str, Any]:
    dataset = build_dataset(data_dir)
    lessons = count_jsonl(data_dir / "movement_lessons.jsonl")
    by_skill: Dict[str, int] = {}
    for row in dataset:
        by_skill[row["skill"]] = by_skill.get(row["skill"], 0) + 1
    return {
        "rollout_frames": len(dataset),
        "movement_lessons": lessons,
        "rows_by_skill": by_skill,
        "behavior_cloning_ready": len(dataset) >= 1000,
        "ppo_ready": len(dataset) >= 1000,
        "notes": [
            "Collect at least 1000 observation/action rows for a first tiny BC run.",
            "PPO can start once the simulator bridge is stable and a skill has enough safe rollouts.",
        ],
    }


def behavior_clone_plan(data_dir: Path) -> Dict[str, Any]:
    status = training_status(data_dir)
    return {
        "algorithm": "behavior_cloning",
        "ready": status["behavior_cloning_ready"],
        "dataset_command": "python backend/train_movement_policy.py dataset",
        "next_step": "Add a torch MLP that maps compact observations to joint targets/gains once enough rows exist.",
        "status": status,
    }


def ppo_plan(data_dir: Path) -> Dict[str, Any]:
    status = training_status(data_dir)
    return {
        "algorithm": "ppo",
        "ready": status["ppo_ready"],
        "rollout_source": "ws://localhost:8000/api/movement/ws + browser/headless simulator",
        "reward_priority": ["not_falling", "human_like", "finishing_task"],
        "next_step": "Use the WebSocket loop to collect batches, then update a torch policy with clipped PPO loss.",
        "status": status,
    }


def iter_rollout_frames(rollout_dir: Path) -> Iterable[Dict[str, Any]]:
    if not rollout_dir.exists():
        return
    for path in sorted(rollout_dir.glob("*.jsonl")):
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if row.get("final"):
                    continue
                yield row


def count_jsonl(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build datasets and inspect Aira movement-training readiness.")
    parser.add_argument("command", choices=["status", "dataset", "bc", "ppo"], help="Training utility command.")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Movement data directory.")
    return parser.parse_args()


if __name__ == "__main__":
    main()
