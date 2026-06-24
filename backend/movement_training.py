"""
Movement training and WebSocket bridge for the AI-3D simulator.

This module provides:
- FastAPI router at prefix /movement (router variable)
- A WebSocket handler /movement/ws used by the frontend simulator
- Episode recording to backend/data/movement/rollouts/*.jsonl
- ExperienceBatcher: an asynchronous background uploader that batches
  recorded frames and posts them to AiraPix's /train/online endpoint
  (local or remote). The batcher is conservative and non-blocking.

Notes:
- Configure online training target via ENV TRAIN_ONLINE_URL (defaults to
  http://127.0.0.1:8001/train/online). If using the local airapix wrapper,
  ensure that service is running.
- Configure auth via AIRA_PIX_AUTH_HEADER / AIRA_PIX_API_KEY for the batcher
  POST requests if your AiraPix server requires it.

Safety:
- The batcher posts experience in batches but does not block inference.
- The backend still uses SafeMotorPolicy as a fallback for per-step safety.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from pathlib import Path
from datetime import datetime, timezone
import os
import json
import threading
import time
import logging

try:
    import requests
except Exception:
    requests = None

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data" / "movement"
ROLLOUT_DIR = DATA_DIR / "rollouts"
LESSON_FILE = DATA_DIR / "movement_lessons.jsonl"

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/movement", tags=["movement-training"])

# Environment-configurable training endpoint and batching behavior
TRAIN_ONLINE_URL = os.getenv("TRAIN_ONLINE_URL") or os.getenv("REMOTE_AIRA_PIX_URL") or "http://127.0.0.1:8001/train/online"
AIRA_PIX_AUTH_HEADER = os.getenv("AIRA_PIX_AUTH_HEADER")
AIRA_PIX_API_KEY = os.getenv("AIRA_PIX_API_KEY")
BATCH_SIZE = int(os.getenv("TRAIN_BATCH_SIZE", "64"))
BATCH_INTERVAL = float(os.getenv("TRAIN_BATCH_INTERVAL", "3.0"))  # seconds
BATCH_MAX = int(os.getenv("TRAIN_BATCH_MAX", "5000"))
REQUEST_TIMEOUT = float(os.getenv("AIRA_PIX_TIMEOUT", "5.0"))

# Training ladder and simple metadata
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


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def ensure_dirs() -> None:
    ROLLOUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


class ExperienceBatcher:
    """Collects frames and posts them in batches to the AiraPix online-train endpoint.

    Behavior:
    - add(item): append an experience item (dict with observation/action/reward)
    - background thread wakes every BATCH_INTERVAL seconds and attempts to post
      if there are at least BATCH_SIZE items, or if interval elapsed and there
      is any data.
    - on failure, it keeps the buffer and uses exponential backoff; buffer is
      capped at BATCH_MAX to avoid unbounded memory growth.
    """

    def __init__(self, url: str, batch_size: int = 64, interval: float = 3.0, max_items: int = 5000):
        self.url = url
        self.batch_size = batch_size
        self.interval = interval
        self.max_items = max_items
        self._lock = threading.Lock()
        self._buffer: List[Dict[str, Any]] = []
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True, name="ExperienceBatcher")
        self._backoff = 1.0
        self._last_post = 0.0
        self._thread.start()

    def add(self, item: Dict[str, Any]) -> None:
        with self._lock:
            self._buffer.append(item)
            # enforce cap
            if len(self._buffer) > self.max_items:
                # drop oldest
                excess = len(self._buffer) - self.max_items
                logger.warning("ExperienceBatcher buffer full: dropping %d oldest items", excess)
                self._buffer = self._buffer[excess:]

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=2.0)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._maybe_post()
            except Exception:
                logger.exception("ExperienceBatcher encountered an error in _run")
            # sleep a short time to be responsive to stop
            time.sleep(0.25)

    def _maybe_post(self) -> None:
        now = time.time()
        with self._lock:
            n = len(self._buffer)
            if n == 0:
                return
            should_post = n >= self.batch_size or (now - self._last_post) >= self.interval
            if not should_post:
                return
            # prepare a batch (take up to batch_size)
            to_send = self._buffer[: min(n, self.batch_size)]
        # perform post outside lock
        try:
            headers = {"Content-Type": "application/json"}
            if AIRA_PIX_AUTH_HEADER and AIRA_PIX_API_KEY:
                headers[AIRA_PIX_AUTH_HEADER] = AIRA_PIX_API_KEY
            if requests is None:
                logger.warning("requests not available; cannot post training batch")
                return
            resp = requests.post(self.url, json={"experience": to_send}, headers=headers, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            # success: remove sent items from buffer
            with self._lock:
                self._buffer = self._buffer[len(to_send) :]
            self._last_post = time.time()
            self._backoff = 1.0
            logger.info("Posted training batch of %d examples to %s", len(to_send), self.url)
        except requests.RequestException as e:
            # network or server error; backoff, keep buffer
            logger.warning("Failed to post training batch: %s", e)
            # exponential backoff up to 60s
            time.sleep(min(60.0, self._backoff))
            self._backoff = min(60.0, self._backoff * 2)
        except Exception:
            logger.exception("Unexpected error when posting training batch")


# Create a global batcher instance on module import
batcher = ExperienceBatcher(TRAIN_ONLINE_URL, batch_size=BATCH_SIZE, interval=BATCH_INTERVAL, max_items=BATCH_MAX)


class MovementLesson(BaseModel):
    id: str = Field(default_factory=lambda: f"lesson-{utc_stamp()}")
    kind: str = "movement_lesson"
    skill: str = "unknown"
    reason: str = "review"
    text: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    t: str = Field(default_factory=lambda: utc_iso())


@router.get("/config")
async def movement_config() -> Dict[str, Any]:
    return {
        "schema": "aira-movement-v1",
        "ladder": TRAINING_LADDER,
        "rollout_dir": str(ROLLOUT_DIR),
        "training_endpoint": TRAIN_ONLINE_URL,
        "batch_size": BATCH_SIZE,
        "batch_interval": BATCH_INTERVAL,
    }


@router.post("/lesson")
async def record_lesson(lesson: MovementLesson) -> Dict[str, Any]:
    saved = save_lesson(lesson.model_dump())
    return {"ok": True, "lesson": saved}


@router.get("/lessons")
async def list_lessons(limit: int = 50) -> Dict[str, Any]:
    ensure_dirs()
    rows: List[Dict[str, Any]] = []
    if LESSON_FILE.exists():
        for line in LESSON_FILE.read_text(encoding="utf-8").splitlines()[-limit:]:
            try:
                rows.append(json.loads(line))
            except Exception:
                continue
    return {"lessons": list(reversed(rows))}


@router.websocket("/ws")
async def movement_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    ensure_dirs()

    # policy selection
    policy_name = os.getenv("MOVEMENT_POLICY", "safe").lower()

    # Attempt to use AiraPix REST adapter (local wrapper or remote) via simple HTTP post
    policy = None
    if policy_name == "airapix":
        # we will call /predict on REMOTE_AIRA_PIX_URL if set, otherwise assume local wrapper at http://127.0.0.1:8001/predict
        predict_url = os.getenv("REMOTE_AIRA_PIX_URL")
        if not predict_url:
            predict_url = os.getenv("AIRA_PIX_URL") or "http://127.0.0.1:8001/predict"
        policy = RemoteAiraPolicy(predict_url)
    else:
        policy = SafeMotorPolicy()

    recorder = EpisodeRecorder(batcher)
    # send hello
    await websocket.send_json({
        "type": "hello",
        "schema": "aira-movement-v1",
        "policy": getattr(policy, "name", "safe_bootstrap_policy"),
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
                    save_lesson(lesson)
                await websocket.send_json({"type": "ack", "event": "episode_end"})
                continue

            try:
                action = policy.predict(observation, reward)
            except Exception:
                logger.exception("Policy predict failed, falling back to SafeMotorPolicy")
                action = SafeMotorPolicy().predict(observation, reward)

            recorder.append(observation, action, reward)
            await websocket.send_json({"type": "action", "action": action})
    except WebSocketDisconnect:
        recorder.flush_partial()


class RemoteAiraPolicy:
    name = "airapix_rest_policy"

    def __init__(self, url: str):
        self.url = url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if AIRA_PIX_AUTH_HEADER and AIRA_PIX_API_KEY:
            self.headers[AIRA_PIX_AUTH_HEADER] = AIRA_PIX_API_KEY

    def predict(self, observation: Dict[str, Any], reward: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"observation": compact_observation(observation)}
        if requests is None:
            raise RuntimeError("requests required for RemoteAiraPolicy")
        resp = requests.post(self.url, json=payload, headers=self.headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        action = data.get("action") if isinstance(data, dict) else None
        if not action:
            raise RuntimeError("Invalid action response from AiraPix")
        # Basic safety: ensure action has expected keys and reasonable numeric values
        return sanitize_action(action)


def sanitize_action(action: Dict[str, Any]) -> Dict[str, Any]:
    # shallow clipping to safe ranges
    gains = action.get("gains", {})
    if isinstance(gains, dict):
        gains["stiffness"] = float(max(10.0, min(120.0, gains.get("stiffness", 50))))
        gains["damping"] = float(max(0.0, min(50.0, gains.get("damping", 12))))
        gains["torqueLimit"] = float(max(0.01, min(1.0, gains.get("torqueLimit", 0.3))))
        gains["forceLimit"] = float(max(1.0, min(200.0, gains.get("forceLimit", 28.0))))
        action["gains"] = gains
    # clip joint angles if present
    joints = action.get("joints", {})
    if isinstance(joints, dict):
        for name, val in list(joints.items()):
            if isinstance(val, dict):
                for k, v in list(val.items()):
                    try:
                        num = float(v)
                    except Exception:
                        num = 0.0
                    if k in {"yaw", "pitch", "roll"}:
                        num = max(-180.0, min(180.0, num))
                    if k == "bend":
                        num = max(0.0, min(180.0, num))
                    val[k] = round(num, 3)
                joints[name] = val
        action["joints"] = joints
    return action


class SafeMotorPolicy:
    """Conservative bootstrap policy; keeps Aira safe when learned policy fails."""

    name = "safe_bootstrap_policy"

    def predict(self, observation: Dict[str, Any], reward: Dict[str, Any]) -> Dict[str, Any]:
        skill = observation.get("skill") or "stand"
        tick = int(observation.get("tick") or 0)
        phase = (tick % 60) / 60.0
        base = neutral_joints()
        root_velocity = [0.0, 0.0]

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
            "rootIntent": {"velocity": root_velocity, "jump": False, "crouch": 0.0},
        }
        return action


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
    import math
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
    dist = max(1e-6, (dx * dx + dz * dz) ** 0.5)
    speed = min(max_speed, dist * 0.8)
    return [round(dx / dist * speed, 3), round(dz / dist * speed, 3)]


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


class EpisodeRecorder:
    def __init__(self, batcher: ExperienceBatcher):
        self.episode_id = f"episode-{utc_stamp()}"
        self.frames: List[Dict[str, Any]] = []
        self.batcher = batcher

    def append(self, observation: Dict[str, Any], action: Dict[str, Any], reward: Dict[str, Any]) -> None:
        frame = {
            "t": utc_iso(),
            "observation": compact_observation(observation),
            "action": action,
            "reward": reward,
        }
        self.frames.append(frame)
        # add to experience batcher (non-blocking)
        try:
            self.batcher.add(frame)
        except Exception:
            logger.exception("Failed to add frame to batcher")
        if len(self.frames) >= 500:
            self.flush_partial()

    def finish(self, observation: Dict[str, Any], reward: Dict[str, Any], episode_end: Dict[str, Any], lesson: Optional[Dict[str, Any]]) -> None:
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


# --- utility functions ---

def count_jsonl(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def save_rollout_dataset(data_dir: Path) -> None:
    # helper to build datasets in a separate script; not used here
    pass


# End of file
