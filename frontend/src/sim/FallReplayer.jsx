import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSimStore } from "@/store/simStore";

/**
 * FallReplayer — when a clip is being played back, override the live
 * physics positions/rotations of Aira's bodies with the recorded frames.
 *
 * We don't actually pause physics — we just call `setTranslation` and
 * `setRotation` on each body every frame to warp it back to the recorded
 * pose. This works smoothly even at slow-mo speed and is reversible:
 * stopping playback just stops the override and physics takes over again.
 */
export default function FallReplayer({ airaRef }) {
  const playback = useSimStore((s) => s.playback);
  const clips = useSimStore((s) => s.fallsClips);
  const stopPlayback = useSimStore((s) => s.stopPlayback);
  const setPlaybackFrame = useSimStore((s) => s.setPlaybackFrame);

  const lastFrameTimeRef = useRef(0);

  useFrame((_, delta) => {
    if (!playback.playing || !playback.clipId) return;
    if (!airaRef.current) return;
    const clip = clips.find((c) => c.id === playback.clipId);
    if (!clip || !clip.frames.length) return;

    // Compute current time in clip (scaled by playback speed)
    const elapsed = (performance.now() - playback.startedAt) / 1000 * (playback.speed || 0.5);
    if (elapsed >= clip.durationSec) {
      stopPlayback();
      return;
    }

    // Find frame at this elapsed time (linear search; clips are small)
    let frameIdx = 0;
    for (let i = 0; i < clip.frames.length - 1; i++) {
      if (clip.frames[i + 1].t > elapsed) { frameIdx = i; break; }
    }
    const frame = clip.frames[frameIdx];
    if (!frame) return;

    // Apply each recorded body transform onto the matching live body using
    // fixed index → name mapping (must match AiraRagdollPhysics order).
    const PART_NAMES = [
      "aira-pelvis", "aira-torso", "aira-head",
      "aira-lUpArm", "aira-rUpArm", "aira-lLoArm", "aira-rLoArm",
      "aira-lUpLeg", "aira-rUpLeg", "aira-lLoLeg", "aira-rLoLeg",
    ];
    const parts = airaRef.current.allParts || [];
    parts.forEach((ref, i) => {
      const r = ref?.current;
      if (!r) return;
      const name = PART_NAMES[i];
      const tx = frame.bodies?.[name];
      if (!tx) return;
      r.setTranslation({ x: tx[0], y: tx[1], z: tx[2] }, false);
      r.setRotation({ x: tx[3], y: tx[4], z: tx[5], w: tx[6] }, false);
      r.setLinvel({ x: 0, y: 0, z: 0 }, false);
      r.setAngvel({ x: 0, y: 0, z: 0 }, false);
    });

    // throttle frame index updates (UI scrubber)
    if (performance.now() - lastFrameTimeRef.current > 100) {
      lastFrameTimeRef.current = performance.now();
      setPlaybackFrame(frameIdx);
    }
  });

  return null;
}
