import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore, GOALS } from "@/store/simStore";
import { pulse } from "@/sim/pipelineState";

/**
 * AiController: applies physics forces to Aira's pelvis each frame to drive
 * her toward the current goal target. Procedurally simulates "trying to learn"
 * by oscillating limb impulses (arm swing, leg lift) based on velocity.
 */

const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

export default function AiController({ airaRef }) {
  const goal = useSimStore((s) => s.goal);
  const objects = useSimStore((s) => s.objects);
  const speed = useSimStore((s) => s.speed);
  const balance = useSimStore((s) => s.balance);
  const jumpPower = useSimStore((s) => s.jumpPower);
  const paused = useSimStore((s) => s.paused);
  const updateAiraState = useSimStore((s) => s.updateAiraState);
  const incrementSuccess = useSimStore((s) => s.incrementSuccess);
  const incrementFall = useSimStore((s) => s.incrementFall);
  const resetSignal = useSimStore((s) => s.resetSignal);
  const pushThought = useSimStore((s) => s.pushThought);

  const tRef = useRef(0);
  const successCoolRef = useRef(0);
  const fallCoolRef = useRef(0);
  const lastGoalRef = useRef(goal);
  const lastStatusRef = useRef("idle");
  const lastThoughtAtRef = useRef(0);

  // Reset Aira to spawn when resetSignal changes — handles both single-body
  // (kinematic) and multi-body (physics) ragdolls by resetting every part.
  useEffect(() => {
    if (!airaRef.current) return;
    const parts = airaRef.current.allParts;
    if (!parts) return;
    const spawn = [0, 1.0, 0];
    parts.forEach((ref) => {
      const r = ref?.current;
      if (!r) return;
      // Preserve relative positions: read current rest offset from spawn
      const cur = r.translation();
      // For multi-body, we want to teleport each part by the same delta
      // so they stay assembled. Compute delta from pelvis only on first.
      const pelvisCur = airaRef.current.pelvis?.current?.translation();
      const dx = pelvisCur ? spawn[0] - pelvisCur.x : 0;
      const dy = pelvisCur ? spawn[1] - pelvisCur.y : 0;
      const dz = pelvisCur ? spawn[2] - pelvisCur.z : 0;
      r.setTranslation({ x: cur.x + dx, y: cur.y + dy, z: cur.z + dz }, true);
      r.setLinvel({ x: 0, y: 0, z: 0 }, true);
      r.setAngvel({ x: 0, y: 0, z: 0 }, true);
      r.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    });
  }, [resetSignal, airaRef]);

  // Reset cool-downs on goal change
  useEffect(() => {
    lastGoalRef.current = goal;
    successCoolRef.current = 0;
    pushThought("decide", `goal → ${goal.replace(/_/g, " ")}`);
  }, [goal, pushThought]);

  useFrame((state, delta) => {
    if (paused) return;
    if (!airaRef.current) return;
    const pelvis = airaRef.current.pelvis.current;
    if (!pelvis) return;

    tRef.current += delta;
    successCoolRef.current = Math.max(0, successCoolRef.current - delta);
    fallCoolRef.current = Math.max(0, fallCoolRef.current - delta);

    const tr = pelvis.translation();
    const lv = pelvis.linvel();

    // Find target depending on goal
    let target = null;
    let targetType = null;
    if (goal === GOALS.WALK) {
      const tgt = objects.find((o) => o.type === "target");
      if (tgt) {
        target = tmpVec2.set(tgt.position[0], 0, tgt.position[2]);
        targetType = "target";
      }
    } else if (goal === GOALS.FOLLOW_LIGHT) {
      const light = objects.find((o) => o.type === "light");
      if (light) {
        target = tmpVec2.set(light.position[0], 0, light.position[2]);
        targetType = "light";
      } else {
        // moving circular light path if none spawned
        const r = 4;
        target = tmpVec2.set(Math.cos(tRef.current * 0.5) * r, 0, Math.sin(tRef.current * 0.5) * r);
        targetType = "virtual_light";
      }
    } else if (goal === GOALS.FOLLOW_OBJECT) {
      const obj = objects.find((o) => o.type === "ball" || o.type === "liftBox");
      if (obj) {
        target = tmpVec2.set(obj.position[0], 0, obj.position[2]);
        targetType = "object";
      }
    } else if (goal === GOALS.LIFT_OBJECT) {
      const lift = objects.find((o) => o.type === "liftBox");
      if (lift) {
        target = tmpVec2.set(lift.position[0], 0, lift.position[2]);
        targetType = "liftBox";
      }
    } else if (goal === GOALS.JUMP_OBSTACLE) {
      const obs = objects.find((o) => o.type === "box" || o.type === "ramp");
      if (obs) {
        target = tmpVec2.set(obs.position[0], 0, obs.position[2]);
        targetType = "obstacle";
      }
    }

    let status = "idle";
    let distance = 0;

    if (target && goal !== GOALS.IDLE) {
      const ground = tmpVec.set(tr.x, 0, tr.z);
      const toTarget = target.clone().sub(ground);
      distance = toTarget.length();
      toTarget.normalize();

      // Velocity-based locomotion: directly set horizontal velocity toward target
      const targetSpeed = Math.min(speed, distance * 2.0); // taper near target
      const desiredVx = toTarget.x * targetSpeed;
      const desiredVz = toTarget.z * targetSpeed;
      // Smooth blend toward desired velocity (acceleration)
      const accel = 6.0 * delta;
      const newVx = lv.x + (desiredVx - lv.x) * Math.min(1, accel);
      const newVz = lv.z + (desiredVz - lv.z) * Math.min(1, accel);
      pelvis.setLinvel({ x: newVx, y: lv.y, z: newVz }, true);

      // Cap horizontal velocity
      const maxV = speed * 1.4;
      const horizV = Math.hypot(lv.x, lv.z);
      if (horizV > maxV) {
        const k = maxV / horizV;
        pelvis.setLinvel({ x: lv.x * k, y: lv.y, z: lv.z * k }, true);
      }

      // Orient pelvis to face the target (apply torque)
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(
        new THREE.Quaternion(
          pelvis.rotation().x,
          pelvis.rotation().y,
          pelvis.rotation().z,
          pelvis.rotation().w
        )
      );
      const cross = new THREE.Vector3().crossVectors(facing, toTarget);
      pelvis.applyTorqueImpulse({ x: 0, y: cross.y * 0.6 * delta, z: 0 }, true);

      // Limb procedural impulses — make her "wobble walk"
      // (cosmetic: limbs are visual children of body, animated in AiraRagdoll)

      // Remove balance impulse — capsule with locked rotation stays upright.
      // (Old balance code removed - it was causing accumulating vertical velocity.)

      status = "walking";

      // Special behaviors
      const isGrounded = tr.y < 1.4 && Math.abs(lv.y) < 0.3;
      if (goal === GOALS.JUMP_OBSTACLE && distance < 1.6 && isGrounded) {
        // Jump impulse — single trigger
        pelvis.applyImpulse({ x: toTarget.x * 0.8, y: jumpPower * 0.6, z: toTarget.z * 0.8 }, true);
        status = "jumping";
      }

      if (goal === GOALS.LIFT_OBJECT && targetType === "liftBox" && distance < 1.0) {
        // Pull liftBox upward via event
        status = "lifting";
        window.dispatchEvent(new CustomEvent("aira:lift", { detail: { targetId: objects.find((o) => o.type === "liftBox")?.id } }));
      }

      // Success detection
      const successDist = goal === GOALS.JUMP_OBSTACLE ? 0.6 : goal === GOALS.LIFT_OBJECT ? 0.9 : 0.7;
      if (distance < successDist && successCoolRef.current <= 0 && goal !== GOALS.FOLLOW_LIGHT && goal !== GOALS.FOLLOW_OBJECT) {
        incrementSuccess();
        successCoolRef.current = 3.0;
        status = "success!";
      }
    }

    // Fall detection: if pelvis below 0.35m and lying flat
    if (tr.y < 0.35 && fallCoolRef.current <= 0) {
      incrementFall();
      fallCoolRef.current = 2.5;
      status = "fallen";
    }

    // Reset if she falls off the world
    if (tr.y < -3) {
      pelvis.setTranslation({ x: 0, y: 1.3, z: 0 }, true);
      pelvis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Update store telemetry (throttled by frame; cheap)
    updateAiraState(
      [Number(tr.x.toFixed(2)), Number(tr.y.toFixed(2)), Number(tr.z.toFixed(2))],
      [Number(lv.x.toFixed(2)), Number(lv.y.toFixed(2)), Number(lv.z.toFixed(2))],
      status
    );

    // --- Pipeline pulses (high frequency, module-level, no React churn) ---
    pulse("brain");
    if (target && goal !== GOALS.IDLE) {
      pulse("motor");
      pulse("physics");
      pulse("body");
    }

    // --- AI thoughts (throttled to ~2.5 Hz + on status change) ---
    const nowMs = performance.now();
    const statusChanged = status !== lastStatusRef.current;
    if (statusChanged || nowMs - lastThoughtAtRef.current > 400) {
      lastThoughtAtRef.current = nowMs;
      lastStatusRef.current = status;
      const horizV = Math.hypot(lv.x, lv.z);
      if (statusChanged && status === "fallen") {
        pushThought("reflex", `FALL detected · pelvis y=${tr.y.toFixed(2)} m`);
      } else if (statusChanged && status === "success!") {
        pushThought("learn", `success! · goal=${goal.replace(/_/g, " ")}`);
      } else if (statusChanged && status === "jumping") {
        pushThought("act", `JUMP impulse · target ${distance.toFixed(2)} m ahead`);
      } else if (statusChanged && status === "lifting") {
        pushThought("act", `engage lift · target in arms' reach`);
      } else if (target && goal !== GOALS.IDLE) {
        pushThought(
          "decide",
          `walk → ${targetType || "target"} · ${distance.toFixed(2)} m · v=${horizV.toFixed(2)} m/s`
        );
      } else if (status === "idle") {
        // Only push idle thought rarely
        if (nowMs - lastThoughtAtRef.current > 2000) {
          pushThought("sense", "idle · awaiting goal");
        }
      }
    }
  });

  return null;
}
