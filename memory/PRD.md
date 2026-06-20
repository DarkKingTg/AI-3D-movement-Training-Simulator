# Aira Motion Lab — PRD

## Original Problem Statement
Build a simulation application for **Aira** — a female child humanoid — to learn human movements (walking, running, jumping, etc.) inside an interactive 3D scene with an optimised physics engine. The user can assign goals, spawn obstacles, watch her interact, **teach her motor patterns**, and **read every sensor signal that an AI controller would consume**.

## User Choices (explicit)
- Engine: **React Three Fiber + Rapier**
- Movement: **Procedural / physics-driven**
- Goals (v1): Follow Light, Follow Object, Lift Object, Jump Over Obstacle, Walk to Target
- Character: Female-child humanoid
- Persistence: **localStorage**

## Architecture
- **Frontend**: React 19 + CRA/Craco + Tailwind + Shadcn UI
- **3D**: `@react-three/fiber` v9, `@react-three/drei` v10, `@react-three/rapier` v1
- **State**: `zustand` store + localStorage hydration
- **Backend**: FastAPI (template only)

## Implemented Features (v1.4)
### Core simulation
- 3D viewport with R3F + Rapier physics; orbit/follow/top camera modes
- **Dual ragdoll modes**:
  - **Kinematic** (default): single capsule physics body with articulated cosmetic skeleton — runs motion library + curriculum
  - **Physics**: true multi-body ragdoll — 12 dynamic Rapier bodies connected by **spherical** (waist, neck, shoulders, hips) and **revolute** (elbows, knees) joints; self-collision filtered via `interactionGroups([1],[0])`
  - **Upright lock toggle**: locks pelvis Y translation + X/Z rotations so she stays standing while limbs hang from joints; un-lock for full ragdoll collapse
- AiController: velocity-based locomotion driving pelvis toward goal target
- 6 goals: Idle / Walk to Target / Follow Light / Follow Object / Lift Object / Jump Obstacle
- Spawnable objects: Box · Ramp · Ball · Target · Light · Lift-Crate (with HTML labels)
- Save/Wipe localStorage, Pause/Reset/Reset-Aira (handles both ragdoll modes)

### Articulation & Senses (AI Input)
- **Articulated skeleton**: spine, head, l/r shoulders, elbows, wrists, fingers, hips, knees as nested groups
- **Anatomical joint limits** (anatomy.js): clamped at human RoM (e.g. elbow 0–145°, neck ±70° yaw)
- **JointDriver**: clamps + applies commanded angles every frame; writes back applied angles as proprioception
- **VisionCamera**: renders Aira's first-person eye-view at 96×72×100° FOV into a WebGL RenderTarget, reads pixels into Uint8Array (~6 Hz)
- **IMU**: head & pelvis Yaw/Pitch/Roll, head linear acceleration (~10 Hz)
- **Visible-object raycast**: lists objects inside FOV with distance & angular offset
- **ContactSensor**: collision pairs against the body collider (force estimate)
- **`window.airaAiInput`**: live JS bridge exposing `senses`, `jointsActual`, `stats` for external AI consumption
- **SensorPanel**: floating bottom-right panel showing live vision thumbnail, IMU, proprioception (14 joints), visible objects, contacts
- **JointPanel** (Manual Posing): bottom-center slider panel — every joint axis with anatomical clamps

### Teach Aira (motor learning)
- **MotionLibrary** with 8 keyframe clips: Idle · Walk Cycle · Run Cycle · Standing Jump · Wave Hello · Sit Down · Reach Forward · Squat
- **MotionPlayer**: linearly interpolates keyframes onto Aira's joints in real time
- **TeachPanel**: top-center panel listing motions with description + duration + keyframe count; play/stop + speed slider
- While a motion plays, the AI Input Feed live-streams the resulting joint angles and head orientation — the exact data an AI would learn from

### Curriculum / Mission mode
- **6 progressive levels** (Steady Steps → Stretching Out → First Obstacle → Slalom → Ramp & Ball → Marathon Mind)
- Auto-spawns target + obstacles per level layout
- **Live lap timer** + **best-time per level** + total best Σ + lap history
- **Personal-best PR detection** (yellow pulse)
- **Share Mission Report** — copies summary to clipboard

## File Layout
```
/app/frontend/src/
├── App.js, index.js, index.css
├── store/simStore.js                   # zustand state, persistence, sensor writes
├── constants/testIds.js
├── pages/Simulation.jsx                # main layout
├── components/sim/
│   ├── TopBar.jsx                      # pause / reset / camera modes
│   ├── LeftSidebar.jsx                 # profile, curriculum, goals, spawner
│   ├── RightSidebar.jsx                # telemetry, sliders, save
│   ├── CurriculumPanel.jsx             # mission UI
│   ├── SensorPanel.jsx                 # AI Input Feed (vision / IMU / joints / contacts)
│   ├── JointPanel.jsx                  # manual posing sliders
│   ├── TeachPanel.jsx                  # motion library UI
│   └── VisionThumbnail.jsx             # paints Aira's eye-view onto a canvas
└── sim/
    ├── SimulationCanvas.jsx            # R3F + Physics root
    ├── Ground.jsx                      # ground plane
    ├── AiraRagdoll.jsx                 # articulated humanoid
    ├── AiController.jsx                # goal-driven locomotion
    ├── JointDriver.jsx                 # joint clamping + proprioception
    ├── MotionPlayer.jsx                # keyframe playback
    ├── motionLibrary.js                # 8 motion clips
    ├── anatomy.js                      # joint limits / defaults
    ├── VisionCamera.jsx                # first-person render + pixel readback
    ├── ContactSensor.jsx               # collision -> contacts
    ├── CurriculumDirector.jsx          # mission state machine
    ├── curriculum.js                   # 6 level layouts
    ├── SpawnedObject.jsx               # obstacle/target/ball/light/lift-box
    └── CameraRig.jsx                   # camera modes
```

## Prioritised Backlog
### P1 (next)
- **Real multi-joint Rapier ragdoll** (spherical hips/shoulders + revolute knees/elbows) for true limb physics. Current limbs are kinematically driven cosmetic bones; switching them to dynamic bodies + joint constraints will give physical impact reactions, ragdoll falls, and proper grasping.
- Record custom motion clips (snapshot current joints → keyframe → save sequence)

### P2
- GLB import for a hyper-realistic Aira avatar
- Procedural terrain / staircases
- Replay mode / record-playback of attempts
- WebRTC stream sharing live training session

## Test credentials
None — fully client-side.
