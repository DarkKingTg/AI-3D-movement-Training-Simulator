import { useSimStore } from "@/store/simStore";
import { Play, Pause, RotateCcw, Eye, Crosshair, Box as BoxIcon } from "lucide-react";
import { SIM } from "@/constants/testIds";

export default function TopBar() {
  const paused = useSimStore((s) => s.paused);
  const togglePause = useSimStore((s) => s.togglePause);
  const resetAira = useSimStore((s) => s.resetAira);
  const cameraMode = useSimStore((s) => s.cameraMode);
  const setCameraMode = useSimStore((s) => s.setCameraMode);

  const camBtn = (mode, label, Icon, testid) => (
    <button
      data-testid={testid}
      onClick={() => setCameraMode(mode)}
      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] rounded border transition-all ${
        cameraMode === mode
          ? "bg-white text-black border-white font-bold"
          : "bg-transparent border-white/20 text-white/70 hover:border-white hover:text-white"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <header
      data-testid={SIM.topBar}
      className="glass rounded-xl px-5 py-3 flex items-center justify-between gap-6 pointer-events-auto"
    >
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        <div>
          <div className="heading text-base font-black tracking-tight leading-none">AIRA · MOTION LAB</div>
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500 mt-0.5">
            procedural ragdoll training sim · r3f + rapier
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {camBtn("orbit", "Orbit", Eye, SIM.orbitCamBtn)}
        {camBtn("follow", "Follow", Crosshair, SIM.followCamBtn)}
        {camBtn("top", "Top", BoxIcon, SIM.topCamBtn)}

        <div className="w-px h-6 bg-white/15 mx-2" />

        <button
          data-testid={SIM.pauseBtn}
          onClick={togglePause}
          className="flex items-center gap-1.5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-bold bg-[#FFEA00] text-black hover:bg-yellow-300 rounded transition-colors"
        >
          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          data-testid={SIM.resetBtn}
          onClick={resetAira}
          className="flex items-center gap-1.5 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-bold bg-transparent border border-white/30 hover:border-white text-white rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Aira
        </button>
      </div>
    </header>
  );
}
