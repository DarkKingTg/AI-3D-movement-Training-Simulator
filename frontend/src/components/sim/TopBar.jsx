import { useSimStore } from "@/store/simStore";
import { Play, Pause, RotateCcw, Eye, Crosshair, Box as BoxIcon, Activity } from "lucide-react";
import { SIM } from "@/constants/testIds";

export default function TopBar() {
  const paused = useSimStore((s) => s.paused);
  const togglePause = useSimStore((s) => s.togglePause);
  const resetAira = useSimStore((s) => s.resetAira);
  const cameraMode = useSimStore((s) => s.cameraMode);
  const setCameraMode = useSimStore((s) => s.setCameraMode);
  const ragdollMode = useSimStore((s) => s.ragdoll.mode);
  const setRagdollMode = useSimStore((s) => s.setRagdollMode);
  const pelvisLocked = useSimStore((s) => s.ragdoll.pelvisLocked);
  const setPelvisLocked = useSimStore((s) => s.setPelvisLocked);

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
        {/* Ragdoll mode toggle group */}
        <div className="flex items-center gap-1 mr-2 px-2 py-1 rounded border border-white/10 bg-black/40">
          <Activity className="w-3 h-3 text-zinc-400" />
          <button
            data-testid="ragdoll-kinematic-btn"
            onClick={() => setRagdollMode("kinematic")}
            className={`text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded transition-colors ${
              ragdollMode === "kinematic" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Kinematic
          </button>
          <button
            data-testid="ragdoll-physics-btn"
            onClick={() => setRagdollMode("physics")}
            className={`text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded transition-colors ${
              ragdollMode === "physics" ? "bg-[#FFEA00] text-black font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Physics
          </button>
          {ragdollMode === "physics" && (
            <button
              data-testid="pelvis-lock-btn"
              onClick={() => setPelvisLocked(!pelvisLocked)}
              className={`text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded ml-1 border transition-colors ${
                pelvisLocked
                  ? "border-[#00ff88]/40 text-[#00ff88]"
                  : "border-[#FF0000]/40 text-[#FF6666]"
              }`}
              title={pelvisLocked ? "Pelvis stable — Aira stays upright" : "Full ragdoll — Aira will collapse"}
            >
              {pelvisLocked ? "Upright" : "Ragdoll!"}
            </button>
          )}
        </div>

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
