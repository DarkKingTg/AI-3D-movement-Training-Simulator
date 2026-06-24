import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useSimStore } from "@/store/simStore";
import { appendInnerTimeline, deriveAiraInnerState } from "@/sim/airaInnerState";

export default function AiraInnerStateMonitor() {
  const accumRef = useRef(0);

  useFrame((_, delta) => {
    accumRef.current += delta;
    if (accumRef.current < 0.25) return;
    accumRef.current = 0;

    const state = useSimStore.getState();
    const snapshot = deriveAiraInnerState(state, state.airaInnerState);
    const timeline = appendInnerTimeline(state.airaInnerState, snapshot);
    state.updateAiraInnerState({ ...snapshot, timeline });
  });

  return null;
}
