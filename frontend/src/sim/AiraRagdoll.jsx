import { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";
import { JOINT_LIMITS, clampDeg, toRad } from "@/sim/anatomy";

/**
 * Aira — Female-child humanoid with articulated cosmetic limbs.
 *
 * Physics: a single capsule rigid body (pelvis/core), rotations locked on X/Z.
 * Skeleton: nested groups (refs) acting as bones — head/neck, shoulders,
 * elbows, wrists, finger sets, hips, knees. Rotations are driven each frame
 * by the joints state in the store, with anatomical clamping in JointDriver.
 *
 * Exposes refs for:
 *   - pelvis (rigid body)
 *   - eyeAnchor (THREE.Object3D at the eye position, used by VisionCamera)
 *   - bones (all controllable groups, used by JointDriver/proprioception)
 *   - parts (named meshes for contact sensing & raycasting)
 */

const SKIN = "#f3c9a7";
const SKIN_DARK = "#d9a884";
const HAIR = "#3a1f15";
const TOP = "#ff3366";
const PANTS = "#1e2740";
const SHOE = "#202020";
const BOW = "#FFEA00";

const AiraRagdoll = forwardRef(function Aira({ spawnPosition = [0, 1.0, 0], meshHidden = false }, fwd) {
  const body = useRef(null);

  // Bone group refs (used to apply joint rotations)
  const bones = {
    spine: useRef(null),
    head: useRef(null),
    lShoulder: useRef(null),
    rShoulder: useRef(null),
    lElbow: useRef(null),
    rElbow: useRef(null),
    lWrist: useRef(null),
    rWrist: useRef(null),
    lFingers: useRef(null),
    rFingers: useRef(null),
    lHip: useRef(null),
    rHip: useRef(null),
    lKnee: useRef(null),
    rKnee: useRef(null),
  };

  // Eye anchor — at head center, slightly forward
  const eyeAnchor = useRef(null);

  // Walking phase reference
  const tRef = useRef(0);

  useImperativeHandle(
    fwd,
    () => ({
      pelvis: body,
      core: body,
      eyeAnchor,
      bones,
      feet: [{ current: null }, { current: null }],
      hands: [{ current: null }, { current: null }],
      allParts: [body],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Procedural walking overlay (legs/arms swing on top of commanded joint angles)
  const goal = useSimStore((s) => s.goal);
  useFrame((_, delta) => {
    if (!body.current) return;
    tRef.current += delta;
    const lv = body.current.linvel();
    const speed = Math.hypot(lv.x, lv.z);
    const phase = tRef.current * (4 + speed * 2.2);
    const swing = Math.sin(phase) * Math.min(0.9, speed * 0.4);
    const armSwing = Math.sin(phase + Math.PI) * Math.min(0.8, speed * 0.4);

    // Apply procedural walking overlay AFTER JointDriver sets base pose (we run later)
    if (speed > 0.05) {
      if (bones.lHip.current) bones.lHip.current.rotation.x += swing;
      if (bones.rHip.current) bones.rHip.current.rotation.x -= swing;
      if (bones.lShoulder.current) bones.lShoulder.current.rotation.x += armSwing;
      if (bones.rShoulder.current) bones.rShoulder.current.rotation.x -= armSwing;
    }
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
      <CapsuleCollider args={[0.3, 0.18]} />

      {/* SPINE bone — rotates whole torso */}
      <group ref={bones.spine} position={[0, 0, 0]} visible={!meshHidden}>
        {/* TORSO mesh */}
        <mesh name="aira-torso" position={[0, 0, 0]}>
          <capsuleGeometry args={[0.16, 0.28, 4, 14]} />
          <meshStandardMaterial color={TOP} roughness={0.65} />
        </mesh>

        {/* PELVIS mesh */}
        <mesh name="aira-pelvis-visual" position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.155, 0.1, 4, 14]} />
          <meshStandardMaterial color={PANTS} roughness={0.75} />
        </mesh>

        {/* NECK + HEAD bone */}
        <group ref={bones.head} position={[0, 0.42, 0]}>
          {/* Head */}
          <mesh name="aira-head">
            <sphereGeometry args={[0.17, 28, 28]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
          {/* Hair cap */}
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.178, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
            <meshStandardMaterial color={HAIR} roughness={0.9} />
          </mesh>
          <mesh position={[-0.18, -0.02, 0]} rotation={[0, 0, 0.25]}>
            <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
            <meshStandardMaterial color={HAIR} />
          </mesh>
          <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, -0.25]}>
            <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
            <meshStandardMaterial color={HAIR} />
          </mesh>
          <mesh position={[0.1, 0.16, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.04]} />
            <meshStandardMaterial color={BOW} emissive={BOW} emissiveIntensity={0.3} />
          </mesh>
          {/* Eyes */}
          <mesh position={[0.055, 0.0, 0.155]}>
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.055, 0.0, 0.17]}>
            <sphereGeometry args={[0.011, 12, 12]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-0.055, 0.0, 0.155]}>
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.055, 0.0, 0.17]}>
            <sphereGeometry args={[0.011, 12, 12]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, -0.06, 0.15]}>
            <boxGeometry args={[0.04, 0.008, 0.008]} />
            <meshStandardMaterial color="#a02020" />
          </mesh>
          {/* Eye anchor — virtual camera position */}
          <object3D ref={eyeAnchor} position={[0, 0.02, 0.18]} />
        </group>

        {/* LEFT SHOULDER → ELBOW → WRIST → FINGERS */}
        <group ref={bones.lShoulder} position={[-0.21, 0.16, 0]}>
          <mesh name="aira-lUpperArm" position={[0, -0.11, 0]}>
            <capsuleGeometry args={[0.05, 0.18, 4, 10]} />
            <meshStandardMaterial color={TOP} roughness={0.65} />
          </mesh>
          <group ref={bones.lElbow} position={[0, -0.22, 0]}>
            <mesh name="aira-lForearm" position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.045, 0.16, 4, 10]} />
              <meshStandardMaterial color={SKIN} roughness={0.55} />
            </mesh>
            <group ref={bones.lWrist} position={[0, -0.22, 0]}>
              <mesh name="aira-lPalm">
                <boxGeometry args={[0.07, 0.07, 0.04]} />
                <meshStandardMaterial color={SKIN_DARK} roughness={0.55} />
              </mesh>
              <group ref={bones.lFingers} position={[0, -0.05, 0]}>
                {[0, 1, 2, 3].map((i) => (
                  <mesh key={i} position={[-0.025 + i * 0.017, -0.03, 0]}>
                    <capsuleGeometry args={[0.008, 0.05, 4, 6]} />
                    <meshStandardMaterial color={SKIN} />
                  </mesh>
                ))}
                {/* thumb */}
                <mesh position={[-0.045, 0.0, 0.02]} rotation={[0, 0, 0.6]}>
                  <capsuleGeometry args={[0.009, 0.04, 4, 6]} />
                  <meshStandardMaterial color={SKIN} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* RIGHT SHOULDER */}
        <group ref={bones.rShoulder} position={[0.21, 0.16, 0]}>
          <mesh name="aira-rUpperArm" position={[0, -0.11, 0]}>
            <capsuleGeometry args={[0.05, 0.18, 4, 10]} />
            <meshStandardMaterial color={TOP} roughness={0.65} />
          </mesh>
          <group ref={bones.rElbow} position={[0, -0.22, 0]}>
            <mesh name="aira-rForearm" position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.045, 0.16, 4, 10]} />
              <meshStandardMaterial color={SKIN} roughness={0.55} />
            </mesh>
            <group ref={bones.rWrist} position={[0, -0.22, 0]}>
              <mesh name="aira-rPalm">
                <boxGeometry args={[0.07, 0.07, 0.04]} />
                <meshStandardMaterial color={SKIN_DARK} roughness={0.55} />
              </mesh>
              <group ref={bones.rFingers} position={[0, -0.05, 0]}>
                {[0, 1, 2, 3].map((i) => (
                  <mesh key={i} position={[-0.025 + i * 0.017, -0.03, 0]}>
                    <capsuleGeometry args={[0.008, 0.05, 4, 6]} />
                    <meshStandardMaterial color={SKIN} />
                  </mesh>
                ))}
                <mesh position={[0.045, 0.0, 0.02]} rotation={[0, 0, -0.6]}>
                  <capsuleGeometry args={[0.009, 0.04, 4, 6]} />
                  <meshStandardMaterial color={SKIN} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* LEFT HIP → KNEE → FOOT */}
        <group ref={bones.lHip} position={[-0.08, -0.28, 0]}>
          <mesh name="aira-lThigh" position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.065, 0.18, 4, 12]} />
            <meshStandardMaterial color={PANTS} roughness={0.75} />
          </mesh>
          <group ref={bones.lKnee} position={[0, -0.26, 0]}>
            <mesh name="aira-lShin" position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.058, 0.16, 4, 12]} />
              <meshStandardMaterial color={PANTS} roughness={0.75} />
            </mesh>
            <mesh name="aira-lFoot" position={[0, -0.22, 0.04]}>
              <boxGeometry args={[0.12, 0.07, 0.18]} />
              <meshStandardMaterial color={SHOE} roughness={0.6} />
            </mesh>
          </group>
        </group>

        {/* RIGHT HIP → KNEE → FOOT */}
        <group ref={bones.rHip} position={[0.08, -0.28, 0]}>
          <mesh name="aira-rThigh" position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.065, 0.18, 4, 12]} />
            <meshStandardMaterial color={PANTS} roughness={0.75} />
          </mesh>
          <group ref={bones.rKnee} position={[0, -0.26, 0]}>
            <mesh name="aira-rShin" position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.058, 0.16, 4, 12]} />
              <meshStandardMaterial color={PANTS} roughness={0.75} />
            </mesh>
            <mesh name="aira-rFoot" position={[0, -0.22, 0.04]}>
              <boxGeometry args={[0.12, 0.07, 0.18]} />
              <meshStandardMaterial color={SHOE} roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </RigidBody>
  );
});

export default AiraRagdoll;
