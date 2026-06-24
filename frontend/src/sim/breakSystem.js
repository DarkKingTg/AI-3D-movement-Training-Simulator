import { JOINT_LIMITS } from "@/sim/anatomy";

export const BREAK_THRESHOLDS = {
  contactForceN: {
    head: 45,
    torso: 80,
    pelvis: 85,
    lUpArm: 55,
    rUpArm: 55,
    lLoArm: 50,
    rLoArm: 50,
    lUpLeg: 70,
    rUpLeg: 70,
    lLoLeg: 65,
    rLoLeg: 65,
    default: 60,
  },
  jointSpeedDegPerSec: 680,
  hyperextensionMarginDeg: 8,
  angularVelocityRadPerSec: 18,
  gLoad: 6.5,
  torqueLimit: 1.05,
};

const JOINT_TO_PART = {
  head: "head",
  spine: "torso",
  lShoulder: "lUpArm",
  rShoulder: "rUpArm",
  lElbow: "lLoArm",
  rElbow: "rLoArm",
  lWrist: "lLoArm",
  rWrist: "rLoArm",
  lFingers: "lLoArm",
  rFingers: "rLoArm",
  lHip: "lUpLeg",
  rHip: "rUpLeg",
  lKnee: "lLoLeg",
  rKnee: "rLoLeg",
};

export function thresholdForPart(part) {
  return BREAK_THRESHOLDS.contactForceN[part] || BREAK_THRESHOLDS.contactForceN.default;
}

export function makeBreakEvent(part, reason, metrics = {}) {
  return {
    id: `break-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    part: part || "unknown",
    reason,
    metrics,
    severity: estimateSeverity(reason, metrics),
    t: Date.now(),
  };
}

export function detectImpactBreak(part, force) {
  if (!part || !Number.isFinite(force)) return null;
  const threshold = thresholdForPart(part);
  if (force < threshold) return null;
  return makeBreakEvent(part, "excessive_contact_impulse", {
    forceN: round(force),
    thresholdN: threshold,
  });
}

export function detectJointCommandBreak(prevJoints, nextJoints, dtSec) {
  if (!prevJoints || !nextJoints || !Number.isFinite(dtSec) || dtSec <= 0) return null;

  let worstSpeed = null;
  for (const [joint, axes] of Object.entries(nextJoints)) {
    const prevAxes = prevJoints[joint] || {};
    for (const [axis, value] of Object.entries(axes || {})) {
      if (!Number.isFinite(value)) continue;
      const prev = Number.isFinite(prevAxes[axis]) ? prevAxes[axis] : value;
      const speed = Math.abs(value - prev) / dtSec;
      if (speed > BREAK_THRESHOLDS.jointSpeedDegPerSec && (!worstSpeed || speed > worstSpeed.speedDegPerSec)) {
        worstSpeed = { joint, axis, speedDegPerSec: speed, commandedDeg: value, previousDeg: prev };
      }
    }
  }
  if (worstSpeed) {
    return makeBreakEvent(JOINT_TO_PART[worstSpeed.joint], "extreme_joint_speed", {
      joint: worstSpeed.joint,
      axis: worstSpeed.axis,
      speedDegPerSec: round(worstSpeed.speedDegPerSec),
      thresholdDegPerSec: BREAK_THRESHOLDS.jointSpeedDegPerSec,
      commandedDeg: round(worstSpeed.commandedDeg),
      previousDeg: round(worstSpeed.previousDeg),
    });
  }

  const hyper = detectHyperextension(nextJoints);
  if (hyper) return hyper;

  return null;
}

export function detectHyperextension(rawJoints) {
  if (!rawJoints) return null;
  for (const [joint, axes] of Object.entries(rawJoints)) {
    const limits = JOINT_LIMITS[joint];
    if (!limits) continue;
    for (const [axis, value] of Object.entries(axes || {})) {
      const range = limits[axis];
      if (!range || !Number.isFinite(value)) continue;
      const [min, max] = range;
      const margin = BREAK_THRESHOLDS.hyperextensionMarginDeg;
      if (value < min - margin || value > max + margin) {
        return makeBreakEvent(JOINT_TO_PART[joint], "joint_hyperextension", {
          joint,
          axis,
          commandedDeg: round(value),
          minDeg: min,
          maxDeg: max,
          marginDeg: margin,
        });
      }
    }
  }
  return null;
}

export function detectBodyStressBreak(bodyStates = []) {
  for (const body of bodyStates) {
    const av = body?.angularVelocity || [0, 0, 0];
    const speed = Math.hypot(av[0] || 0, av[1] || 0, av[2] || 0);
    if (speed > BREAK_THRESHOLDS.angularVelocityRadPerSec) {
      return makeBreakEvent(body.part, "extreme_angular_velocity", {
        angularVelocityRadPerSec: round(speed),
        thresholdRadPerSec: BREAK_THRESHOLDS.angularVelocityRadPerSec,
      });
    }
  }
  return null;
}

export function detectGLoadBreak(accel = []) {
  const magnitude = Math.hypot(accel[0] || 0, accel[1] || 0, accel[2] || 0);
  const gLoad = magnitude / 9.81;
  if (gLoad <= BREAK_THRESHOLDS.gLoad) return null;
  return makeBreakEvent("head", "high_g_load", {
    gLoad: round(gLoad),
    accelerationMs2: round(magnitude),
    thresholdG: BREAK_THRESHOLDS.gLoad,
  });
}

export function detectTorqueBreak(gains = {}) {
  const torqueLimit = Number(gains.torqueLimit ?? gains.forceLimit);
  if (!Number.isFinite(torqueLimit) || torqueLimit <= BREAK_THRESHOLDS.torqueLimit) return null;
  return makeBreakEvent("torso", "unsafe_torque_limit", {
    torqueLimit: round(torqueLimit),
    threshold: BREAK_THRESHOLDS.torqueLimit,
  });
}

export function buildMovementLesson(event) {
  if (!event) return null;
  const part = readablePart(event.part);
  const cause = readableReason(event.reason, event.metrics);
  const correction = correctionForReason(event.reason);
  return `I broke my ${part} because ${cause}. Next time I should ${correction}.`;
}

export function summarizeEpisodeFailure(event, observation) {
  const lesson = buildMovementLesson(event);
  return {
    id: `lesson-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "movement_failure",
    skill: observation?.goal || "unknown",
    bodyPart: event?.part || "unknown",
    reason: event?.reason || "unknown",
    metrics: event?.metrics || {},
    text: lesson,
    t: Date.now(),
  };
}

function readablePart(part) {
  return String(part || "body").replace(/^l/, "left ").replace(/^r/, "right ").replace(/([A-Z])/g, " $1").toLowerCase();
}

function readableReason(reason, metrics = {}) {
  if (reason === "excessive_contact_impulse") {
    return `the impact force was too high (${metrics.forceN} N)`;
  }
  if (reason === "extreme_joint_speed") {
    return `I commanded ${metrics.joint}.${metrics.axis} too fast (${metrics.speedDegPerSec} deg/s)`;
  }
  if (reason === "joint_hyperextension") {
    return `I pushed ${metrics.joint}.${metrics.axis} outside its safe range`;
  }
  if (reason === "extreme_angular_velocity") {
    return `that body part spun too fast (${metrics.angularVelocityRadPerSec} rad/s)`;
  }
  if (reason === "high_g_load") {
    return `my acceleration was unsafe (${metrics.gLoad} G)`;
  }
  if (reason === "unsafe_torque_limit") {
    return `my motor torque limit was unsafe (${metrics.torqueLimit})`;
  }
  return "I used an unsafe movement";
}

function correctionForReason(reason) {
  if (reason === "extreme_joint_speed") return "reduce joint speed, lower stiffness, and recover balance before moving again";
  if (reason === "joint_hyperextension") return "stay inside anatomical limits and bend the supporting joints first";
  if (reason === "excessive_contact_impulse") return "absorb impact with bent knees and reduce contact force";
  if (reason === "high_g_load") return "slow the motion and keep my head and torso acceleration lower";
  if (reason === "unsafe_torque_limit") return "use a lower torque limit and increase force gradually";
  if (reason === "extreme_angular_velocity") return "dampen rotation before applying more force";
  return "move more slowly, keep balance first, and use controlled force";
}

function estimateSeverity(reason, metrics) {
  if (reason === "excessive_contact_impulse") return Math.min(1, (metrics.forceN || 0) / Math.max(1, metrics.thresholdN || 1));
  if (reason === "extreme_joint_speed") return Math.min(1, (metrics.speedDegPerSec || 0) / BREAK_THRESHOLDS.jointSpeedDegPerSec);
  if (reason === "high_g_load") return Math.min(1, (metrics.gLoad || 0) / BREAK_THRESHOLDS.gLoad);
  return 1;
}

function round(n) {
  return Number(Number(n).toFixed(3));
}
