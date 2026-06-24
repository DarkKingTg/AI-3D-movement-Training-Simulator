# Aira 3D Movement Training Simulator

This app connects a React Three Fiber + Rapier physics simulator to Aira's
separate movement policy through the `aira-movement-v1` bridge.

Aira's chat/core brain should supervise goals, memory, and review. The simulator
does not ask the language model to directly output dangerous torques. Instead,
the motor policy receives body observations and returns safe joint targets,
motor gains, and object interaction intents.

## Does Aira Start Automatically?

Yes, partly.

When the frontend opens, the simulator starts Aira's body, sensors, damage
system, reward calculation, lesson memory, and browser bridge automatically.

If the backend is running, the frontend also automatically tries to connect to:

```text
ws://localhost:8000/api/movement/ws
```

If the backend is not running, Aira still appears in the simulator and the bridge
runs in local mode, but the Python motor policy will not control her until the
backend is started.

## Start The App

Open two PowerShell terminals from the project folder:

```powershell
cd C:\Users\WaveWalker\Downloads\MyStuffs\ForPro\MyWorks\Projects\AI-3D-movement-Training-Simulator
```

Terminal 1: start the backend movement service.

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2: start the 3D simulator.

```powershell
cd frontend
npm install
npm run start
```

Then open:

```text
http://127.0.0.1:3000
```

Check backend status:

```text
http://127.0.0.1:8000/api/movement/config
```

## Connect Aira Manually

The browser exposes these bridge objects:

```js
window.airaAiInput              // latest full observation
window.airaAiOutput(action)     // apply a motor action
window.airaTrainingBridge       // set skill, mode, reset episode
```

Example manual action from the browser console:

```js
window.airaAiOutput({
  joints: {
    lKnee: { bend: 20 },
    rKnee: { bend: 20 },
    spine: { pitch: 5 }
  },
  gains: {
    stiffness: 45,
    damping: 14,
    torqueLimit: 0.3
  },
  rootIntent: {
    velocity: [0.5, 0]
  }
})
```

Change skill from the console:

```js
window.airaTrainingBridge.setSkill("walk")
window.airaTrainingBridge.resetEpisode("manual_training_reset")
```

## Teach Aira In Visible Mode

1. Start backend and frontend.
2. Open `http://127.0.0.1:3000`.
3. In the right sidebar, find `Movement Policy`.
4. Start with `stand`.
5. Let Aira run episodes.
6. If she falls or breaks a body part, the simulator writes a movement lesson.
7. Click `Next` to move through the ladder:

```text
stand -> balance -> walk -> recover -> run -> jump -> stairs -> push_pull_lift
```

Use the left sidebar to spawn objects for push, pull, lift, and carry training.

## Watch Aira's Inner State Pipeline

Click `Inner State` on the right side of the simulator to watch Aira-specific
training modulators:

- mood state
- valence
- arousal
- stress
- confidence
- fatigue
- pain load
- dopamine-like reward drive
- cortisol-like stress load
- adrenaline-like readiness
- oxytocin-like trust/bond signal
- endorphin-like pain buffer

These are simulated AI training signals, not medical or biological measurements.
They are derived from reward, contact force, injuries, falls, successful episodes,
movement speed, and recent lessons.

The current inner state is also included in every bridge observation as:

```js
window.airaAiInput.innerState
```

This lets Aira's core/memory system review movement lessons together with mood,
stress, pain, and confidence context.

## Upload Models

Open the Avatar panel and upload a `.glb` or `.gltf`.

If the model has a humanoid skeleton, the app guesses bone mappings and can drive
the visual mesh from Aira's physics body.

If the model does not have a humanoid skeleton, Aira uses the normalized proxy
physics rig. The visual model can still be shown, but training always uses the
safe proxy body.

## Damage, Reset, And Memory

The simulator can end an episode when Aira uses unsafe movement:

- excessive contact impulse
- excessive joint torque
- joint hyperextension
- extreme angular velocity
- high acceleration/G-load

When this happens, the simulator records a lesson such as:

```text
I broke my left leg because I commanded the knee too fast. Next time I should reduce joint speed, lower stiffness, and recover balance before moving again.
```

Lessons are saved under:

```text
backend/data/movement/
```

## Build Datasets

Movement rollouts are recorded as JSONL. Build a compact dataset with:

```powershell
python backend/train_movement_policy.py dataset
```

Check training readiness:

```powershell
python backend/train_movement_policy.py status
```

Inspect the behavior-cloning and PPO readiness plans:

```powershell
python backend/train_movement_policy.py bc
python backend/train_movement_policy.py ppo
```

The generated dataset is written to:

```text
backend/data/movement/datasets/movement_dataset.jsonl
```

## Headless Training Rollouts

Headless mode runs the simulator in hidden Chromium and records observations
faster than normal visible watching.

Install Chromium once:

```powershell
python -m playwright install chromium
```

Run a 60 second stand rollout:

```powershell
python backend/headless_rollout.py --url http://localhost:3000 --skill stand --seconds 60
```

Run a walk rollout:

```powershell
python backend/headless_rollout.py --url http://localhost:3000 --skill walk --seconds 120
```

## Current Training State

The current implementation includes:

- simulator bridge
- Python WebSocket movement service
- safe starter motor policy
- visible mode
- headless rollout capture
- damage/break detection
- movement lesson memory
- dataset builder
- BC/PPO readiness commands

Real behavior cloning and PPO model optimization are scaffolded, but they need
more collected rollout data before a useful learned policy can be trained.
