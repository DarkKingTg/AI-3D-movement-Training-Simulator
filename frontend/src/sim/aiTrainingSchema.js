import { clampJoint, DEFAULT_JOINTS } from "@/sim/anatomy";

export const TRAINING_SCHEMA_VERSION = "aira-movement-v1";

export const PART_NAMES = [
  "pelvis",
  "torso",
  "head",
  "lUpArm",
  "rUpArm",
  "lLoArm",
  "rLoArm",
  "lUpLeg",
  "rUpLeg",
  "lLoLeg",
  "rLoLeg",
];

export const DEFAULT_MOTOR_GAINS = {
  stiffness: 80,
  damping: 10,
  sphereTorqueK: 0.012,
  sphereTorqueD: 0.005,
  torqueLimit: 0.4,
  forceLimit: 35,
};

export function buildObservation(state, airaRef, context = {}) {
  const body = readBodyStates(airaRef);
  const senses = trimSenses(state.senses);
  return {
    schema: TRAINING_SCHEMA_VERSION,
    tick: context.tick || 0,
    t: Date.now(),
    dt: context.dt || 0,
    mode: state.trainingBridge?.mode || "visible",
    ragdollMode: state.ragdoll?.mode,
    goal: state.goal,
    skill: state.trainingBridge?.skill || "stand",
    episode: state.trainingBridge?.episode || 0,
    airaState: state.airaState,
    stats: state.stats,
    joints: cloneJoints(state.joints),
    jointsActual: cloneJoints(state.jointsActual),
    motorGains: { ...DEFAULT_MOTOR_GAINS, ...(state.motorGains || {}) },
    senses,
    contacts: senses.contacts,
    body,
    objects: state.objects || [],
    objectPoses: state.objectPoses || {},
    goalState: buildGoalState(state),
    injuryState: {
      levels: state.injuries?.levels || {},
      broken: !!state.breakState?.broken,
      brokenParts: state.breakState?.brokenParts || [],
      lastBreak: state.breakState?.lastBreak || null,
    },
    avatar: {
      hasUpload: !!state.glbAvatar?.url,
      filename: state.glbAvatar?.filename || null,
      humanoidBoneCount: state.glbAvatar?.bones?.length || 0,
      mappedBoneCount: Object.values(state.glbAvatar?.mapping || {}).filter(Boolean).length,
      proxyRigActive: !!state.glbAvatar?.proxyRigActive,
    },
    memory: {
      latestMovementLesson: state.movementLessons?.[0] || null,
      lessonCount: state.movementLessons?.length || 0,
    },
    innerState: state.airaInnerState || null,
  };
}

export function validateMotorAction(rawAction, currentJoints = DEFAULT_JOINTS, currentGains = DEFAULT_MOTOR_GAINS) {
  const action = rawAction?.action || rawAction || {};
  const warnings = [];
  const nextJoints = mergeJoints(currentJoints, action.joints || action.jointTargets || {});
  const nextGains = sanitizeGains({ ...currentGains, ...(action.gains || action.motorGains || {}) }, warnings);
  const rootIntent = sanitizeRootIntent(action.rootIntent || action.root || {}, warnings);
  const manipulation = sanitizeManipulation(action.manipulation || rootIntent.manipulation || null, warnings);

  return {
    schema: TRAINING_SCHEMA_VERSION,
    source: action.source || "external_policy",
    joints: nextJoints,
    gains: nextGains,
    rootIntent,
    manipulation,
    episodeControl: action.episodeControl || null,
    warnings,
  };
}

export function computeReward(observation, previousObservation = null, action = null) {
  if (!observation) return { total: 0, breakdown: {} };

  const y = observation.airaState?.pos?.[1] ?? 1;
  const fallen = observation.airaState?.status === "fallen" || y < 0.45;
  const broken = observation.injuryState?.broken;
  const unsafeContact = (observation.contacts || [])[0]?.force > 50;
  const stableHeight = clamp01((y - 0.45) / 0.65);
  const velocity = observation.airaState?.vel || [0, 0, 0];
  const horizontalSpeed = Math.hypot(velocity[0] || 0, velocity[2] || 0);
  const previousDistance = previousObservation?.goalState?.distanceToTarget;
  const distance = observation.goalState?.distanceToTarget;
  const progress = Number.isFinite(previousDistance) && Number.isFinite(distance)
    ? Math.max(-1, Math.min(1, previousDistance - distance))
    : 0;
  const smoothness = action ? estimateActionSmoothness(action, previousObservation?.jointsActual || observation.jointsActual) : 1;
  const humanLike = unsafeContact ? 0.2 : smoothness;

  const breakdown = {
    notFalling: broken ? -100 : fallen ? -60 : 10 * stableHeight,
    balance: fallen ? -8 : 3 * stableHeight,
    humanLike: 2 * humanLike,
    smoothness: 1.5 * smoothness,
    taskProgress: 4 * progress,
    speedControl: horizontalSpeed > 4 ? -2 : 0.5,
    injuryPenalty: unsafeContact ? -8 : 0,
  };
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total: round(total), breakdown: mapRound(breakdown) };
}

export function detectEpisodeEnd(observation, startedAt, maxEpisodeMs = 60000) {
  if (!observation) return null;
  if (observation.injuryState?.broken) {
    return { done: true, reason: "broken_body_part", success: false, break: observation.injuryState.lastBreak };
  }
  if (observation.airaState?.status === "fallen" || (observation.airaState?.pos?.[1] ?? 1) < 0.35) {
    return { done: true, reason: "fall", success: false };
  }
  if (startedAt && Date.now() - startedAt > maxEpisodeMs) {
    return { done: true, reason: "timeout", success: false };
  }
  if (observation.airaState?.status === "success!") {
    return { done: true, reason: "success", success: true };
  }
  return null;
}

export function cloneJoints(joints) {
  const source = joints || DEFAULT_JOINTS;
  const out = {};
  for (const [joint, values] of Object.entries(source)) {
    out[joint] = { ...(values || {}) };
  }
  return out;
}

export function mergeJoints(current, partial) {
  const out = cloneJoints(current || DEFAULT_JOINTS);
  for (const [joint, values] of Object.entries(partial || {})) {
    if (!values || typeof values !== "object") continue;
    out[joint] = clampJoint(joint, { ...(out[joint] || {}), ...values });
  }
  return out;
}

export function flattenJoints(joints) {
  const out = {};
  for (const [joint, values] of Object.entries(joints || {})) {
    for (const [axis, value] of Object.entries(values || {})) {
      out[`${joint}.${axis}`] = Number.isFinite(value) ? value : 0;
    }
  }
  return out;
}

function readBodyStates(airaRef) {
  const aira = airaRef?.current;
  const parts = aira?.allParts || [];
  return PART_NAMES.map((part, index) => readRigidBodyState(parts[index], part)).filter(Boolean);
}

function readRigidBodyState(refLike, part) {
  const body = refLike?.current;
  if (!body || typeof body.translation !== "function") return null;
  try {
    const t = body.translation();
    const r = typeof body.rotation === "function" ? body.rotation() : null;
    const lv = typeof body.linvel === "function" ? body.linvel() : null;
    const av = typeof body.angvel === "function" ? body.angvel() : null;
    return {
      part,
      position: vec(t),
      rotation: r ? [round(r.x), round(r.y), round(r.z), round(r.w)] : null,
      velocity: lv ? vec(lv) : [0, 0, 0],
      angularVelocity: av ? vec(av) : [0, 0, 0],
    };
  } catch {
    return null;
  }
}

function trimSenses(senses = {}) {
  return {
    visionUpdatedAt: senses.visionUpdatedAt || 0,
    visionWidth: senses.visionWidth || 0,
    visionHeight: senses.visionHeight || 0,
    visionFovDeg: senses.visionFovDeg || 0,
    hasVisionData: !!senses.visionData,
    contacts: (senses.contacts || []).slice(0, 10).map((c) => ({
      part: c.part,
      otherName: c.otherName || "world",
      force: round(c.force || 0),
      t: c.t || 0,
    })),
    imu: senses.imu || {},
    proprioception: senses.proprioception || {},
    distanceToTarget: senses.distanceToTarget || 0,
    visibleObjects: senses.visibleObjects || [],
  };
}

function buildGoalState(state) {
  const pos = state.airaState?.pos || [0, 0, 0];
  const objects = state.objects || [];
  const target = objects.find((o) => o.type === "target") || objects.find((o) => o.type === "light") || objects[0];
  if (!target) {
    return { targetId: null, targetType: null, distanceToTarget: null };
  }
  const dx = (target.position?.[0] || 0) - pos[0];
  const dz = (target.position?.[2] || 0) - pos[2];
  return {
    targetId: target.id,
    targetType: target.type,
    targetPosition: target.position,
    distanceToTarget: round(Math.hypot(dx, dz)),
  };
}

function sanitizeGains(gains, warnings) {
  return {
    stiffness: clampNumber(gains.stiffness, 0, 150, DEFAULT_MOTOR_GAINS.stiffness, "stiffness", warnings),
    damping: clampNumber(gains.damping, 0, 35, DEFAULT_MOTOR_GAINS.damping, "damping", warnings),
    sphereTorqueK: clampNumber(gains.sphereTorqueK, 0.001, 0.05, DEFAULT_MOTOR_GAINS.sphereTorqueK, "sphereTorqueK", warnings),
    sphereTorqueD: clampNumber(gains.sphereTorqueD, 0, 0.04, DEFAULT_MOTOR_GAINS.sphereTorqueD, "sphereTorqueD", warnings),
    torqueLimit: clampNumber(gains.torqueLimit, 0.05, 1.2, DEFAULT_MOTOR_GAINS.torqueLimit, "torqueLimit", warnings),
    forceLimit: clampNumber(gains.forceLimit, 0, 120, DEFAULT_MOTOR_GAINS.forceLimit, "forceLimit", warnings),
  };
}

function sanitizeRootIntent(rootIntent, warnings) {
  const velocity = Array.isArray(rootIntent.velocity) ? rootIntent.velocity : [rootIntent.vx, rootIntent.vz];
  return {
    velocity: [
      clampNumber(velocity[0], -5, 5, 0, "rootIntent.velocity[0]", warnings),
      clampNumber(velocity[1], -5, 5, 0, "rootIntent.velocity[1]", warnings),
    ],
    jump: !!rootIntent.jump,
    crouch: clampNumber(rootIntent.crouch, 0, 1, 0, "rootIntent.crouch", warnings),
    manipulation: rootIntent.manipulation || null,
  };
}

function sanitizeManipulation(manipulation, warnings) {
  if (!manipulation) return null;
  const type = ["push", "pull", "lift", "carry"].includes(manipulation.type) ? manipulation.type : null;
  if (!type) {
    warnings.push("unsupported manipulation type");
    return null;
  }
  const dir = Array.isArray(manipulation.direction) ? manipulation.direction : [0, type === "lift" ? 1 : 0, 1];
  return {
    type,
    targetId: manipulation.targetId ?? null,
    force: clampNumber(manipulation.force, 0, 60, 10, "manipulation.force", warnings),
    direction: [
      clampNumber(dir[0], -1, 1, 0, "manipulation.direction[0]", warnings),
      clampNumber(dir[1], -1, 1, 0, "manipulation.direction[1]", warnings),
      clampNumber(dir[2], -1, 1, 1, "manipulation.direction[2]", warnings),
    ],
  };
}

function estimateActionSmoothness(action, prevJoints) {
  const joints = action?.joints || {};
  let count = 0;
  let sum = 0;
  for (const [joint, values] of Object.entries(joints)) {
    const prev = prevJoints?.[joint] || {};
    for (const [axis, value] of Object.entries(values || {})) {
      if (!Number.isFinite(value)) continue;
      sum += Math.abs(value - (prev[axis] || 0));
      count += 1;
    }
  }
  if (!count) return 1;
  return clamp01(1 - sum / (count * 90));
}

function clampNumber(value, min, max, fallback, label, warnings) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.max(min, Math.min(max, n));
  if (clamped !== n && warnings) warnings.push(`${label} clamped to ${clamped}`);
  return clamped;
}

function vec(v) {
  return [round(v.x || 0), round(v.y || 0), round(v.z || 0)];
}

function mapRound(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round(v)]));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function round(n) {
  return Number(Number(n).toFixed(4));
}
