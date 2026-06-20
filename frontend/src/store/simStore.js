import { create } from "zustand";

const STORAGE_KEY = "aira_sim_state_v1";

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

const initial = {
  goal: GOALS.IDLE,
  paused: false,
  cameraMode: "orbit", // orbit | follow | top
  speed: 2.0,
  balance: 0.7,
  jumpPower: 5.5,
  objects: [], // {id, type, position, color, locked}
  airaState: { pos: [0, 1, 0], vel: [0, 0, 0], status: "idle" },
  stats: { attempts: 0, successes: 0, falls: 0 },
  nextId: 1,
  resetSignal: 0,
};

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
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

    setSpeed: (v) => {
      set({ speed: v });
      persist(get());
    },
    setBalance: (v) => {
      set({ balance: v });
      persist(get());
    },
    setJumpPower: (v) => {
      set({ jumpPower: v });
      persist(get());
    },

    spawnObject: (type, opts = {}) => {
      const id = get().nextId;
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4;
      const defaultPos = [Math.cos(angle) * radius, 1, Math.sin(angle) * radius];
      const obj = {
        id,
        type,
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

    clearObjects: () => {
      set({ objects: [] });
      persist(get());
    },

    updateAiraState: (pos, vel, status) =>
      set({ airaState: { pos, vel, status } }),

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
    resetAll: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ ...initial });
    },
  };
});
