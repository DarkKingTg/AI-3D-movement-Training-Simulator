import { useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import {
  RigidBody, CapsuleCollider, BallCollider,
  useSphericalJoint, useRevoluteJoint, useFixedJoint, interactionGroups,
} from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";
import { addImpact } from "@/sim/injuryState";
import { pulse } from "@/sim/pipelineState";
import { detectImpactBreak } from "@/sim/breakSystem";

/**
 * AiraRagdollPhysics — True multi-body ragdoll.
 *
 * Each limb segment is an individual Rapier RigidBody. Connections are real
 * physical joints:
 *   • Spherical: waist, neck, shoulders, hips, wrists, ankles  (3-DOF rotation)
 *   • Revolute:  elbows, knees                                  (hinge — 1 axis)
 *
 * Self-collision is disabled between Aira's own parts via Rapier interaction
 * groups (all bodies share membership group 1 and only collide with group 0 —
 * the world/obstacles).
 *
 * Pelvis remains the "control body" — AiController applies impulses there to
 * walk. With X/Z rotations locked on the pelvis, she stays upright while her
 * limbs hang and swing dynamically from physics. Unlock the pelvis (via the
 * "Toggle Ragdoll" button in UI) to let her collapse into a true ragdoll fall.
 *
 * Exposes the same airaRef shape as the kinematic version (pelvis, eyeAnchor,
 * bones, allParts) so existing AiController / sensors / panels keep working.
 */

const SKIN = "#f3c9a7";
const SKIN_DARK = "#d9a884";
const HAIR = "#3a1f15";
const TOP = "#ff3366";
const PANTS = "#1e2740";
const SHOE = "#202020";
const BOW = "#FFEA00";

// Self-collision filter: Aira's parts are all in group 1, only collide with
// group 0 (world). Obstacles and ground are in group 0 by default.
const AIRA_GROUP = interactionGroups([1], [0]);

// --- Joint helpers ---------------------------------------------------------
function SphereJ({ a, b, anchorA, anchorB, jointRef }) {
  const j = useSphericalJoint(a, b, [anchorA, anchorB]);
  if (jointRef) jointRef.current = j.current;
  return null;
}
function RevJ({ a, b, anchorA, anchorB, axis = [1, 0, 0], jointRef }) {
  const j = useRevoluteJoint(a, b, [anchorA, anchorB, axis]);
  if (jointRef) jointRef.current = j.current;
  return null;
}
function FixedJ({ a, b, anchorA, anchorB }) {
  useFixedJoint(a, b, [anchorA, [0, 0, 0, 1], anchorB, [0, 0, 0, 1]]);
  return null;
}

// Reusable physics-body capsule with contact-force reporting + material ref
function CapBody({ refKey, materialRef, position, args, color, mass = 1, name, locked = false, enabledRotations, enabledTranslations, onImpact, meshHidden, children }) {
  const extra = {};
  if (enabledRotations) extra.enabledRotations = enabledRotations;
  if (enabledTranslations) extra.enabledTranslations = enabledTranslations;
  if (locked) extra.lockRotations = true;
  return (
    <RigidBody
      ref={refKey}
      position={position}
      colliders={false}
      mass={mass}
      linearDamping={0.8}
      angularDamping={5}
      collisionGroups={AIRA_GROUP}
      friction={0.9}
      restitution={0}
      name={name}
      onContactForce={(payload) => onImpact?.(name, payload)}
      {...extra}
    >
      <CapsuleCollider args={args} />
      <mesh castShadow visible={!meshHidden}>
        <capsuleGeometry args={[args[1], args[0] * 2, 4, 14]} />
        <meshStandardMaterial ref={materialRef} color={color} roughness={0.6} />
      </mesh>
      <group visible={!meshHidden}>{children}</group>
    </RigidBody>
  );
}

// Sphere body (head)
function SphereBody({ refKey, materialRef, position, radius, color, mass = 1, name, onImpact, meshHidden, children }) {
  return (
    <RigidBody
      ref={refKey}
      position={position}
      colliders={false}
      mass={mass}
      linearDamping={0.8}
      angularDamping={5}
      collisionGroups={AIRA_GROUP}
      friction={0.9}
      restitution={0}
      name={name}
      onContactForce={(payload) => onImpact?.(name, payload)}
    >
      <BallCollider args={[radius]} />
      <mesh castShadow visible={!meshHidden}>
        <sphereGeometry args={[radius, 28, 28]} />
        <meshStandardMaterial ref={materialRef} color={color} roughness={0.55} />
      </mesh>
      <group visible={!meshHidden}>{children}</group>
    </RigidBody>
  );
}

const AiraRagdollPhysics = forwardRef(function AiraPhysics(
  { spawnPosition = [0, 1.0, 0], pelvisLocked = true, meshHidden = false },
  fwd
) {
  const [sx, sy, sz] = spawnPosition;

  // Refs for every body part
  const pelvis = useRef(null);
  const torso = useRef(null);
  const head = useRef(null);
  const lUpArm = useRef(null);
  const rUpArm = useRef(null);
  const lLoArm = useRef(null);
  const rLoArm = useRef(null);
  const lUpLeg = useRef(null);
  const rUpLeg = useRef(null);
  const lLoLeg = useRef(null);
  const rLoLeg = useRef(null);

  // Material refs — used by InjuryHeatmap to tint limbs red proportional to impact
  const matPelvis = useRef(null);
  const matTorso = useRef(null);
  const matHead = useRef(null);
  const matLUpArm = useRef(null);
  const matRUpArm = useRef(null);
  const matLLoArm = useRef(null);
  const matRLoArm = useRef(null);
  const matLUpLeg = useRef(null);
  const matRUpLeg = useRef(null);
  const matLLoLeg = useRef(null);
  const matRLoLeg = useRef(null);

  // Joint refs (so we can drive motors later)
  const joints = {
    waist: useRef(null),
    neck: useRef(null),
    lShoulder: useRef(null),
    rShoulder: useRef(null),
    lElbow: useRef(null),
    rElbow: useRef(null),
    lHip: useRef(null),
    rHip: useRef(null),
    lKnee: useRef(null),
    rKnee: useRef(null),
  };

  // Eye anchor — child of head body
  const eyeAnchor = useRef(null);

  // Compatibility "bones" shim so JointDriver / panels don't crash. These are
  // unused in physics mode but kept so the rest of the app holds together.
  const bones = useMemo(
    () => ({
      spine: { current: null }, head: { current: null },
      lShoulder: { current: null }, rShoulder: { current: null },
      lElbow: { current: null }, rElbow: { current: null },
      lWrist: { current: null }, rWrist: { current: null },
      lFingers: { current: null }, rFingers: { current: null },
      lHip: { current: null }, rHip: { current: null },
      lKnee: { current: null }, rKnee: { current: null },
    }),
    []
  );

  // Contact-force impact handler — writes a high-resolution per-part contact
  // record to the store. Rapier fires this event each time the contact-force
  // magnitude exceeds the configured threshold.
  const addContact = useSimStore((s) => s.addContact);
  const recordBreak = useSimStore((s) => s.recordBreak);
  const onImpact = useCallback((partName, payload) => {
    try {
      const force = payload?.totalForceMagnitude ?? 0;
      if (force < 1) return;
      const otherName = payload?.other?.rigidBodyObject?.name ||
                        payload?.other?.colliderObject?.name ||
                        "world";
      const partKey = partName.replace("aira-", "");
      addContact({
        part: partKey,
        otherName,
        force,
        t: Date.now(),
      });
      // Also feed the injury heatmap (module-level, no store churn at 60fps)
      addImpact(partKey, force);
      const breakEvent = detectImpactBreak(partKey, force);
      if (breakEvent) recordBreak(breakEvent);
      pulse("contacts");
      pulse("physics");
      pulse("body");
    } catch {}
  }, [addContact, recordBreak]);

  useImperativeHandle(
    fwd,
    () => ({
      pelvis,
      core: pelvis,
      eyeAnchor,
      bones,
      joints,
      mode: "physics",
      feet: [lLoLeg, rLoLeg],
      hands: [lLoArm, rLoArm],
      allParts: [pelvis, torso, head, lUpArm, rUpArm, lLoArm, rLoArm, lUpLeg, rUpLeg, lLoLeg, rLoLeg],
      // Live material refs — InjuryHeatmap reads `.current` each frame
      get materials() {
        return {
          pelvis: matPelvis.current,
          torso: matTorso.current,
          head: matHead.current,
          lUpArm: matLUpArm.current,
          rUpArm: matRUpArm.current,
          lLoArm: matLLoArm.current,
          rLoArm: matRLoArm.current,
          lUpLeg: matLUpLeg.current,
          rUpLeg: matRUpLeg.current,
          lLoLeg: matLLoLeg.current,
          rLoLeg: matRLoLeg.current,
        };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Position the eyeAnchor to follow head (head is a body — eyeAnchor needs world tracking)
  useFrame(() => {
    if (eyeAnchor.current && head.current) {
      const t = head.current.translation();
      const r = head.current.rotation();
      eyeAnchor.current.position.set(t.x, t.y, t.z);
      eyeAnchor.current.quaternion.set(r.x, r.y, r.z, r.w);
      // Move eye slightly forward (z+ in head local space)
      eyeAnchor.current.translateZ(0.18);
      eyeAnchor.current.translateY(0.02);
    }
  });

  // Body part positions — computed so each pair of joint anchors aligns
  // exactly in world space at spawn (no initial impulse from corrections).
  //
  // Anchor convention: each pair of (anchorA on bodyA, anchorB on bodyB) must
  // satisfy:   bodyA.pos + anchorA == bodyB.pos + anchorB.
  //
  // Joint anchors used:
  //   waist:     pelvis (0, 0.14, 0)   ↔ torso  (0, -0.16, 0)
  //   neck:      torso  (0, 0.18, 0)   ↔ head   (0, -0.16, 0)
  //   shoulder:  torso  (±0.17, 0.14, 0) ↔ upArm (0, 0.14, 0)
  //   elbow:     upArm  (0, -0.14, 0)  ↔ loArm  (0, 0.14, 0)
  //   hip:       pelvis (±0.08, -0.12, 0) ↔ upLeg (0, 0.16, 0)
  //   knee:      upLeg  (0, -0.16, 0)  ↔ loLeg  (0, 0.14, 0)
  const pos = useMemo(() => ({
    pelvis: [sx,         sy,         sz],          // y = 1.00
    torso:  [sx,         sy + 0.30,  sz],          // 1.30
    head:   [sx,         sy + 0.64,  sz],          // 1.64
    lUpArm: [sx - 0.17,  sy + 0.30,  sz],          // 1.30
    rUpArm: [sx + 0.17,  sy + 0.30,  sz],
    lLoArm: [sx - 0.17,  sy + 0.02,  sz],          // 1.02
    rLoArm: [sx + 0.17,  sy + 0.02,  sz],
    lUpLeg: [sx - 0.08,  sy - 0.28,  sz],          // 0.72
    rUpLeg: [sx + 0.08,  sy - 0.28,  sz],
    lLoLeg: [sx - 0.08,  sy - 0.58,  sz],          // 0.42
    rLoLeg: [sx + 0.08,  sy - 0.58,  sz],
  }), [sx, sy, sz]);

  return (
    <group>
      {/* PELVIS — pelvic capsule. When pelvisLocked: lock X/Z rotation AND
          Y translation so she "floats" upright while limbs dangle from joints. */}
      <CapBody
        refKey={pelvis}
        materialRef={matPelvis}
        position={pos.pelvis}
        args={[0.13, 0.10]}
        color={PANTS}
        mass={3}
        name="aira-pelvis"
        onImpact={onImpact}
        meshHidden={meshHidden}
        enabledRotations={pelvisLocked ? [false, true, false] : [true, true, true]}
        enabledTranslations={pelvisLocked ? [true, false, true] : [true, true, true]}
      />

      {/* TORSO */}
      <CapBody
        refKey={torso}
        materialRef={matTorso}
        position={pos.torso}
        args={[0.14, 0.22]}
        color={TOP}
        mass={2.5}
        name="aira-torso"
        onImpact={onImpact}
        meshHidden={meshHidden}
      />

      {/* HEAD (sphere) — includes hair, eyes, eye anchor */}
      <SphereBody
        refKey={head}
        materialRef={matHead}
        position={pos.head}
        radius={0.16}
        color={SKIN}
        mass={1.1}
        name="aira-head"
        onImpact={onImpact}
        meshHidden={meshHidden}
      >
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.168, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        <mesh position={[-0.17, -0.02, 0]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color={HAIR} />
        </mesh>
        <mesh position={[0.17, -0.02, 0]} rotation={[0, 0, -0.25]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color={HAIR} />
        </mesh>
        <mesh position={[0.1, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.04, 0.04]} />
          <meshStandardMaterial color={BOW} emissive={BOW} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.055, 0.0, 0.15]}>
          <sphereGeometry args={[0.022, 14, 14]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.055, 0.0, 0.165]}>
          <sphereGeometry args={[0.011, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.055, 0.0, 0.15]}>
          <sphereGeometry args={[0.022, 14, 14]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.055, 0.0, 0.165]}>
          <sphereGeometry args={[0.011, 12, 12]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, -0.06, 0.145]}>
          <boxGeometry args={[0.04, 0.008, 0.008]} />
          <meshStandardMaterial color="#a02020" />
        </mesh>
      </SphereBody>

      {/* Eye anchor — world-space follower */}
      <object3D ref={eyeAnchor} />

      {/* ARMS */}
      <CapBody refKey={lUpArm} materialRef={matLUpArm} position={pos.lUpArm} args={[0.05, 0.18]} color={TOP} mass={0.6} name="aira-lUpArm" onImpact={onImpact} meshHidden={meshHidden} />
      <CapBody refKey={rUpArm} materialRef={matRUpArm} position={pos.rUpArm} args={[0.05, 0.18]} color={TOP} mass={0.6} name="aira-rUpArm" onImpact={onImpact} meshHidden={meshHidden} />
      <CapBody refKey={lLoArm} materialRef={matLLoArm} position={pos.lLoArm} args={[0.045, 0.18]} color={SKIN} mass={0.5} name="aira-lLoArm" onImpact={onImpact} meshHidden={meshHidden}>
        <mesh position={[0, -0.13, 0]}>
          <boxGeometry args={[0.075, 0.08, 0.04]} />
          <meshStandardMaterial color={SKIN_DARK} />
        </mesh>
      </CapBody>
      <CapBody refKey={rLoArm} materialRef={matRLoArm} position={pos.rLoArm} args={[0.045, 0.18]} color={SKIN} mass={0.5} name="aira-rLoArm" onImpact={onImpact} meshHidden={meshHidden}>
        <mesh position={[0, -0.13, 0]}>
          <boxGeometry args={[0.075, 0.08, 0.04]} />
          <meshStandardMaterial color={SKIN_DARK} />
        </mesh>
      </CapBody>

      {/* LEGS */}
      <CapBody refKey={lUpLeg} materialRef={matLUpLeg} position={pos.lUpLeg} args={[0.065, 0.20]} color={PANTS} mass={1.4} name="aira-lUpLeg" onImpact={onImpact} meshHidden={meshHidden} />
      <CapBody refKey={rUpLeg} materialRef={matRUpLeg} position={pos.rUpLeg} args={[0.065, 0.20]} color={PANTS} mass={1.4} name="aira-rUpLeg" onImpact={onImpact} meshHidden={meshHidden} />
      <CapBody refKey={lLoLeg} materialRef={matLLoLeg} position={pos.lLoLeg} args={[0.058, 0.18]} color={PANTS} mass={0.9} name="aira-lLoLeg" onImpact={onImpact} meshHidden={meshHidden}>
        <mesh position={[0, -0.18, 0.04]}>
          <boxGeometry args={[0.12, 0.07, 0.18]} />
          <meshStandardMaterial color={SHOE} />
        </mesh>
      </CapBody>
      <CapBody refKey={rLoLeg} materialRef={matRLoLeg} position={pos.rLoLeg} args={[0.058, 0.18]} color={PANTS} mass={0.9} name="aira-rLoLeg" onImpact={onImpact} meshHidden={meshHidden}>
        <mesh position={[0, -0.18, 0.04]}>
          <boxGeometry args={[0.12, 0.07, 0.18]} />
          <meshStandardMaterial color={SHOE} />
        </mesh>
      </CapBody>

      {/* JOINTS */}
      {/* Waist: spherical, pelvis top to torso bottom */}
      <SphereJ a={pelvis} b={torso} anchorA={[0, 0.14, 0]} anchorB={[0, -0.16, 0]} jointRef={joints.waist} />
      {/* Neck: spherical, torso top to head bottom */}
      <SphereJ a={torso} b={head} anchorA={[0, 0.18, 0]} anchorB={[0, -0.16, 0]} jointRef={joints.neck} />

      {/* Shoulders: spherical, torso shoulder to upArm top */}
      <SphereJ a={torso} b={lUpArm} anchorA={[-0.17, 0.14, 0]} anchorB={[0, 0.14, 0]} jointRef={joints.lShoulder} />
      <SphereJ a={torso} b={rUpArm} anchorA={[0.17, 0.14, 0]} anchorB={[0, 0.14, 0]} jointRef={joints.rShoulder} />

      {/* Elbows: revolute, upArm bottom to loArm top, axis X */}
      <RevJ a={lUpArm} b={lLoArm} anchorA={[0, -0.14, 0]} anchorB={[0, 0.14, 0]} axis={[1, 0, 0]} jointRef={joints.lElbow} />
      <RevJ a={rUpArm} b={rLoArm} anchorA={[0, -0.14, 0]} anchorB={[0, 0.14, 0]} axis={[1, 0, 0]} jointRef={joints.rElbow} />

      {/* Hips: spherical, pelvis side to upLeg top */}
      <SphereJ a={pelvis} b={lUpLeg} anchorA={[-0.08, -0.12, 0]} anchorB={[0, 0.16, 0]} jointRef={joints.lHip} />
      <SphereJ a={pelvis} b={rUpLeg} anchorA={[0.08, -0.12, 0]} anchorB={[0, 0.16, 0]} jointRef={joints.rHip} />

      {/* Knees: revolute, upLeg bottom to loLeg top, axis X (hinge bends forward) */}
      <RevJ a={lUpLeg} b={lLoLeg} anchorA={[0, -0.16, 0]} anchorB={[0, 0.14, 0]} axis={[1, 0, 0]} jointRef={joints.lKnee} />
      <RevJ a={rUpLeg} b={rLoLeg} anchorA={[0, -0.16, 0]} anchorB={[0, 0.14, 0]} axis={[1, 0, 0]} jointRef={joints.rKnee} />
    </group>
  );
});

export default AiraRagdollPhysics;
