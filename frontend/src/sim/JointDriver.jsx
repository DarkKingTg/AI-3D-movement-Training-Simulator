import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";
import { clampJoint, toRad } from "@/sim/anatomy";

/**
 * JointDriver — drives Aira's joints based on commanded angles in store.
 *
 * Dual-mode behavior:
 *   • **Kinematic ragdoll**: writes Euler rotations onto cosmetic bone groups
 *     (the original behavior, used with AiraRagdoll.jsx).
 *   • **Physics ragdoll**: for revolute joints (elbows, knees) uses Rapier's
 *     `configureMotorPosition(targetRad, stiffness, damping)` so the physics
 *     solver applies torque to reach the target angle. For spherical joints
 *     (shoulders, hips, waist, neck) — rapier's `SphericalImpulseJoint` has no
 *     built-in motor, so we apply a manual torque impulse each frame that
 *     rotates body B toward the target orientation relative to body A
 *     (proportional + damped — a PD controller).
 *
 * Throttles proprioception updates to ~5Hz to avoid render storms.
 */

const MOTOR_STIFFNESS_REV = 80;   // for elbows/knees — lower to avoid solver instability
const MOTOR_DAMPING_REV = 10;
const SPHERE_TORQUE_K = 0.012;    // proportional torque for spherical PD (conservative)
const SPHERE_TORQUE_D = 0.005;    // damping torque
const TORQUE_CLAMP = 0.4;         // hard cap on per-axis torque impulse magnitude

const _qParent = new THREE.Quaternion();
const _qChild = new THREE.Quaternion();
const _qRel = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _qError = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _vec3 = new THREE.Vector3();

export default function JointDriver({ airaRef }) {
  const joints = useSimStore((s) => s.joints);
  const motorGains = useSimStore((s) => s.motorGains);
  const broken = useSimStore((s) => s.breakState.broken);
  const updateProprioception = useSimStore((s) => s.updateProprioception);
  const ragdollMode = useSimStore((s) => s.ragdoll.mode);
  const lastWriteRef = useRef(0);

  useFrame(() => {
    if (!airaRef.current) return;
    if (broken) return;

    if (ragdollMode === "physics") {
      driverPhysics(airaRef, joints, motorGains);
    } else {
      driveKinematic(airaRef, joints);
    }

    // Throttle proprioception writes to ~5Hz
    if (performance.now() - lastWriteRef.current > 200) {
      lastWriteRef.current = performance.now();
      const actual = {};
      for (const k of Object.keys(joints)) {
        actual[k] = clampJoint(k, joints[k]);
      }
      updateProprioception(actual);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Kinematic mode — write to bone groups (original)
// ---------------------------------------------------------------------------
function driveKinematic(airaRef, joints) {
  const bones = airaRef.current.bones;
  if (!bones) return;

  const apply = (key, group, mapping) => {
    if (!group?.current) return;
    const cmd = joints[key] || {};
    const clamped = clampJoint(key, cmd);
    const { x, y, z } = mapping(clamped);
    group.current.rotation.set(toRad(x), toRad(y), toRad(z));
  };

  apply("spine", bones.spine, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));
  apply("head", bones.head, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));
  apply("lShoulder", bones.lShoulder, (j) => ({ x: -(j.pitch || 0), y: j.roll || 0, z: j.yaw || 0 }));
  apply("rShoulder", bones.rShoulder, (j) => ({ x: -(j.pitch || 0), y: j.roll || 0, z: -(j.yaw || 0) }));
  apply("lElbow", bones.lElbow, (j) => ({ x: j.bend || 0, y: 0, z: 0 }));
  apply("rElbow", bones.rElbow, (j) => ({ x: j.bend || 0, y: 0, z: 0 }));
  apply("lWrist", bones.lWrist, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: 0 }));
  apply("rWrist", bones.rWrist, (j) => ({ x: j.pitch || 0, y: -(j.yaw || 0), z: 0 }));
  apply("lFingers", bones.lFingers, (j) => ({ x: j.curl || 0, y: 0, z: 0 }));
  apply("rFingers", bones.rFingers, (j) => ({ x: j.curl || 0, y: 0, z: 0 }));
  apply("lHip", bones.lHip, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));
  apply("rHip", bones.rHip, (j) => ({ x: j.pitch || 0, y: -(j.yaw || 0), z: -(j.roll || 0) }));
  apply("lKnee", bones.lKnee, (j) => ({ x: -(j.bend || 0), y: 0, z: 0 }));
  apply("rKnee", bones.rKnee, (j) => ({ x: -(j.bend || 0), y: 0, z: 0 }));
}

// ---------------------------------------------------------------------------
// Physics mode — drive Rapier joint motors
// ---------------------------------------------------------------------------
function driverPhysics(airaRef, joints, motorGains) {
  const J = airaRef.current.joints;
  if (!J) return;

  // Revolute joints with motors
  driveRevolute(J.lElbow.current, joints.lElbow?.bend, motorGains);
  driveRevolute(J.rElbow.current, joints.rElbow?.bend, motorGains);
  driveRevolute(J.lKnee.current, -(joints.lKnee?.bend || 0), motorGains);
  driveRevolute(J.rKnee.current, -(joints.rKnee?.bend || 0), motorGains);

  // Spherical joints — PD controller on bodies
  // Shoulders
  const lShoulderTarget = sphericalTargetQuat({
    x: -(joints.lShoulder?.pitch || 0),
    y: joints.lShoulder?.roll || 0,
    z: joints.lShoulder?.yaw || 0,
  });
  driveSpherical(airaRef.current.allParts[1]?.current, airaRef.current.allParts[3]?.current, lShoulderTarget, motorGains);
  const rShoulderTarget = sphericalTargetQuat({
    x: -(joints.rShoulder?.pitch || 0),
    y: joints.rShoulder?.roll || 0,
    z: -(joints.rShoulder?.yaw || 0),
  });
  driveSpherical(airaRef.current.allParts[1]?.current, airaRef.current.allParts[4]?.current, rShoulderTarget, motorGains);

  // Hips
  const lHipTarget = sphericalTargetQuat({
    x: joints.lHip?.pitch || 0,
    y: joints.lHip?.yaw || 0,
    z: joints.lHip?.roll || 0,
  });
  driveSpherical(airaRef.current.allParts[0]?.current, airaRef.current.allParts[7]?.current, lHipTarget, motorGains);
  const rHipTarget = sphericalTargetQuat({
    x: joints.rHip?.pitch || 0,
    y: -(joints.rHip?.yaw || 0),
    z: -(joints.rHip?.roll || 0),
  });
  driveSpherical(airaRef.current.allParts[0]?.current, airaRef.current.allParts[8]?.current, rHipTarget, motorGains);

  // Head (spine + neck combined applied to head body via torso)
  const headTarget = sphericalTargetQuat({
    x: joints.head?.pitch || 0,
    y: joints.head?.yaw || 0,
    z: joints.head?.roll || 0,
  });
  driveSpherical(airaRef.current.allParts[1]?.current, airaRef.current.allParts[2]?.current, headTarget, motorGains);
}

function driveRevolute(joint, targetDeg, motorGains) {
  if (!joint || targetDeg === undefined || targetDeg === null) return;
  if (!Number.isFinite(targetDeg)) return;
  try {
    joint.configureMotorPosition(
      toRad(targetDeg),
      motorGains?.stiffness ?? MOTOR_STIFFNESS_REV,
      motorGains?.damping ?? MOTOR_DAMPING_REV
    );
  } catch {}
}

/**
 * Compute target local quaternion from per-axis Euler (degrees).
 */
function sphericalTargetQuat({ x = 0, y = 0, z = 0 }) {
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  if (!Number.isFinite(z)) z = 0;
  _euler.set(toRad(x), toRad(y), toRad(z), "XYZ");
  _qTarget.setFromEuler(_euler);
  return _qTarget.clone();
}

/**
 * Apply a PD-controlled torque impulse to body B so that its orientation
 * relative to bodyA approaches `targetLocalQuat`. Conservative gains + a
 * hard torque clamp prevent the rapier solver from going unreachable.
 */
function driveSpherical(bodyA, bodyB, targetLocalQuat, motorGains) {
  if (!bodyA || !bodyB || !targetLocalQuat) return;
  try {
    if (typeof bodyB.applyTorqueImpulse !== "function") return;
    if (typeof bodyA.rotation !== "function" || typeof bodyB.rotation !== "function") return;

    const ra = bodyA.rotation();
    const rb = bodyB.rotation();
    if (!Number.isFinite(ra.x) || !Number.isFinite(rb.x)) return;

    _qParent.set(ra.x, ra.y, ra.z, ra.w);
    _qChild.set(rb.x, rb.y, rb.z, rb.w);
    _qRel.copy(_qParent).invert().multiply(_qChild);
    _qError.copy(_qRel).invert().multiply(targetLocalQuat);

    const wAbs = THREE.MathUtils.clamp(Math.abs(_qError.w), 0, 1);
    const angle = 2 * Math.acos(wAbs);
    if (!Number.isFinite(angle) || angle < 0.01) return;
    const sinHalf = Math.sqrt(Math.max(0, 1 - _qError.w * _qError.w));
    if (sinHalf < 1e-3) return;
    const sign = _qError.w < 0 ? -1 : 1;
    const ax = (_qError.x / sinHalf) * sign;
    const ay = (_qError.y / sinHalf) * sign;
    const az = (_qError.z / sinHalf) * sign;

    const torqueK = motorGains?.sphereTorqueK ?? SPHERE_TORQUE_K;
    const torqueD = motorGains?.sphereTorqueD ?? SPHERE_TORQUE_D;
    const torqueClamp = motorGains?.torqueLimit ?? TORQUE_CLAMP;
    _vec3.set(ax * angle * torqueK, ay * angle * torqueK, az * angle * torqueK);
    _vec3.applyQuaternion(_qParent);

    const av = bodyB.angvel();
    let tx = _vec3.x - av.x * torqueD;
    let ty = _vec3.y - av.y * torqueD;
    let tz = _vec3.z - av.z * torqueD;

    // Hard clamp per axis
    tx = THREE.MathUtils.clamp(tx, -torqueClamp, torqueClamp);
    ty = THREE.MathUtils.clamp(ty, -torqueClamp, torqueClamp);
    tz = THREE.MathUtils.clamp(tz, -torqueClamp, torqueClamp);
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)) return;

    bodyB.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);
  } catch {}
}
