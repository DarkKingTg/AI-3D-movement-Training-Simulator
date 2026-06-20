import { useRef, useImperativeHandle, forwardRef } from "react";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Aira — Female-child humanoid.
 *
 * v1 implementation:
 *   • One physics rigid body (capsule) — pelvis/torso combined ("core").
 *     - Rotations locked on X/Z so she stays upright (procedural balance).
 *   • Cosmetic limbs (head, arms, legs) rendered as visual meshes inside the body
 *     and animated procedurally each frame (walking cycle, arm swing).
 *
 * This is much more stable than a full joint-ragdoll while still using
 * the rapier physics engine for locomotion (the controller applies forces
 * directly to the rigid body).
 */

const SKIN = "#f3c9a7";
const HAIR = "#3a1f15";
const TOP = "#ff3366";
const PANTS = "#1e2740";
const SHOE = "#202020";
const BOW = "#FFEA00";

const AiraRagdoll = forwardRef(function Aira({ spawnPosition = [0, 1.0, 0] }, fwd) {
  const body = useRef(null);

  // Limb refs for procedural animation
  const lArm = useRef(null);
  const rArm = useRef(null);
  const lLeg = useRef(null);
  const rLeg = useRef(null);
  const head = useRef(null);
  const tRef = useRef(0);

  useImperativeHandle(
    fwd,
    () => ({
      // Expose `.pelvis.current` API for compatibility with the controller
      pelvis: body,
      core: body,
      // Limbs are visual-only — for compatibility, controller checks `.current`
      feet: [{ current: null }, { current: null }],
      hands: [{ current: null }, { current: null }],
      allParts: [body],
    }),
    []
  );

  // Procedural animation tied to horizontal velocity
  useFrame((_, delta) => {
    if (!body.current) return;
    tRef.current += delta;
    const lv = body.current.linvel();
    const speed = Math.hypot(lv.x, lv.z);
    const phase = tRef.current * (4 + speed * 2.2);
    const swing = Math.sin(phase) * Math.min(0.9, 0.2 + speed * 0.5);
    const armSwing = Math.sin(phase + Math.PI) * Math.min(1.0, 0.25 + speed * 0.5);

    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = armSwing;
    if (rArm.current) rArm.current.rotation.x = -armSwing;
    if (head.current) head.current.rotation.y = Math.sin(tRef.current * 0.7) * 0.12;
  });

  return (
    <RigidBody
      ref={body}
      position={spawnPosition}
      colliders={false}
      mass={4}
      linearDamping={0.6}
      angularDamping={4}
      enabledRotations={[false, true, false]}
      friction={0.9}
      restitution={0}
      name="aira-core"
    >
      {/* Physics collider: a vertical capsule covering body */}
      <CapsuleCollider args={[0.3, 0.18]} />

      {/* TORSO (visual) */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.16, 0.28, 4, 14]} />
        <meshStandardMaterial color={TOP} roughness={0.65} />
      </mesh>

      {/* PELVIS / PANTS (visual) */}
      <mesh position={[0, -0.25, 0]}>
        <capsuleGeometry args={[0.155, 0.1, 4, 14]} />
        <meshStandardMaterial color={PANTS} roughness={0.75} />
      </mesh>

      {/* HEAD (visual, ref'd for nodding) */}
      <group ref={head} position={[0, 0.42, 0]}>
        <mesh>
          <sphereGeometry args={[0.17, 28, 28]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.178, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* twin braids */}
        <mesh position={[-0.18, -0.02, 0]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color={HAIR} />
        </mesh>
        <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, -0.25]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color={HAIR} />
        </mesh>
        {/* bow */}
        <mesh position={[0.1, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.04, 0.04]} />
          <meshStandardMaterial color={BOW} emissive={BOW} emissiveIntensity={0.3} />
        </mesh>
        {/* eyes */}
        <mesh position={[0.055, 0.0, 0.155]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[-0.055, 0.0, 0.155]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        {/* mouth */}
        <mesh position={[0, -0.06, 0.15]}>
          <boxGeometry args={[0.04, 0.008, 0.008]} />
          <meshStandardMaterial color="#a02020" />
        </mesh>
      </group>

      {/* LEFT ARM (visual, swings) */}
      <group ref={lArm} position={[-0.21, 0.16, 0]}>
        <mesh position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.05, 0.22, 4, 10]} />
          <meshStandardMaterial color={TOP} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
      </group>

      {/* RIGHT ARM (visual, swings) */}
      <group ref={rArm} position={[0.21, 0.16, 0]}>
        <mesh position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.05, 0.22, 4, 10]} />
          <meshStandardMaterial color={TOP} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
      </group>

      {/* LEFT LEG (visual, swings) */}
      <group ref={lLeg} position={[-0.08, -0.28, 0]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.065, 0.24, 4, 12]} />
          <meshStandardMaterial color={PANTS} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.4, 0.04]}>
          <boxGeometry args={[0.12, 0.07, 0.18]} />
          <meshStandardMaterial color={SHOE} roughness={0.6} />
        </mesh>
      </group>

      {/* RIGHT LEG (visual, swings) */}
      <group ref={rLeg} position={[0.08, -0.28, 0]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.065, 0.24, 4, 12]} />
          <meshStandardMaterial color={PANTS} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.4, 0.04]}>
          <boxGeometry args={[0.12, 0.07, 0.18]} />
          <meshStandardMaterial color={SHOE} roughness={0.6} />
        </mesh>
      </group>
    </RigidBody>
  );
});

export default AiraRagdoll;
