import { useFrame } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import { useSimStore } from "@/store/simStore";
import { MOTIONS, sampleMotion } from "@/sim/motionLibrary";

/**
 * MotionPlayer — drives Aira's joints from a chosen motion clip.
 *
 * Runs every frame BEFORE JointDriver applies rotations. It calls
 * `setJointsRaw` (no persist) to push interpolated keyframe data into
 * the joints state, then JointDriver clamps and applies them to the
 * skeleton, then AiraRagdoll's own useFrame overlays procedural walking
 * (only if not playing a motion).
 */
export default function MotionPlayer() {
  const teaching = useSimStore((s) => s.teaching);
  const setJointsRaw = useSimStore((s) => s.setJointsRaw);
  const setMotionTime = useSimStore((s) => s.setMotionTime);
  const stopMotion = useSimStore((s) => s.stopMotion);

  const tRef = useRef(0);

  // Reset timer when active motion changes
  useEffect(() => {
    tRef.current = 0;
    if (teaching.playing && teaching.activeMotion) {
      try {
        const m = MOTIONS[teaching.activeMotion];
        useSimStore.getState().pushThought(
          "act",
          `teach · play "${m?.name || teaching.activeMotion}" @ ${(teaching.speed || 1).toFixed(2)}×`
        );
      } catch {}
    }
  }, [teaching.activeMotion, teaching.playing, teaching.speed]);

  useFrame((_, delta) => {
    if (!teaching.playing || !teaching.activeMotion) return;
    const motion = MOTIONS[teaching.activeMotion];
    if (!motion) return;
    tRef.current += delta * (teaching.speed || 1);
    const dur = motion.keyframes[motion.keyframes.length - 1].t;
    if (!motion.loop && tRef.current >= dur) {
      tRef.current = dur;
      setJointsRaw(sampleMotion(motion, dur));
      stopMotion();
      return;
    }
    const joints = sampleMotion(motion, tRef.current);
    setJointsRaw(joints);
    // Update timer in store at ~5Hz for UI
    if (!MotionPlayer._t || performance.now() - MotionPlayer._t > 200) {
      MotionPlayer._t = performance.now();
      setMotionTime(tRef.current);
    }
  });

  return null;
}
