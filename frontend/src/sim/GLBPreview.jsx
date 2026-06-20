import React, { useEffect, useState, useRef, Component } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";

/**
 * GLBPreview — when the user uploads a GLB avatar, this renders it inside the
 * R3F canvas as a non-interactive reference. We DON'T (yet) drive its skeleton
 * from Aira's joint state — that requires a full bone-mapping rig and is on
 * the P2 roadmap. v1 of this feature just loads + previews the avatar and
 * walks its bone tree so the user can inspect what's available for mapping.
 */
const SUGGESTED_BONE_KEYS = [
  "head", "neck", "spine", "chest",
  "leftshoulder", "rightshoulder", "leftarm", "rightarm",
  "leftforearm", "rightforearm", "lefthand", "righthand",
  "hips", "leftupleg", "rightupleg", "leftleg", "rightleg",
  "leftfoot", "rightfoot",
];

export default function GLBPreview() {
  const glbUrl = useSimStore((s) => s.glbAvatar.url);
  const visible = useSimStore((s) => s.glbAvatar.previewVisible);
  const updateBoneTree = useSimStore((s) => s.updateGlbBoneTree);
  const scale = useSimStore((s) => s.glbAvatar.scale);

  if (!glbUrl || !visible) return null;
  return (
    <group position={[2, 0, 0]} scale={scale}>
      <ErrorBoundary>
        <LoadedGLB url={glbUrl} onBones={updateBoneTree} />
      </ErrorBoundary>
    </group>
  );
}

function LoadedGLB({ url, onBones }) {
  const { scene } = useGLTF(url);
  const reportedRef = useRef("");

  useEffect(() => {
    if (!scene) return;
    const bones = [];
    scene.traverse((obj) => {
      if (obj.isBone || obj.type === "Bone") {
        const guess = pickSlot(obj.name);
        bones.push({ name: obj.name, type: obj.type, guess });
      }
    });
    const signature = bones.map((b) => b.name).join("|");
    if (signature !== reportedRef.current) {
      reportedRef.current = signature;
      onBones(bones);
    }
  }, [scene, onBones]);

  return <primitive object={scene} />;
}

/**
 * Heuristic auto-mapping: given a GLB bone name, return the matching Aira
 * joint slot it most likely maps to (or null if no good guess).
 */
function pickSlot(boneName) {
  const n = boneName.toLowerCase();
  // Direct keyword matches with side detection
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
