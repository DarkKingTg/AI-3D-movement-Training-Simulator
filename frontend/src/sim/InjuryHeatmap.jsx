import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";
import { decayAll, getNormalized, snapshotNormalized } from "@/sim/injuryState";

/**
 * InjuryHeatmap — paints each limb a deeper shade of red proportional to the
 * cumulative impact force absorbed in the last ~5 seconds (2.5s half-life).
 *
 * The component runs inside the R3F Canvas so it has access to useFrame.
 * Every frame we:
 *   1. Decay all part injuries.
 *   2. Read each material ref (exposed by AiraRagdollPhysics / AiraRagdoll
 *      via `airaRef.current.materials`).
 *   3. Lerp the material's emissive toward red and bump emissiveIntensity by
 *      the normalized injury level.
 * A throttled snapshot is pushed back to the store every 250 ms so the
 * SensorPanel can display per-part injury percentages in the AI Input Feed.
 */
const RED = new THREE.Color("#ff2020");
const _c = new THREE.Color();
const _baseStore = new WeakMap(); // material -> original emissive color clone

export default function InjuryHeatmap({ airaRef }) {
  const enabled = useSimStore((s) => s.injuries.enabled);
  const updateInjurySnapshot = useSimStore((s) => s.updateInjurySnapshot);
  const lastWriteRef = useRef(0);

  useFrame((_, dt) => {
    decayAll(dt);
    if (!airaRef.current) return;
    const materials = airaRef.current.materials;
    if (!materials) return;

    for (const [partKey, mat] of Object.entries(materials)) {
      if (!mat) continue;
      // Cache base emissive color the first time we see this material
      if (!_baseStore.has(mat)) {
        _baseStore.set(mat, mat.emissive ? mat.emissive.clone() : new THREE.Color(0, 0, 0));
      }
      const base = _baseStore.get(mat);

      const level = enabled ? getNormalized(partKey) : 0;
      if (mat.emissive) {
        _c.copy(base).lerp(RED, level);
        mat.emissive.copy(_c);
        mat.emissiveIntensity = 0.2 + level * 1.2;
      }
    }

    // Throttle store write to 4 Hz
    const now = performance.now();
    if (now - lastWriteRef.current > 250) {
      lastWriteRef.current = now;
      updateInjurySnapshot(snapshotNormalized());
    }
  });

  return null;
}
