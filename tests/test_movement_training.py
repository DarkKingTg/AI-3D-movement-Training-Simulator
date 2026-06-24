import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import movement_training as mt  # noqa: E402


def test_safe_policy_outputs_bounded_walk_action():
    policy = mt.SafeMotorPolicy()
    obs = {
        "skill": "walk",
        "tick": 12,
        "airaState": {"pos": [0, 1, 0]},
        "goalState": {"targetPosition": [4, 0, 0]},
    }

    action = policy.predict(obs, {"total": 0})

    assert action["schema"] == "aira-movement-v1"
    assert action["gains"]["torqueLimit"] <= 0.4
    assert 0 < action["rootIntent"]["velocity"][0] <= 1.0
    assert abs(action["rootIntent"]["velocity"][1]) < 0.001
    assert "lHip" in action["joints"]


def test_lesson_persistence_uses_jsonl(tmp_path, monkeypatch):
    lesson_file = tmp_path / "movement_lessons.jsonl"
    rollout_dir = tmp_path / "rollouts"
    monkeypatch.setattr(mt, "LESSON_FILE", lesson_file)
    monkeypatch.setattr(mt, "ROLLOUT_DIR", rollout_dir)

    saved = mt.save_lesson({"text": "I slowed my knee before standing.", "skill": "stand"})

    assert saved["id"].startswith("lesson-")
    assert lesson_file.exists()
    assert "I slowed my knee" in lesson_file.read_text(encoding="utf-8")


def test_episode_recorder_writes_rollout(tmp_path, monkeypatch):
    monkeypatch.setattr(mt, "ROLLOUT_DIR", tmp_path)
    recorder = mt.EpisodeRecorder()

    recorder.append({"tick": 1, "skill": "stand"}, {"joints": {}}, {"total": 1})
    recorder.finish({"tick": 2}, {"total": 2}, {"reason": "success"}, None)

    files = list(tmp_path.glob("episode-*.jsonl"))
    assert files
    assert '"final":true' in files[0].read_text(encoding="utf-8")
