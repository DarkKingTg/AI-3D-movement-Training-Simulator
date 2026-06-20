/**
 * Human-like joint limits (degrees) and default poses for Aira.
 * These approximate average adult-child range-of-motion, applied as
 * Euler angle clamps before each joint rotation is set.
 */

const D2R = Math.PI / 180;

export const JOINT_LIMITS = {
  // Head/Neck — yaw, pitch, roll (relative to torso)
  head: { yaw: [-70, 70], pitch: [-50, 50], roll: [-40, 40] },

  // Shoulders — pitch (raise/lower arm), yaw (forward/back swing), roll (rotate)
  lShoulder: { pitch: [-30, 170], yaw: [-90, 130], roll: [-90, 90] },
  rShoulder: { pitch: [-30, 170], yaw: [-130, 90], roll: [-90, 90] },

  // Elbows — only bend forward (single hinge)
  lElbow: { bend: [0, 145] },
  rElbow: { bend: [0, 145] },

  // Wrists — pitch (flex/extend), yaw (radial/ulnar)
  lWrist: { pitch: [-80, 80], yaw: [-30, 30] },
  rWrist: { pitch: [-80, 80], yaw: [-30, 30] },

  // Fingers — single curl angle 0..90
  lFingers: { curl: [0, 90] },
  rFingers: { curl: [0, 90] },

  // Hips — pitch (forward swing), yaw (side), roll (twist)
  lHip: { pitch: [-110, 30], yaw: [-30, 45], roll: [-30, 30] },
  rHip: { pitch: [-110, 30], yaw: [-45, 30], roll: [-30, 30] },

  // Knees — bend backward only
  lKnee: { bend: [0, 130] },
  rKnee: { bend: [0, 130] },

  // Torso flex
  spine: { yaw: [-40, 40], pitch: [-30, 60], roll: [-25, 25] },
};

export const DEFAULT_JOINTS = {
  head: { yaw: 0, pitch: 0, roll: 0 },
  lShoulder: { pitch: 0, yaw: 0, roll: 0 },
  rShoulder: { pitch: 0, yaw: 0, roll: 0 },
  lElbow: { bend: 5 },
  rElbow: { bend: 5 },
  lWrist: { pitch: 0, yaw: 0 },
  rWrist: { pitch: 0, yaw: 0 },
  lFingers: { curl: 0 },
  rFingers: { curl: 0 },
  lHip: { pitch: 0, yaw: 0, roll: 0 },
  rHip: { pitch: 0, yaw: 0, roll: 0 },
  lKnee: { bend: 0 },
  rKnee: { bend: 0 },
  spine: { yaw: 0, pitch: 0, roll: 0 },
};

/**
 * Clamp a value (in degrees) to a [min,max] range.
 */
export function clampDeg(value, range) {
  const [min, max] = range;
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians.
 */
export function toRad(deg) {
  return deg * D2R;
}

/**
 * Clamp an entire joint object against its limits, returning a *new* joint
 * object with values within range. Unknown keys pass through unclamped.
 */
export function clampJoint(jointName, values) {
  const limit = JOINT_LIMITS[jointName];
  if (!limit) return values;
  const out = {};
  for (const k of Object.keys(values)) {
    if (limit[k]) out[k] = clampDeg(values[k], limit[k]);
    else out[k] = values[k];
  }
  return out;
}
