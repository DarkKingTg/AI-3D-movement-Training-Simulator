import React, { useEffect, useRef, useMemo, Component } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";

/**
 * GLBPreview — Loads a user-uploaded GLB/glTF avatar inside the R3F canvas.
 *
 * Two modes, controlled from the AvatarPanel:
 *
 *  1. **Preview** (`driveSkeleton = false`)  →  renders the avatar at a fixed
 *     +2 m offset next to procedural Aira so the user can inspect bones.
 *
 *  2. **Drive Skeleton** (`driveSkeleton = true`)  →  every frame:
 *       - anchors the avatar root to Aira's pelvis world transform
 *       - for every mapped bone, copies the matching Aira joint/body
 *         world-quaternion onto the GLB bone (converted to local-parent space)
 *     The result: the imported avatar moves *as* the simulation body. Combined
 *     with the "Hide Procedural" toggle (handled in SimulationCanvas), this
 *     swaps the procedural mesh out for the custom avatar at runtime.
 */

// Map an "Aira slot" (the dropdown choice in AvatarPanel) to a ref that
// exposes a live world-quaternion. Refs are resolved every frame to handle
// kinematic↔physics mode switches and re-mounts.
function resolveSlotSource(slot, aira) {
  if (!aira) return null;
  const mode = aira.mode;

  if (mode === "physics") {
    // In physics mode, slots map to the rigid body whose rotation best
    // represents that bone segment. Each entry is a Rapier RigidBody ref.
    const bodies = {
      head:       aira.allParts[2],   // head sphere
      spine:      aira.allParts[1],   // torso capsule
      lShoulder:  aira.allParts[3],   // lUpArm
      rShoulder:  aira.allParts[4],   // rUpArm
      lElbow:     aira.allParts[5],   // lLoArm
      rElbow:     aira.allParts[6],   // rLoArm
      lWrist:     aira.allParts[5],
      rWrist:     aira.allParts[6],
      lFingers:   aira.allParts[5],
      rFingers:   aira.allParts[6],
      lHip:       aira.allParts[7],   // lUpLeg
      rHip:       aira.allParts[8],   // rUpLeg
      lKnee:      aira.allParts[9],   // lLoLeg
      rKnee:      aira.allParts[10],  // rLoLeg
    };
    return bodies[slot] || null;
  }

  // Kinematic mode: slot maps directly to one of the THREE.Object3D bone refs.
  return aira.bones?.[slot] || null;
}

// Read a world-space quaternion from a RigidBody ref OR a THREE.Object3D ref.
// Returns true on success, false if the ref isn't ready yet.
const _q = new THREE.Quaternion();
function readWorldQuat(refLike, out, aira) {
  const node = refLike?.current;
  if (!node) return false;
  // RigidBody refs expose .rotation() returning a {x,y,z,w} quaternion.
  if (typeof node.rotation === "function") {
    const r = node.rotation();
    out.set(r.x, r.y, r.z, r.w);
    return true;
  }
  // THREE.Object3D — but its quaternion is local. Kinematic-mode bones live
  // inside the pelvis RigidBody, so combine pelvis world rot with the bone's
  // local quaternion stack via getWorldQuaternion which walks parents.
  if (node.getWorldQuaternion) {
    node.getWorldQuaternion(out);
    return true;
  }
  // Fallback: try .quaternion property
  if (node.quaternion) {
    out.copy(node.quaternion);
    return true;
  }
  return false;
}

// Get the world quaternion of a node's parent (so we can convert world → local).
function readParentWorldQuat(boneNode, out) {
  const parent = boneNode.parent;
  if (!parent) {
    out.identity();
    return;
  }
  parent.getWorldQuaternion(out);
}

const SUGGESTED_BONE_KEYS = [
  "head", "neck", "spine", "chest",
  "leftshoulder", "rightshoulder", "leftarm", "rightarm",
  "leftforearm", "rightforearm", "lefthand", "righthand",
  "hips", "leftupleg", "rightupleg", "leftleg", "rightleg",
  "leftfoot", "rightfoot",
];
const _suggested = SUGGESTED_BONE_KEYS;

export default function GLBPreview({ airaRef }) {
  const glbUrl = useSimStore((s) => s.glbAvatar.url);
  const visible = useSimStore((s) => s.glbAvatar.previewVisible);
  const updateBoneTree = useSimStore((s) => s.updateGlbBoneTree);
  const scale = useSimStore((s) => s.glbAvatar.scale);
  const driveSkeleton = useSimStore((s) => s.glbAvatar.driveSkeleton);
  const mapping = useSimStore((s) => s.glbAvatar.mapping);

  const rootRef = useRef(null);

  // --- Drive loop: anchor root to pelvis & copy mapped-bone rotations ---
  const _qSrc = useMemo(() => new THREE.Quaternion(), []);
  const _qParent = useMemo(() => new THREE.Quaternion(), []);
  const _qLocal = useMemo(() => new THREE.Quaternion(), []);
  const boneCacheRef = useRef(null); // { boneName: THREE.Bone }
  const restPoseRef = useRef(null);  // { boneName: { srcRestInv: Quaternion, glbRest: Quaternion } }

  useFrame(() => {
    const aira = airaRef?.current;
    const root = rootRef.current;
    if (!root || !aira) return;

    if (driveSkeleton) {
      // 1) Anchor root to pelvis world position so the avatar walks with her.
      const pelvis = aira.pelvis?.current;
      if (pelvis && typeof pelvis.translation === "function") {
        const t = pelvis.translation();
        // Drop ~0.85 m so the GLB's feet meet the ground (Aira's pelvis is
        // at y≈1.0 m and a typical GLB has its origin at the feet).
        root.position.set(t.x, t.y - 1.0, t.z);
        // Apply pelvis yaw only — Aira's pelvis is rotation-locked on X/Z in
        // upright mode so this gives clean facing without making the avatar tilt.
        const r = pelvis.rotation();
        _qSrc.set(r.x, r.y, r.z, r.w);
        root.quaternion.copy(_qSrc);
      }

      // 2) Drive mapped bones from the matching live Aira source quaternion.
      const cache = boneCacheRef.current;
      if (cache) {
        for (const boneName in mapping) {
          const slot = mapping[boneName];
          if (!slot) continue;
          const bone = cache[boneName];
          if (!bone) continue;
          const sourceRef = resolveSlotSource(slot, aira);
          if (!sourceRef) continue;
          if (!readWorldQuat(sourceRef, _qSrc, aira)) continue;

          // Convert world quaternion to local-parent space:
          //   local = inverse(parentWorld) * world
          readParentWorldQuat(bone, _qParent);
          _qLocal.copy(_qParent).invert().multiply(_qSrc);

          // Optional: combine with each bone's rest delta so the avatar's
          // T-pose is preserved (we currently apply raw rotation — good
          // enough for v1 and visually responsive). Smoothing for stability:
          bone.quaternion.slerp(_qLocal, 0.6);
        }
      }
    }
  });

  if (!glbUrl || !visible) return null;

  // When driving skeleton, override the +2 m offset (root is positioned by useFrame).
  // When preview, render at the old +2 m offset.
  return (
    <group
      ref={rootRef}
      position={driveSkeleton ? [0, 0, 0] : [2, 0, 0]}
      scale={scale}
    >
      <ErrorBoundary>
        <LoadedGLB
          url={glbUrl}
          onBones={updateBoneTree}
          onBoneCache={(c) => { boneCacheRef.current = c; }}
        />
      </ErrorBoundary>
    </group>
  );
}

function LoadedGLB({ url, onBones, onBoneCache }) {
  const { scene } = useGLTF(url);
  const reportedRef = useRef("");

  useEffect(() => {
    if (!scene) return;
    const bones = [];
    const cache = {};
    scene.traverse((obj) => {
      if (obj.isBone || obj.type === "Bone") {
        const guess = pickSlot(obj.name);
        bones.push({ name: obj.name, type: obj.type, guess });
        cache[obj.name] = obj;
      }
    });
    onBoneCache(cache);
    const signature = bones.map((b) => b.name).join("|");
    if (signature !== reportedRef.current) {
      reportedRef.current = signature;
      onBones(bones);
    }
  }, [scene, onBones, onBoneCache]);

  return <primitive object={scene} />;
}

/**
 * Heuristic auto-mapping: given a GLB bone name, return the matching Aira
 * joint slot it most likely maps to (or null if no good guess).
 */
function pickSlot(boneName) {
  const n = boneName.toLowerCase();
  const isLeft = /(^|[._-])l([._-]|eft)/.test(n) || /(^l_)/.test(n);
  const isRight = /(^|[._-])r([._-]|ight)/.test(n) || /(^r_)/.test(n);

  if (/head|cranium/.test(n)) return "head";
  if (/spine|chest|abdomen|stomach/.test(n)) return "spine";

  if (/shoulder|clavicle/.test(n)) return isRight ? "rShoulder" : "lShoulder";
  if (/upper.?arm|^arm(_|$)/.test(n)) return isRight ? "rShoulder" : "lShoulder";
  if (/forearm|elbow/.test(n)) return isRight ? "rElbow" : "lElbow";
  if (/wrist/.test(n)) return isRight ? "rWrist" : "lWrist";
  if (/hand|palm/.test(n)) return isRight ? "rWrist" : "lWrist";
  if (/finger|thumb|index|pinky/.test(n)) return isRight ? "rFingers" : "lFingers";

  if (/hip|pelvis/.test(n) && !isLeft && !isRight) return "spine";
  if (/up.?leg|thigh/.test(n)) return isRight ? "rHip" : "lHip";
  if (/leg|knee|shin|calf/.test(n)) return isRight ? "rKnee" : "lKnee";
  if (/foot|toe|ankle/.test(n)) return isRight ? "rKnee" : "lKnee";

  return null;
}

// Minimal error boundary so a malformed GLB doesn't crash the whole canvas
class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() {}
  render() { return this.state.err ? null : this.props.children; }
}
