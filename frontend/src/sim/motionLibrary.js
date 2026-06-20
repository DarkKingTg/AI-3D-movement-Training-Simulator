/**
 * Motion library — keyframe-based demonstrations of human motor patterns.
 *
 * Each motion is a list of keyframes. A keyframe is an object of joint values
 * (degrees) at a given `t` (seconds). The MotionPlayer linearly interpolates
 * between consecutive keyframes and applies the result to the store every
 * frame. Looping motions wrap `t` modulo the last keyframe's `t`.
 *
 * Joint axes match anatomy.js naming. Missing axes in a frame are inherited
 * from DEFAULT_JOINTS (so a "walk" clip can leave the head alone, for example).
 */
export const MOTIONS = {
  idle: {
    id: "idle",
    label: "Stand · Idle",
    icon: "User",
    duration: 2.0,
    loop: true,
    description: "Quiet breathing — minimal sway.",
    keyframes: [
      { t: 0.0, spine: { roll: 0, pitch: 2 }, head: { pitch: 0 } },
      { t: 1.0, spine: { roll: 1, pitch: 3 }, head: { pitch: 1 } },
      { t: 2.0, spine: { roll: 0, pitch: 2 }, head: { pitch: 0 } },
    ],
  },

  walk: {
    id: "walk",
    label: "Walk Cycle",
    icon: "Footprints",
    duration: 1.2,
    loop: true,
    description: "Heel-strike → midstance → toe-off, alternating legs with arm counter-swing.",
    keyframes: [
      // Phase 0 — left foot forward, right behind, arms opposite
      { t: 0.0,
        lHip: { pitch: -25 }, rHip: { pitch: 25 },
        lKnee: { bend: 10 }, rKnee: { bend: 40 },
        lShoulder: { pitch: 20 }, rShoulder: { pitch: -20 },
        lElbow: { bend: 30 }, rElbow: { bend: 50 },
      },
      // Phase 1 — midstance
      { t: 0.3,
        lHip: { pitch: -10 }, rHip: { pitch: 10 },
        lKnee: { bend: 5 }, rKnee: { bend: 20 },
        lShoulder: { pitch: 10 }, rShoulder: { pitch: -10 },
        lElbow: { bend: 20 }, rElbow: { bend: 40 },
      },
      // Phase 2 — right foot forward, mirrored
      { t: 0.6,
        lHip: { pitch: 25 }, rHip: { pitch: -25 },
        lKnee: { bend: 40 }, rKnee: { bend: 10 },
        lShoulder: { pitch: -20 }, rShoulder: { pitch: 20 },
        lElbow: { bend: 50 }, rElbow: { bend: 30 },
      },
      // Phase 3 — midstance mirrored
      { t: 0.9,
        lHip: { pitch: 10 }, rHip: { pitch: -10 },
        lKnee: { bend: 20 }, rKnee: { bend: 5 },
        lShoulder: { pitch: -10 }, rShoulder: { pitch: 10 },
        lElbow: { bend: 40 }, rElbow: { bend: 20 },
      },
      // Phase 4 — loop back to phase 0
      { t: 1.2,
        lHip: { pitch: -25 }, rHip: { pitch: 25 },
        lKnee: { bend: 10 }, rKnee: { bend: 40 },
        lShoulder: { pitch: 20 }, rShoulder: { pitch: -20 },
        lElbow: { bend: 30 }, rElbow: { bend: 50 },
      },
    ],
  },

  run: {
    id: "run",
    label: "Run Cycle",
    icon: "Wind",
    duration: 0.8,
    loop: true,
    description: "Higher knee lift, larger arm swing, leaning torso.",
    keyframes: [
      { t: 0.0,
        spine: { pitch: 15 }, head: { pitch: -5 },
        lHip: { pitch: -40 }, rHip: { pitch: 50 },
        lKnee: { bend: 20 }, rKnee: { bend: 90 },
        lShoulder: { pitch: 50 }, rShoulder: { pitch: -50 },
        lElbow: { bend: 90 }, rElbow: { bend: 90 },
      },
      { t: 0.4,
        spine: { pitch: 15 }, head: { pitch: -5 },
        lHip: { pitch: 50 }, rHip: { pitch: -40 },
        lKnee: { bend: 90 }, rKnee: { bend: 20 },
        lShoulder: { pitch: -50 }, rShoulder: { pitch: 50 },
        lElbow: { bend: 90 }, rElbow: { bend: 90 },
      },
      { t: 0.8,
        spine: { pitch: 15 }, head: { pitch: -5 },
        lHip: { pitch: -40 }, rHip: { pitch: 50 },
        lKnee: { bend: 20 }, rKnee: { bend: 90 },
        lShoulder: { pitch: 50 }, rShoulder: { pitch: -50 },
        lElbow: { bend: 90 }, rElbow: { bend: 90 },
      },
    ],
  },

  jump: {
    id: "jump",
    label: "Standing Jump",
    icon: "ArrowUp",
    duration: 1.4,
    loop: false,
    description: "Crouch → explosive extension → tuck mid-air → landing absorb.",
    keyframes: [
      // 0.0 — neutral
      { t: 0.0,
        spine: { pitch: 0 },
        lHip: { pitch: 0 }, rHip: { pitch: 0 },
        lKnee: { bend: 0 }, rKnee: { bend: 0 },
        lShoulder: { pitch: 0 }, rShoulder: { pitch: 0 },
      },
      // 0.3 — crouch with arms back
      { t: 0.3,
        spine: { pitch: 25 },
        lHip: { pitch: -45 }, rHip: { pitch: -45 },
        lKnee: { bend: 100 }, rKnee: { bend: 100 },
        lShoulder: { pitch: -30 }, rShoulder: { pitch: -30 },
        lElbow: { bend: 30 }, rElbow: { bend: 30 },
      },
      // 0.6 — explosive extension, arms forward+up
      { t: 0.6,
        spine: { pitch: -10 },
        lHip: { pitch: 5 }, rHip: { pitch: 5 },
        lKnee: { bend: 5 }, rKnee: { bend: 5 },
        lShoulder: { pitch: 130 }, rShoulder: { pitch: 130 },
        lElbow: { bend: 20 }, rElbow: { bend: 20 },
      },
      // 0.9 — tuck in air
      { t: 0.9,
        spine: { pitch: 20 },
        lHip: { pitch: -60 }, rHip: { pitch: -60 },
        lKnee: { bend: 100 }, rKnee: { bend: 100 },
        lShoulder: { pitch: 60 }, rShoulder: { pitch: 60 },
        lElbow: { bend: 90 }, rElbow: { bend: 90 },
      },
      // 1.2 — landing absorb
      { t: 1.2,
        spine: { pitch: 15 },
        lHip: { pitch: -25 }, rHip: { pitch: -25 },
        lKnee: { bend: 60 }, rKnee: { bend: 60 },
        lShoulder: { pitch: 10 }, rShoulder: { pitch: 10 },
        lElbow: { bend: 40 }, rElbow: { bend: 40 },
      },
      // 1.4 — recover
      { t: 1.4,
        spine: { pitch: 0 },
        lHip: { pitch: 0 }, rHip: { pitch: 0 },
        lKnee: { bend: 5 }, rKnee: { bend: 5 },
        lShoulder: { pitch: 0 }, rShoulder: { pitch: 0 },
        lElbow: { bend: 5 }, rElbow: { bend: 5 },
      },
    ],
  },

  wave: {
    id: "wave",
    label: "Wave Hello",
    icon: "HandMetal",
    duration: 1.6,
    loop: true,
    description: "Raise right arm, swing forearm side-to-side, smile via head tilt.",
    keyframes: [
      { t: 0.0, head: { yaw: 5 }, rShoulder: { pitch: 140, yaw: -20 }, rElbow: { bend: 90 }, rWrist: { yaw: -20 } },
      { t: 0.4, head: { yaw: 5 }, rShoulder: { pitch: 140, yaw: -20 }, rElbow: { bend: 90 }, rWrist: { yaw: 20 } },
      { t: 0.8, head: { yaw: 5 }, rShoulder: { pitch: 140, yaw: -20 }, rElbow: { bend: 90 }, rWrist: { yaw: -20 } },
      { t: 1.2, head: { yaw: 5 }, rShoulder: { pitch: 140, yaw: -20 }, rElbow: { bend: 90 }, rWrist: { yaw: 20 } },
      { t: 1.6, head: { yaw: 5 }, rShoulder: { pitch: 140, yaw: -20 }, rElbow: { bend: 90 }, rWrist: { yaw: -20 } },
    ],
  },

  sit: {
    id: "sit",
    label: "Sit Down",
    icon: "Armchair",
    duration: 1.2,
    loop: false,
    description: "Bend knees and hips to seated position; arms rest on lap.",
    keyframes: [
      { t: 0.0, lHip: { pitch: 0 }, rHip: { pitch: 0 }, lKnee: { bend: 0 }, rKnee: { bend: 0 } },
      { t: 1.0,
        spine: { pitch: 15 },
        lHip: { pitch: -90 }, rHip: { pitch: -90 },
        lKnee: { bend: 100 }, rKnee: { bend: 100 },
        lShoulder: { pitch: 20 }, rShoulder: { pitch: 20 },
        lElbow: { bend: 60 }, rElbow: { bend: 60 },
      },
      { t: 1.2,
        spine: { pitch: 15 },
        lHip: { pitch: -90 }, rHip: { pitch: -90 },
        lKnee: { bend: 100 }, rKnee: { bend: 100 },
        lShoulder: { pitch: 20 }, rShoulder: { pitch: 20 },
        lElbow: { bend: 60 }, rElbow: { bend: 60 },
      },
    ],
  },

  reach: {
    id: "reach",
    label: "Reach Forward",
    icon: "Move",
    duration: 1.4,
    loop: false,
    description: "Extend both arms forward, open hand, slight forward lean.",
    keyframes: [
      { t: 0.0 },
      { t: 0.7,
        spine: { pitch: 10 },
        lShoulder: { pitch: 90 }, rShoulder: { pitch: 90 },
        lElbow: { bend: 10 }, rElbow: { bend: 10 },
        lFingers: { curl: 5 }, rFingers: { curl: 5 },
      },
      { t: 1.4,
        spine: { pitch: 10 },
        lShoulder: { pitch: 90 }, rShoulder: { pitch: 90 },
        lElbow: { bend: 10 }, rElbow: { bend: 10 },
        lFingers: { curl: 5 }, rFingers: { curl: 5 },
      },
    ],
  },

  squat: {
    id: "squat",
    label: "Squat",
    icon: "ChevronsDown",
    duration: 2.0,
    loop: true,
    description: "Down → up cycle, mirrors deep knee bend for strength training.",
    keyframes: [
      { t: 0.0,
        spine: { pitch: 5 },
        lHip: { pitch: 0 }, rHip: { pitch: 0 },
        lKnee: { bend: 5 }, rKnee: { bend: 5 },
        lShoulder: { pitch: 0 }, rShoulder: { pitch: 0 },
      },
      { t: 1.0,
        spine: { pitch: 25 },
        lHip: { pitch: -75 }, rHip: { pitch: -75 },
        lKnee: { bend: 110 }, rKnee: { bend: 110 },
        lShoulder: { pitch: 80 }, rShoulder: { pitch: 80 },
        lElbow: { bend: 30 }, rElbow: { bend: 30 },
      },
      { t: 2.0,
        spine: { pitch: 5 },
        lHip: { pitch: 0 }, rHip: { pitch: 0 },
        lKnee: { bend: 5 }, rKnee: { bend: 5 },
        lShoulder: { pitch: 0 }, rShoulder: { pitch: 0 },
      },
    ],
  },
};

import { DEFAULT_JOINTS } from "@/sim/anatomy";

/**
 * Sample a motion at time `t` (seconds) → returns a full joints object
 * by linearly interpolating between bracketing keyframes and inheriting
 * defaults from DEFAULT_JOINTS for unspecified joints/axes.
 */
export function sampleMotion(motion, time) {
  const kfs = motion.keyframes;
  const last = kfs[kfs.length - 1].t;
  let t = motion.loop ? time % last : Math.min(time, last);

  // Find bracketing keyframes
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].t < t) i++;
  const a = kfs[i];
  const b = kfs[Math.min(i + 1, kfs.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (t - a.t) / span));

  // Start from DEFAULT_JOINTS, then apply interpolated values
  const out = structuredClone(DEFAULT_JOINTS);
  // Collect all joint names that appear in either frame
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  names.delete("t");
  for (const name of names) {
    const av = a[name] || {};
    const bv = b[name] || {};
    out[name] = { ...out[name] };
    const axes = new Set([...Object.keys(av), ...Object.keys(bv)]);
    for (const axis of axes) {
      const av2 = av[axis] !== undefined ? av[axis] : (out[name][axis] || 0);
      const bv2 = bv[axis] !== undefined ? bv[axis] : (out[name][axis] || 0);
      out[name][axis] = av2 + (bv2 - av2) * alpha;
    }
  }
  return out;
}

export const MOTION_LIST = Object.values(MOTIONS);
