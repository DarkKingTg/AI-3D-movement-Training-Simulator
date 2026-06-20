import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSimStore } from "@/store/simStore";

/**
 * FallRecorder — rolling-buffer snapshot recorder that auto-records the
 * 3 seconds BEFORE and 3 seconds AFTER every ragdoll fall.
 *
 * Snapshot @ ~10 Hz of all 12 body part transforms (translation + rotation).
 * When a fall is detected (pelvis y < 0.35 OR contact force > 60 N), the
 * recorder "arms" and captures 3 more seconds, then bundles the buffer +
 * post-fall frames into a clip and pushes it to `fallsClips`.
 *
 * Only runs when ragdoll.mode === "physics" (kinematic mode has only one
 * body, so a fall clip wouldn't be meaningful).
 */
const SAMPLE_HZ = 10;
const POST_FALL_MS = 3000;
const FALL_Y_THRESHOLD = 0.4;
const FALL_FORCE_THRESHOLD = 40;

// Fixed ordering matches allParts in AiraRagdollPhysics
const PART_NAMES = [
  "aira-pelvis", "aira-torso", "aira-head",
  "aira-lUpArm", "aira-rUpArm", "aira-lLoArm", "aira-rLoArm",
  "aira-lUpLeg", "aira-rUpLeg", "aira-lLoLeg", "aira-rLoLeg",
];

export default function FallRecorder({ airaRef }) {
  const enabled = useSimStore((s) => s.recorder.enabled);
  const ragdollMode = useSimStore((s) => s.ragdoll.mode);
  const recordingPostFall = useSimStore((s) => s.recorder.recordingPostFall);
  const postFallEndsAt = useSimStore((s) => s.recorder.postFallEndsAt);
  const peakForceRef = useRef(0);

  const lastSampleRef = useRef(0);
  const postBufferRef = useRef([]);

  useFrame(() => {
    const state = useSimStore.getState();
    const { enabled, recordingPostFall, postFallEndsAt } = state.recorder;
    const ragdollMode = state.ragdoll.mode;
    if (!enabled || ragdollMode !== "physics") return;
    if (!airaRef.current) return;

    const now = performance.now();
    if (now - lastSampleRef.current < 1000 / SAMPLE_HZ) return;
    lastSampleRef.current = now;

    // Snapshot every part using fixed index mapping
    const parts = airaRef.current.allParts || [];
    const bodies = {};
    let pelvisY = 1;
    parts.forEach((ref, i) => {
      const r = ref?.current;
      if (!r) return;
      const name = PART_NAMES[i];
      if (!name) return;
      const t = r.translation();
      const q = r.rotation();
      bodies[name] = [
        +t.x.toFixed(3), +t.y.toFixed(3), +t.z.toFixed(3),
        +q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3), +q.w.toFixed(3),
      ];
      if (name === "aira-pelvis") pelvisY = t.y;
    });
    const frame = { t: now, bodies };

    if (recordingPostFall) {
      // Continue capturing post-fall frames
      postBufferRef.current.push(frame);
      if (now >= postFallEndsAt && postFallEndsAt > 0) {
        // Finalize clip
        const fallsBuffer = state.fallsBuffer;
        const recorder = state.recorder;
        const curriculum = state.curriculum;
        const allFrames = [...fallsBuffer, ...postBufferRef.current];
        const baseT = allFrames[0]?.t || now;
        const normalized = allFrames.map((f) => ({ t: (f.t - baseT) / 1000, bodies: f.bodies }));
        const durationSec = (allFrames[allFrames.length - 1]?.t - baseT) / 1000;
        const id = `clip-${Date.now()}`;
        useSimStore.getState().finalizeClip({
          id,
          name: `Fall #${id.slice(-4)}`,
          dateISO: new Date().toISOString(),
          peakForce: +recorder.peakForce.toFixed(1),
          durationSec: +durationSec.toFixed(2),
          frameCount: normalized.length,
          level: recorder.levelHint || (curriculum.enabled ? `L${curriculum.levelIdx + 1}` : "free"),
          frames: normalized,
        });
        postBufferRef.current = [];
        peakForceRef.current = 0;
      }
    } else {
      // Append to rolling pre-fall buffer
      useSimStore.getState().appendBuffer(frame);

      const contacts = state.senses.contacts;
      const recentForce = contacts.length > 0 ? Math.max(...contacts.slice(0, 3).map((c) => c.force)) : 0;
      if (recentForce > peakForceRef.current) peakForceRef.current = recentForce;

      const fallByY = pelvisY < FALL_Y_THRESHOLD;
      const fallByForce = recentForce > FALL_FORCE_THRESHOLD;
      if (fallByY || fallByForce) {
        useSimStore.getState().armFall(
          peakForceRef.current,
          state.curriculum.enabled ? `L${state.curriculum.levelIdx + 1}` : "free"
        );
      }
    }
  });

  return null;
}
