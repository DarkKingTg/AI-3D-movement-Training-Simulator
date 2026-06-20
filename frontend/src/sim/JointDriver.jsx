import { useFrame } from "@react-three/fiber";
import { useSimStore } from "@/store/simStore";
import { clampJoint, toRad } from "@/sim/anatomy";

/**
 * JointDriver — runs every frame BEFORE the procedural walking overlay
 * (the AiraRagdoll's own useFrame runs after this).
 *
 * 1. Reads commanded `joints` from the store.
 * 2. Clamps each joint to anatomical limits.
 * 3. Applies the clamped Euler rotations to the matching ref group.
 * 4. Writes the *actually applied* angles back to the store as
 *    `jointsActual` — this is Aira's proprioceptive sense.
 */
export default function JointDriver({ airaRef }) {
  const joints = useSimStore((s) => s.joints);
  const updateProprioception = useSimStore((s) => s.updateProprioception);

  useFrame(() => {
    if (!airaRef.current) return;
    const bones = airaRef.current.bones;
    if (!bones) return;

    const actual = {};

    // Helper: apply XYZ Euler in degrees with clamping
    const apply = (key, group, mapping) => {
      if (!group?.current) return;
      const cmd = joints[key] || {};
      const clamped = clampJoint(key, cmd);
      actual[key] = clamped;
      const { x, y, z } = mapping(clamped);
      group.current.rotation.set(toRad(x), toRad(y), toRad(z));
    };

    // Spine: pitch=X, yaw=Y, roll=Z
    apply("spine", bones.spine, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));

    // Head: pitch=X, yaw=Y, roll=Z
    apply("head", bones.head, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));

    // Shoulders — shoulder "pitch" raises arm (around X), yaw swings (around Z), roll twists (Y)
    apply("lShoulder", bones.lShoulder, (j) => ({ x: -(j.pitch || 0), y: j.roll || 0, z: j.yaw || 0 }));
    apply("rShoulder", bones.rShoulder, (j) => ({ x: -(j.pitch || 0), y: j.roll || 0, z: -(j.yaw || 0) }));

    // Elbows — bend around X
    apply("lElbow", bones.lElbow, (j) => ({ x: j.bend || 0, y: 0, z: 0 }));
    apply("rElbow", bones.rElbow, (j) => ({ x: j.bend || 0, y: 0, z: 0 }));

    // Wrists
    apply("lWrist", bones.lWrist, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: 0 }));
    apply("rWrist", bones.rWrist, (j) => ({ x: j.pitch || 0, y: -(j.yaw || 0), z: 0 }));

    // Fingers — single curl around X
    apply("lFingers", bones.lFingers, (j) => ({ x: j.curl || 0, y: 0, z: 0 }));
    apply("rFingers", bones.rFingers, (j) => ({ x: j.curl || 0, y: 0, z: 0 }));

    // Hips
    apply("lHip", bones.lHip, (j) => ({ x: j.pitch || 0, y: j.yaw || 0, z: j.roll || 0 }));
    apply("rHip", bones.rHip, (j) => ({ x: j.pitch || 0, y: -(j.yaw || 0), z: -(j.roll || 0) }));

    // Knees
    apply("lKnee", bones.lKnee, (j) => ({ x: -(j.bend || 0), y: 0, z: 0 }));
    apply("rKnee", bones.rKnee, (j) => ({ x: -(j.bend || 0), y: 0, z: 0 }));

    // Throttle proprioception writes (~5Hz) — avoid re-render storms
    if (!JointDriver._lastWrite || performance.now() - JointDriver._lastWrite > 200) {
      JointDriver._lastWrite = performance.now();
      updateProprioception(actual);
    }
  });

  return null;
}
