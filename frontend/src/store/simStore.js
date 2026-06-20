import { create } from "zustand";

const STORAGE_KEY = "aira_sim_state_v2";

export const GOALS = {
  IDLE: "idle",
  WALK: "walk_to_target",
  FOLLOW_LIGHT: "follow_light",
  FOLLOW_OBJECT: "follow_object",
  LIFT_OBJECT: "lift_object",
  JUMP_OBSTACLE: "jump_over_obstacle",
};

export const GOAL_LABELS = {
  [GOALS.IDLE]: "Idle / Stand",
  [GOALS.WALK]: "Walk to Target",
  [GOALS.FOLLOW_LIGHT]: "Follow the Light",
  [GOALS.FOLLOW_OBJECT]: "Follow Object",
  [GOALS.LIFT_OBJECT]: "Lift Object",
  [GOALS.JUMP_OBSTACLE]: "Jump Over Obstacle",
};

import { DEFAULT_JOINTS } from "@/sim/anatomy";

const initial = {
  goal: GOALS.IDLE,
  paused: false,
  cameraMode: "orbit",
  speed: 2.0,
  balance: 0.7,
  jumpPower: 5.5,
  objects: [],
  airaState: { pos: [0, 1, 0], vel: [0, 0, 0], status: "idle" },
  stats: { attempts: 0, successes: 0, falls: 0 },
  nextId: 1,
  resetSignal: 0,

  // --- NEW: articulation ---
  joints: structuredClone(DEFAULT_JOINTS), // commanded joint angles (deg)
  jointsActual: structuredClone(DEFAULT_JOINTS), // proprioception (clamped/applied)

  // --- NEW: senses (read-only, updated each frame by sensors) ---
  senses: {
    visionUpdatedAt: 0,
    visionWidth: 96,
    visionHeight: 72,
    visionFovDeg: 100,
    visionData: null, // ImageData-compatible Uint8ClampedArray
    contacts: [], // [{part, otherName, force, t}]
    imu: { headOrientationDeg: { yaw: 0, pitch: 0, roll: 0 }, pelvisOrientationDeg: { yaw: 0, pitch: 0, roll: 0 }, headAccel: [0,0,0] },
    proprioception: { joints: {}, t: 0 },
    distanceToTarget: 0,
    visibleObjects: [],
  },

  // Manual joint posing toggle
  jointPanelOpen: false,
  sensorPanelOpen: true,

  // --- Curriculum mode ---
  curriculum: {
    enabled: false,
    levelIdx: 0,
    lapStartedAt: 0,
    lapTimer: 0,
    bestTimes: {}, // { levelId: bestSeconds }
    history: [],   // [{ levelId, time, dateISO }]
    totalLapsCompleted: 0,
  },

  // --- Teaching / Motion clips ---
  teaching: {
    activeMotion: null,
    playing: false,
    speed: 1.0,
    time: 0,
  },

  // --- Ragdoll mode toggle ---
  ragdoll: {
    mode: "kinematic",
    pelvisLocked: true,
  },

  // --- Falls compilation / replay ---
  recorder: {
    enabled: true,
    recordingPostFall: false,
    postFallEndsAt: 0,
    peakForce: 0,
    levelHint: null,
  },
  fallsBuffer: [],
  fallsClips: [],
  fallsPanelOpen: false,
  playback: {
    clipId: null,
    speed: 0.5,
    frameIndex: 0,
    playing: false,
    startedAt: 0,
  },

  // --- Injury heatmap ---
  injuries: {
    enabled: true,
    levels: {},
  },

  // --- GLB Avatar ---
  glbAvatar: {
    url: null,
    filename: null,
    previewVisible: true,
    scale: 1.0,
    bones: [],
    mapping: {}, // glbBoneName -> airaSlot (e.g., "head", "lShoulder")
    driveSkeleton: false,    // when true, GLB anchors to pelvis & bones follow Aira's rotations
    hideProcedural: false,   // when true, hide the procedural Aira meshes (physics still simulating)
  },

  // --- AI Thinking / Pipeline visualization ---
  aiThinkingPanelOpen: false,
  pipelinePanelOpen: false,
  aiThoughts: [], // [{ id, kind: 'sense'|'decide'|'act'|'learn'|'reflex', text, t }]
  // pipelineStages: each stage has lastActiveAt timestamp; UI computes "active" pulse if recent
  pipelineStages: {
    vision:   { lastActiveAt: 0, label: "VISION",   color: "#00d4ff" },
    imu:      { lastActiveAt: 0, label: "IMU",      color: "#00ff88" },
    contacts: { lastActiveAt: 0, label: "CONTACTS", color: "#ff6666" },
    senses:   { lastActiveAt: 0, label: "SENSES",   color: "#A78BFA" },
    brain:    { lastActiveAt: 0, label: "BRAIN",    color: "#FFEA00" },
    motor:    { lastActiveAt: 0, label: "MOTOR",    color: "#ff9900" },
    physics:  { lastActiveAt: 0, label: "PHYSICS",  color: "#ff3366" },
    body:     { lastActiveAt: 0, label: "BODY",     color: "#ffffff" },
  },
};

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(state) {
  try {
    const toSave = {
      goal: state.goal,
      speed: state.speed,
      balance: state.balance,
      jumpPower: state.jumpPower,
      objects: state.objects,
      stats: state.stats,
      nextId: state.nextId,
      cameraMode: state.cameraMode,
      joints: state.joints,
      jointPanelOpen: state.jointPanelOpen,
      sensorPanelOpen: state.sensorPanelOpen,
      curriculum: {
        enabled: state.curriculum.enabled,
        levelIdx: state.curriculum.levelIdx,
        bestTimes: state.curriculum.bestTimes,
        history: state.curriculum.history.slice(0, 50),
        totalLapsCompleted: state.curriculum.totalLapsCompleted,
      },
      ragdoll: state.ragdoll,
      recorder: { enabled: state.recorder.enabled },
      fallsClips: state.fallsClips,
      fallsPanelOpen: state.fallsPanelOpen,
      injuries: { enabled: state.injuries.enabled },
      aiThinkingPanelOpen: state.aiThinkingPanelOpen,
      pipelinePanelOpen: state.pipelinePanelOpen,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

export const useSimStore = create((set, get) => {
  const saved = loadFromLocal();
  return {
    ...initial,
    ...(saved || {}),

    setGoal: (goal) => {
      set({ goal });
      get().incrementAttempt();
      persist(get());
    },

    togglePause: () => set((s) => ({ paused: !s.paused })),
    setCameraMode: (m) => {
      set({ cameraMode: m });
      persist(get());
    },

    setSpeed: (v) => { set({ speed: v }); persist(get()); },
    setBalance: (v) => { set({ balance: v }); persist(get()); },
    setJumpPower: (v) => { set({ jumpPower: v }); persist(get()); },

    spawnObject: (type, opts = {}) => {
      const id = get().nextId;
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4;
      const defaultPos = [Math.cos(angle) * radius, 1, Math.sin(angle) * radius];
      const obj = {
        id, type,
        position: opts.position || defaultPos,
        color: opts.color || null,
      };
      set((s) => ({ objects: [...s.objects, obj], nextId: s.nextId + 1 }));
      persist(get());
      return id;
    },

    removeObject: (id) => {
      set((s) => ({ objects: s.objects.filter((o) => o.id !== id) }));
      persist(get());
    },

    clearObjects: () => { set({ objects: [] }); persist(get()); },

    updateAiraState: (pos, vel, status) => set({ airaState: { pos, vel, status } }),

    incrementAttempt: () =>
      set((s) => ({ stats: { ...s.stats, attempts: s.stats.attempts + 1 } })),
    incrementSuccess: () => {
      set((s) => ({ stats: { ...s.stats, successes: s.stats.successes + 1 } }));
      persist(get());
    },
    incrementFall: () => {
      set((s) => ({ stats: { ...s.stats, falls: s.stats.falls + 1 } }));
      persist(get());
    },

    resetAira: () => set((s) => ({ resetSignal: s.resetSignal + 1 })),
    saveNow: () => persist(get()),
    resetAll: () => { localStorage.removeItem(STORAGE_KEY); set({ ...initial }); },

    // --- Joint commands ---
    setJoint: (jointName, key, valueDeg) => {
      set((s) => ({
        joints: { ...s.joints, [jointName]: { ...s.joints[jointName], [key]: valueDeg } },
      }));
      persist(get());
    },
    setJointAll: (jointName, values) => {
      set((s) => ({
        joints: { ...s.joints, [jointName]: { ...s.joints[jointName], ...values } },
      }));
      persist(get());
    },
    resetJoints: () => { set({ joints: structuredClone(DEFAULT_JOINTS) }); persist(get()); },

    // --- Sensor updates (called by sensor components each frame; bypass persist) ---
    updateProprioception: (jointsActual) => set({ jointsActual }),
    updateVision: (buf, w, h, fov) => set((s) => ({
      senses: { ...s.senses, visionData: buf, visionWidth: w, visionHeight: h, visionFovDeg: fov, visionUpdatedAt: Date.now() }
    })),
    addContact: (contact) => set((s) => ({
      senses: { ...s.senses, contacts: [contact, ...s.senses.contacts].slice(0, 25) }
    })),
    clearContacts: () => set((s) => ({ senses: { ...s.senses, contacts: [] } })),
    updateImu: (imu) => set((s) => ({ senses: { ...s.senses, imu } })),
    updateVisibleObjects: (list, distanceToTarget) => set((s) => ({
      senses: { ...s.senses, visibleObjects: list, distanceToTarget }
    })),

    toggleJointPanel: () => { set((s) => ({ jointPanelOpen: !s.jointPanelOpen })); persist(get()); },
    toggleSensorPanel: () => { set((s) => ({ sensorPanelOpen: !s.sensorPanelOpen })); persist(get()); },

    // --- Curriculum actions ---
    startCurriculum: () => {
      set((s) => ({ curriculum: { ...s.curriculum, enabled: true, levelIdx: s.curriculum.levelIdx || 0, lapStartedAt: 0, lapTimer: 0 } }));
      persist(get());
    },
    stopCurriculum: () => {
      set((s) => ({ curriculum: { ...s.curriculum, enabled: false, lapStartedAt: 0 } }));
      persist(get());
    },
    setLevelIdx: (idx) => {
      set((s) => ({ curriculum: { ...s.curriculum, levelIdx: Math.max(0, Math.min(idx, 5)) } }));
      persist(get());
    },
    startLap: () => set((s) => ({ curriculum: { ...s.curriculum, lapStartedAt: performance.now(), lapTimer: 0 } })),
    setLapTimer: (t) => set((s) => ({ curriculum: { ...s.curriculum, lapTimer: t } })),
    completeLap: (timeSec, level) => {
      const cur = get().curriculum;
      const prevBest = cur.bestTimes[level.id];
      const newBest = !prevBest || timeSec < prevBest ? timeSec : prevBest;
      set((s) => ({
        curriculum: {
          ...s.curriculum,
          lapStartedAt: 0,
          lapTimer: timeSec,
          bestTimes: { ...s.curriculum.bestTimes, [level.id]: newBest },
          history: [{ levelId: level.id, time: timeSec, dateISO: new Date().toISOString() }, ...s.curriculum.history].slice(0, 50),
          totalLapsCompleted: s.curriculum.totalLapsCompleted + 1,
          levelIdx: Math.min(s.curriculum.levelIdx + 1, 5),
        },
      }));
      persist(get());
    },
    setLevelObjects: (objs) => {
      const stamped = objs.map((o, i) => ({ id: 1000 + i, type: o.type, position: o.position, color: null }));
      set({ objects: stamped, nextId: 2000 });
    },
    setGoalSilent: (goal) => set({ goal }),

    // --- Teaching / Motion playback ---
    playMotion: (motionId, speed = 1.0) => {
      set((s) => ({ teaching: { ...s.teaching, activeMotion: motionId, playing: true, speed, time: 0 } }));
    },
    stopMotion: () => set((s) => ({ teaching: { ...s.teaching, playing: false } })),
    setMotionSpeed: (v) => set((s) => ({ teaching: { ...s.teaching, speed: v } })),
    setMotionTime: (t) => set((s) => ({ teaching: { ...s.teaching, time: t } })),

    // Non-persisted bulk joints write (used by MotionPlayer at 60fps)
    setJointsRaw: (joints) => set({ joints }),

    // --- Ragdoll mode ---
    setRagdollMode: (mode) => {
      set((s) => ({ ragdoll: { ...s.ragdoll, mode } }));
      persist(get());
    },
    setPelvisLocked: (locked) => {
      set((s) => ({ ragdoll: { ...s.ragdoll, pelvisLocked: locked } }));
      persist(get());
    },

    // --- Falls recorder ---
    toggleRecorder: () => {
      set((s) => ({ recorder: { ...s.recorder, enabled: !s.recorder.enabled } }));
      persist(get());
    },
    appendBuffer: (frame) =>
      set((s) => ({ fallsBuffer: [...s.fallsBuffer, frame].slice(-30) })),    // keep ~3s pre-fall @10Hz
    armFall: (peakForce, levelHint) =>
      set((s) => ({
        recorder: { ...s.recorder, recordingPostFall: true, postFallEndsAt: performance.now() + 3000, peakForce, levelHint },
      })),
    finalizeClip: (clip) =>
      set((s) => {
        const clips = [clip, ...s.fallsClips].slice(0, 8);
        return {
          fallsClips: clips,
          fallsBuffer: [],
          recorder: { ...s.recorder, recordingPostFall: false, postFallEndsAt: 0, peakForce: 0 },
        };
      }),
    removeClip: (id) => set((s) => ({ fallsClips: s.fallsClips.filter((c) => c.id !== id) })),
    clearClips: () => set({ fallsClips: [] }),
    toggleFallsPanel: () => {
      set((s) => ({ fallsPanelOpen: !s.fallsPanelOpen }));
      persist(get());
    },

    // --- Playback ---
    playClip: (clipId, speed = 0.5) =>
      set({ playback: { clipId, speed, frameIndex: 0, playing: true, startedAt: performance.now() } }),
    stopPlayback: () =>
      set((s) => ({ playback: { ...s.playback, playing: false, frameIndex: 0 } })),
    setPlaybackSpeed: (speed) => set((s) => ({ playback: { ...s.playback, speed } })),
    setPlaybackFrame: (frameIndex) => set((s) => ({ playback: { ...s.playback, frameIndex } })),

    // --- Injury heatmap ---
    toggleInjuries: () => {
      set((s) => ({ injuries: { ...s.injuries, enabled: !s.injuries.enabled } }));
      persist(get());
    },
    updateInjurySnapshot: (levels) =>
      set((s) => ({ injuries: { ...s.injuries, levels } })),

    // --- GLB Avatar ---
    setGlbUrl: (url, filename) =>
      set((s) => ({ glbAvatar: { ...s.glbAvatar, url, filename, bones: [], mapping: {} } })),
    toggleGlbPreview: () =>
      set((s) => ({ glbAvatar: { ...s.glbAvatar, previewVisible: !s.glbAvatar.previewVisible } })),
    setGlbScale: (scale) =>
      set((s) => ({ glbAvatar: { ...s.glbAvatar, scale } })),
    updateGlbBoneTree: (bones) => {
      const cur = get().glbAvatar.mapping;
      const seedMapping = { ...cur };
      bones.forEach((b) => {
        if (!seedMapping[b.name] && b.guess) seedMapping[b.name] = b.guess;
      });
      set((s) => ({ glbAvatar: { ...s.glbAvatar, bones, mapping: seedMapping } }));
    },
    setGlbMapping: (boneName, slot) =>
      set((s) => ({
        glbAvatar: {
          ...s.glbAvatar,
          mapping: { ...s.glbAvatar.mapping, [boneName]: slot === "_none" ? undefined : slot },
        },
      })),
    clearGlb: () => set((s) => ({
      glbAvatar: { url: null, filename: null, previewVisible: true, scale: 1.0, bones: [], mapping: {}, driveSkeleton: false, hideProcedural: false },
    })),
    toggleDriveSkeleton: () =>
      set((s) => ({ glbAvatar: { ...s.glbAvatar, driveSkeleton: !s.glbAvatar.driveSkeleton } })),
    toggleHideProcedural: () =>
      set((s) => ({ glbAvatar: { ...s.glbAvatar, hideProcedural: !s.glbAvatar.hideProcedural } })),

    // --- AI Thinking / Pipeline visualization ---
    toggleAiThinkingPanel: () => { set((s) => ({ aiThinkingPanelOpen: !s.aiThinkingPanelOpen })); persist(get()); },
    togglePipelinePanel:   () => { set((s) => ({ pipelinePanelOpen: !s.pipelinePanelOpen })); persist(get()); },
    pushThought: (kind, text) =>
      set((s) => ({
        aiThoughts: [
          { id: (s.aiThoughts[0]?.id ?? 0) + 1, kind, text, t: Date.now() },
          ...s.aiThoughts,
        ].slice(0, 60),
      })),
    clearThoughts: () => set({ aiThoughts: [] }),
    pulseStage: (stage) =>
      set((s) => {
        if (!s.pipelineStages[stage]) return {};
        return {
          pipelineStages: {
            ...s.pipelineStages,
            [stage]: { ...s.pipelineStages[stage], lastActiveAt: Date.now() },
          },
        };
      }),
  };
});
