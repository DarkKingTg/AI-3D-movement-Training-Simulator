import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

try:
    import requests
except ImportError:
    requests = None


ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data" / "movement"
ROLLOUT_DIR = DATA_DIR / "rollouts"
LESSON_FILE = DATA_DIR / "movement_lessons.jsonl"

TRAINING_LADDER = [
    "stand",
    "balance",
    "walk",
    "recover",
    "run",
    "jump",
    "stairs",
    "push_pull_lift",
]


class MovementLesson(BaseModel):
    id: str = Field(default_factory=lambda: f"lesson-{utc_stamp()}")
    kind: str = "movement_lesson"
    skill: str = "unknown"
    reason: str = "review"
    text: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    t: str = Field(default_factory=lambda: utc_iso())


class TrainingPhaseStatus(BaseModel):
    phase: str
    ready: bool
    notes: str


router = APIRouter(prefix="/movement", tags=["movement-training"])


@router.get("/config")
async def movement_config() -> Dict[str, Any]:
    return {
        "schema": "aira-movement-v1",
        "ladder": TRAINING_LADDER,
        "default_algorithm": "imitation_plus_ppo",
        "priority": ["not_falling", "human_like", "finishing_task"],
        "rollout_dir": str(ROLLOUT_DIR),
        "phases": [
            TrainingPhaseStatus(
                phase="demonstration_capture",
                ready=True,
                notes="Records simulator observations/actions and MotionPlayer demos as JSONL.",
            ).model_dump(),
            TrainingPhaseStatus(
                phase="behavior_cloning",
                ready=False,
                notes="Scaffolded; add PyTorch policy training after enough demonstrations exist.",
            ).model_dump(),
            TrainingPhaseStatus(
                phase="ppo_finetuning",
                ready=False,
                notes="Scaffolded; use this WebSocket as the rollout environment connector.",
            ).model_dump(),
        ],
    }


@router.post("/lesson")
async def record_lesson(lesson: MovementLesson) -> Dict[str, Any]:
    saved = save_lesson(lesson.model_dump())
    forward_lesson_to_aira_core(saved)
    return {"ok": True, "lesson": saved}


@router.get("/lessons")
async def list_lessons(limit: int = 50) -> Dict[str, Any]:
    ensure_dirs()
    rows: List[Dict[str, Any]] = []
    if LESSON_FILE.exists():
        for line in LESSON_FILE.read_text(encoding="utf-8").splitlines()[-limit:]:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return {"lessons": list(reversed(rows))}


@router.websocket("/ws")
async def movement_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    ensure_dirs()
    policy = SafeMotorPolicy()
    recorder = EpisodeRecorder()
    await websocket.send_json({
        "type": "hello",
        "schema": "aira-movement-v1",
        "policy": "safe_bootstrap_policy",
        "ladder": TRAINING_LADDER,
    })

    try:
        while True:
            payload = await websocket.receive_json()
            msg_type = payload.get("type", "observation")
            observation = payload.get("observation") or payload.get("state") or payload
            reward = payload.get("reward") or {}

            if msg_type == "episode_end":
                lesson = payload.get("lesson")
                episode_end = payload.get("episodeEnd") or {}
                recorder.finish(observation, reward, episode_end, lesson)
                if lesson:
                    saved = save_lesson(lesson)
                    forward_lesson_to_aira_core(saved)
                await websocket.send_json({"type": "ack", "event": "episode_end"})
                continue

            action = policy.predict(observation, reward)
            recorder.append(observation, action, reward)
            await websocket.send_json({"type": "action", "action": action})
    except WebSocketDisconnect:
        recorder.flush_partial()


class SafeMotorPolicy:
    """A conservative bootstrap policy. Real BC/PPO can replace this class later."""

    def predict(self, observation: Dict[str, Any], reward: Dict[str, Any]) -> Dict[str, Any]:
        skill = observation.get("skill") or "stand"
        tick = int(observation.get("tick") or 0)
        phase = (tick % 60) / 60.0
        base = neutral_joints()
        root_velocity = [0.0, 0.0]
        manipulation: Optional[Dict[str, Any]] = None

        if skill in {"walk", "recover", "stairs", "push_pull_lift"}:
            base.update(walk_gait(phase, amplitude=1.0))
            root_velocity = goal_velocity(observation, max_speed=1.0 if skill != "stairs" else 0.65)
        elif skill == "run":
            base.update(walk_gait(phase, amplitude=1.45))
            root_velocity = goal_velocity(observation, max_speed=1.8)
        elif skill == "jump":
            base.update(jump_pose(phase))
        elif skill == "balance":
            base["spine"] = {"yaw": 0, "pitch": 3, "roll": 0}
            base["lKnee"] = {"bend": 8}
            base["rKnee"] = {"bend": 8}

        if skill == "push_pull_lift":
            target = nearest_dynamic_object(observation)
            if target:
                manipulation = {
                    "type": "push",
                    "targetId": target.get("id"),
                    "force": 10,
                    "direction": [0, 0, 1],
                }

        action: Dict[str, Any] = {
            "schema": "aira-movement-v1",
            "source": "safe_bootstrap_policy",
            "joints": base,
            "gains": {
                "stiffness": 52,
                "damping": 14,
                "sphereTorqueK": 0.01,
                "sphereTorqueD": 0.006,
                "torqueLimit": 0.35,
                "forceLimit": 28,
            },
            "rootIntent": {
                "velocity": root_velocity,
                "jump": skill == "jump" and 0.25 < phase < 0.34,
                "crouch": 0.7 if skill == "jump" and phase < 0.25 else 0.0,
            },
        }
        if manipulation:
            action["manipulation"] = manipulation
        return action


class EpisodeRecorder:
    def __init__(self) -> None:
        self.episode_id = f"episode-{utc_stamp()}"
        self.frames: List[Dict[str, Any]] = []

    def append(self, observation: Dict[str, Any], action: Dict[str, Any], reward: Dict[str, Any]) -> None:
        self.frames.append({
            "t": utc_iso(),
            "observation": compact_observation(observation),
            "action": action,
            "reward": reward,
        })
        if len(self.frames) >= 500:
            self.flush_partial()

    def finish(
        self,
        observation: Dict[str, Any],
        reward: Dict[str, Any],
        episode_end: Dict[str, Any],
        lesson: Optional[Dict[str, Any]],
    ) -> None:
        self.frames.append({
            "t": utc_iso(),
            "observation": compact_observation(observation),
            "reward": reward,
            "episode_end": episode_end,
            "lesson": lesson,
        })
        self.flush_partial(final=True)
        self.episode_id = f"episode-{utc_stamp()}"
        self.frames = []

    def flush_partial(self, final: bool = False) -> None:
        if not self.frames:
            return
        ensure_dirs()
        path = ROLLOUT_DIR / f"{self.episode_id}.jsonl"
        with path.open("a", encoding="utf-8") as f:
            for frame in self.frames:
                f.write(json.dumps(frame, separators=(",", ":")) + "\n")
            if final:
                f.write(json.dumps({"t": utc_iso(), "final": True}, separators=(",", ":")) + "\n")
        self.frames = []


class MovementTrainer:
    """Training scaffold for future BC + PPO implementation."""

    def record_demo(self, frames: List[Dict[str, Any]], name: str) -> Path:
        ensure_dirs()
        path = DATA_DIR / f"demo-{safe_name(name)}-{utc_stamp()}.jsonl"
        with path.open("w", encoding="utf-8") as f:
            for frame in frames:
                f.write(json.dumps(frame, separators=(",", ":")) + "\n")
        return path

    def behavior_clone(self) -> Dict[str, Any]:
        return {
            "ready": False,
            "next_step": "Install a torch policy module and train from demo JSONL observation/action pairs.",
        }

    def ppo_update(self) -> Dict[str, Any]:
        return {
            "ready": False,
            "next_step": "Use the WebSocket rollout connector as the environment loop for PPO batches.",
        }


def neutral_joints() -> Dict[str, Dict[str, float]]:
    return {
        "head": {"yaw": 0, "pitch": 0, "roll": 0},
        "spine": {"yaw": 0, "pitch": 2, "roll": 0},
        "lShoulder": {"pitch": 4, "yaw": 0, "roll": 0},
        "rShoulder": {"pitch": 4, "yaw": 0, "roll": 0},
        "lElbow": {"bend": 8},
        "rElbow": {"bend": 8},
        "lHip": {"pitch": 0, "yaw": 0, "roll": 0},
        "rHip": {"pitch": 0, "yaw": 0, "roll": 0},
        "lKnee": {"bend": 4},
        "rKnee": {"bend": 4},
    }


def walk_gait(phase: float, amplitude: float = 1.0) -> Dict[str, Dict[str, float]]:
    s = math.sin(phase * math.tau)
    c = math.sin(phase * math.tau + math.pi)
    return {
        "spine": {"yaw": 0, "pitch": 5 * amplitude, "roll": 0},
        "lHip": {"pitch": -22 * s * amplitude, "yaw": 0, "roll": 0},
        "rHip": {"pitch": -22 * c * amplitude, "yaw": 0, "roll": 0},
        "lKnee": {"bend": max(4, 32 * max(0, c) * amplitude)},
        "rKnee": {"bend": max(4, 32 * max(0, s) * amplitude)},
        "lShoulder": {"pitch": 18 * c * amplitude, "yaw": 0, "roll": 0},
        "rShoulder": {"pitch": 18 * s * amplitude, "yaw": 0, "roll": 0},
        "lElbow": {"bend": 25},
        "rElbow": {"bend": 25},
    }


def jump_pose(phase: float) -> Dict[str, Dict[str, float]]:
    if phase < 0.25:
        return {
            "spine": {"pitch": 18, "yaw": 0, "roll": 0},
            "lHip": {"pitch": -35, "yaw": 0, "roll": 0},
            "rHip": {"pitch": -35, "yaw": 0, "roll": 0},
            "lKnee": {"bend": 75},
            "rKnee": {"bend": 75},
            "lShoulder": {"pitch": -20, "yaw": 0, "roll": 0},
            "rShoulder": {"pitch": -20, "yaw": 0, "roll": 0},
        }
    if phase < 0.45:
        return {
            "spine": {"pitch": -5, "yaw": 0, "roll": 0},
            "lHip": {"pitch": 5, "yaw": 0, "roll": 0},
            "rHip": {"pitch": 5, "yaw": 0, "roll": 0},
            "lKnee": {"bend": 5},
            "rKnee": {"bend": 5},
            "lShoulder": {"pitch": 120, "yaw": 0, "roll": 0},
            "rShoulder": {"pitch": 120, "yaw": 0, "roll": 0},
        }
    return {
        "spine": {"pitch": 12, "yaw": 0, "roll": 0},
        "lHip": {"pitch": -20, "yaw": 0, "roll": 0},
        "rHip": {"pitch": -20, "yaw": 0, "roll": 0},
        "lKnee": {"bend": 45},
        "rKnee": {"bend": 45},
    }


def goal_velocity(observation: Dict[str, Any], max_speed: float) -> List[float]:
    target = (observation.get("goalState") or {}).get("targetPosition")
    pos = (observation.get("airaState") or {}).get("pos") or [0, 0, 0]
    if not target:
        return [0.0, 0.0]
    dx = float(target[0]) - float(pos[0])
    dz = float(target[2]) - float(pos[2])
    dist = max(1e-6, math.hypot(dx, dz))
    speed = min(max_speed, dist * 0.8)
    return [round(dx / dist * speed, 3), round(dz / dist * speed, 3)]


def nearest_dynamic_object(observation: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    objects = observation.get("objects") or []
    for obj in objects:
        if obj.get("type") in {"ball", "liftBox"}:
            return obj
    return None


def compact_observation(observation: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "schema": observation.get("schema"),
        "tick": observation.get("tick"),
        "goal": observation.get("goal"),
        "skill": observation.get("skill"),
        "airaState": observation.get("airaState"),
        "goalState": observation.get("goalState"),
        "injuryState": observation.get("injuryState"),
        "jointsActual": observation.get("jointsActual"),
        "objects": observation.get("objects"),
        "objectPoses": observation.get("objectPoses"),
    }


def save_lesson(lesson: Dict[str, Any]) -> Dict[str, Any]:
    ensure_dirs()
    entry = dict(lesson)
    entry.setdefault("id", f"lesson-{utc_stamp()}")
    entry.setdefault("t", utc_iso())
    with LESSON_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, separators=(",", ":")) + "\n")
    return entry


def forward_lesson_to_aira_core(lesson: Dict[str, Any]) -> None:
    url = os.getenv("AIRA_CORE_MEMORY_URL")
    if not url or requests is None:
        return
    try:
        requests.post(url, json={"type": "movement_memory", "lesson": lesson}, timeout=2)
    except requests.RequestException:
        return


def ensure_dirs() -> None:
    ROLLOUT_DIR.mkdir(parents=True, exist_ok=True)


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def safe_name(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in name)[:48]
