# Aira Motion Lab — PRD

## Original Problem Statement
Build a simulation application for **Aira** (a female child humanoid) to learn human movements — walking, running, jumping, etc. — inside an interactive 3D scene with an optimised physics engine. The user should be able to assign goals (follow the light, follow object, lift object, jump over obstacle, walk to target), spawn 3D obstacles/objects, and watch Aira interact with the world.

## User Choices (explicit)
- Engine: **React Three Fiber + Rapier**
- Movement: **Procedural / physics-driven**
- Goals (v1): Follow Light, Follow Object, Lift Object, Jump Over Obstacle, Walk to Target
- Character: Female-child humanoid
- Persistence: **localStorage** (no backend persistence required)

## Architecture
- **Frontend**: React 19 + CRA/Craco + Tailwind + Shadcn UI
- **3D**: `@react-three/fiber` v9, `@react-three/drei` v10, `@react-three/rapier` v1 (Rapier physics)
- **State**: `zustand` store with localStorage hydration
- **Backend**: FastAPI (unchanged template, no domain endpoints required for v1)

## Implemented Features (v1)
- 3D viewport with R3F + Rapier physics (Ground + dynamic Aira + spawned objects)
- Procedural female-child humanoid (Aira) — single capsule physics body with cosmetic limbs (head, hair, twin braids, bow, arms, legs, shoes) procedurally animated each frame based on velocity (walking cycle, arm swing, head nod)
- AiController applies forces/impulses to drive Aira toward goal target
- 6 goals: Idle, Walk to Target, Follow the Light, Follow Object, Lift Object, Jump Over Obstacle
- Object spawner: Box (obstacle), Ramp, Ball, Target flag, Light, Lift-Crate (with HTML labels in scene)
- 3 camera modes: Orbit, Follow (camera tracks Aira), Top-down
- Telemetry: Pos, Velocity, Distance, State, Goal
- Counters: Attempts, Successes, Falls
- Motor parameter sliders: Speed, Balance, Jump Power
- Pause / Reset Aira / Save / Wipe local progress
- Goal-aware behaviour:
  - Walk-to-Target: walks toward target flag, decelerates near it, success when within 0.7m
  - Jump: triggers jump impulse when close to box/ramp
  - Lift: dispatches lift event that the LiftBox listens to and bumps upward
  - Follow Light: chases nearest light (or a virtual orbital light if none spawned)
  - Follow Object: chases ball or lift-crate

## Design System
- Archetype: Swiss & High-Contrast (Dark)
- Fonts: Chivo (heading), IBM Plex Sans (body), JetBrains Mono (telemetry)
- Accent colors: Klein Blue #002FA7 (primary), Signal Red #FF0000 (falls), Lemon Yellow #FFEA00 (obstacles), Pure Green #00FF00 (success)

## File Layout
```
/app/frontend/src/
├── App.js, index.js, index.css, App.css
├── store/simStore.js              # zustand state + localStorage
├── constants/testIds.js
├── pages/Simulation.jsx           # main layout
├── components/sim/
│   ├── TopBar.jsx                 # pause / reset / camera modes
│   ├── LeftSidebar.jsx            # profile, goals, spawner
│   └── RightSidebar.jsx           # telemetry, sliders, save
└── sim/
    ├── SimulationCanvas.jsx       # R3F Canvas + Physics
    ├── Ground.jsx
    ├── AiraRagdoll.jsx            # humanoid body + cosmetic limbs
    ├── AiController.jsx           # goal-driven physics controller
    ├── SpawnedObject.jsx          # box/ramp/ball/target/light/liftBox
    └── CameraRig.jsx              # orbit/follow/top camera
```

## Prioritised Backlog
### P1 (next steps)
- Full ragdoll joints (real spherical/revolute joints for limbs) — was attempted in v1 but reverted for stability; needs careful tuning
- Goal-progress UI (per-goal status bar, success/fail toasts)
- Drag-to-place objects in 3D scene with raycast
- Replay mode / record-playback of attempts

### P2
- Procedural terrain or stairs to climb
- GLB import for a realistic Aira avatar
- Reward-shaped curriculum (gradually harder obstacles)
- WebRTC streaming to share simulation sessions

## Test credentials
None — fully client-side.
