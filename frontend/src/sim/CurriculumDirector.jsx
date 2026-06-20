import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";
import { buildLevelLayout, CURRICULUM } from "@/sim/curriculum";

/**
 * CurriculumDirector — runs inside the R3F canvas (so it has frame access).
 *
 * When curriculum mode is active and the goal is WALK_TO_TARGET, it:
 *  1. Builds the layout for the current level (target + obstacles).
 *  2. Times the lap.
 *  3. Detects Aira reaching the target (distance < 0.7m) and advances to next level.
 *  4. Records best lap time per level.
 */
export default function CurriculumDirector({ airaRef }) {
  const enabled = useSimStore((s) => s.curriculum.enabled);
  const levelIdx = useSimStore((s) => s.curriculum.levelIdx);
  const lapStartedAt = useSimStore((s) => s.curriculum.lapStartedAt);
  const completeLap = useSimStore((s) => s.completeLap);
  const setLapTimer = useSimStore((s) => s.setLapTimer);

  const lastLevelRef = useRef(-1);

  // Build level layout when curriculum is enabled or level changes
  useEffect(() => {
    if (!enabled) return;
    if (lastLevelRef.current === levelIdx) return;
    lastLevelRef.current = levelIdx;
    const { objects } = buildLevelLayout(levelIdx);
    // Spawn objects via store
    const { setLevelObjects, startLap, setGoalSilent, resetAira } = useSimStore.getState();
    setLevelObjects(objects);
    startLap();
    setGoalSilent("walk_to_target");
    resetAira();
  }, [enabled, levelIdx]);

  useFrame(() => {
    if (!enabled) return;
    if (!airaRef.current) return;
    const rb = airaRef.current.pelvis?.current;
    if (!rb) return;

    // Live lap timer (1Hz throttle)
    if (lapStartedAt && (!CurriculumDirector._lastTimer || performance.now() - CurriculumDirector._lastTimer > 200)) {
      CurriculumDirector._lastTimer = performance.now();
      setLapTimer((performance.now() - lapStartedAt) / 1000);
    }

    // Check distance to target
    const objects = useSimStore.getState().objects;
    const target = objects.find((o) => o.type === "target");
    if (!target) return;
    const t = rb.translation();
    const dx = target.position[0] - t.x;
    const dz = target.position[2] - t.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.8 && lapStartedAt) {
      const lapTime = (performance.now() - lapStartedAt) / 1000;
      completeLap(lapTime, CURRICULUM[levelIdx]);
    }
  });

  return null;
}
