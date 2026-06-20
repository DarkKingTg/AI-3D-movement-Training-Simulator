import { Suspense, useEffect, useRef } from "react";
import SimulationCanvas from "@/sim/SimulationCanvas";
import LeftSidebar from "@/components/sim/LeftSidebar";
import RightSidebar from "@/components/sim/RightSidebar";
import TopBar from "@/components/sim/TopBar";
import SensorPanel from "@/components/sim/SensorPanel";
import JointPanel from "@/components/sim/JointPanel";
import TeachPanel from "@/components/sim/TeachPanel";
import FallsPanel from "@/components/sim/FallsPanel";
import AvatarPanel from "@/components/sim/AvatarPanel";
import { Toaster } from "@/components/ui/sonner";
import { useSimStore } from "@/store/simStore";

export default function Simulation() {
  const setGoal = useSimStore((s) => s.setGoal);
  const objects = useSimStore((s) => s.objects);
  const spawnObject = useSimStore((s) => s.spawnObject);

  // First-load: seed a target so the user sees something immediately if scene is empty
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (objects.length === 0) {
      seededRef.current = true;
      spawnObject("target", { position: [4, 0, 0] });
      spawnObject("light", { position: [-3, 1.2, 3] });
    } else {
      seededRef.current = true;
    }
  }, [objects.length, spawnObject]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black no-select">
      <Suspense fallback={<LoadingScreen />}>
        <SimulationCanvas />
      </Suspense>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 p-5 flex flex-col gap-5">
        <TopBar />

        <div className="flex-1 flex justify-between items-start gap-5 min-h-0">
          <LeftSidebar />
          <CenterHint />
          <RightSidebar />
        </div>
      </div>

      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(10,10,10,0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 12,
            letterSpacing: "0.04em",
          },
        }}
      />

      {/* Floating sensor + manual-pose + teach + falls panels */}
      <SensorPanel />
      <JointPanel />
      <TeachPanel />
      <FallsPanel />
      <AvatarPanel />
    </div>
  );
}

function CenterHint() {
  return (
    <div className="flex-1 flex justify-center items-end self-end pb-2 pointer-events-none">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 text-center">
        drag scene to orbit · scroll to zoom · spawn objects to set goals
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-2 border-white/20 border-t-[#00ff88] rounded-full animate-spin" />
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
          loading physics engine
        </div>
      </div>
    </div>
  );
}
