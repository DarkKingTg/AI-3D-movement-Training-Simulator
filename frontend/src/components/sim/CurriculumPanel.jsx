import { useSimStore } from "@/store/simStore";
import { CURRICULUM } from "@/sim/curriculum";
import { Trophy, Play, Square, Share2, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const fmt = (s) => {
  if (!s || s <= 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(2).padStart(5, "0");
  return `${m.toString().padStart(2, "0")}:${sec}`;
};

export default function CurriculumPanel() {
  const c = useSimStore((s) => s.curriculum);
  const startCurriculum = useSimStore((s) => s.startCurriculum);
  const stopCurriculum = useSimStore((s) => s.stopCurriculum);
  const setLevelIdx = useSimStore((s) => s.setLevelIdx);

  const level = CURRICULUM[c.levelIdx] || CURRICULUM[0];
  const best = c.bestTimes[level.id];
  const isPB = c.lapTimer > 0 && best && Math.abs(c.lapTimer - best) < 0.01;
  const totalBest = Object.values(c.bestTimes).reduce((a, b) => a + b, 0);

  const handleShare = async () => {
    const lines = [
      "🏃 Aira's Training Mission",
      `Level ${c.levelIdx + 1}/${CURRICULUM.length}: ${level.name}`,
      `Laps completed: ${c.totalLapsCompleted}`,
      "",
      "Best times per level:",
      ...CURRICULUM.map((lv) => `  L${lv.id} ${lv.name}: ${c.bestTimes[lv.id] ? fmt(c.bestTimes[lv.id]) : "—"}`),
      "",
      `Total: ${totalBest > 0 ? fmt(totalBest) : "—"}`,
      "→ aira-motion-lab",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success("Mission report copied to clipboard");
    } catch {
      toast("Could not copy — clipboard unavailable");
    }
  };

  return (
    <section
      data-testid="curriculum-panel"
      className="bg-gradient-to-br from-[#002FA7]/15 to-transparent border border-[#002FA7]/40 rounded-xl p-4 flex flex-col gap-3"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-[#FFEA00]" />
          <span className="heading text-sm font-black tracking-tight">CURRICULUM</span>
        </div>
        {c.enabled ? (
          <button
            data-testid="stop-curriculum-btn"
            onClick={() => { stopCurriculum(); toast("Curriculum paused"); }}
            className="flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] bg-[#FF0000]/15 border border-[#FF0000]/40 text-[#FF6666] px-2 py-1 rounded hover:bg-[#FF0000]/25"
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        ) : (
          <button
            data-testid="start-curriculum-btn"
            onClick={() => { startCurriculum(); toast.success("Mission started"); }}
            className="flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88] px-2 py-1 rounded hover:bg-[#00ff88]/25 font-bold"
          >
            <Play className="w-3 h-3" /> Start Mission
          </button>
        )}
      </header>

      {/* Level info */}
      <div className="bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">Level {c.levelIdx + 1}/{CURRICULUM.length}</span>
          {best && <span className="text-[9px] font-mono text-[#FFEA00]">PB {fmt(best)}</span>}
        </div>
        <div className="font-bold text-white text-sm tracking-tight">{level.name}</div>
        <div className="text-[10px] font-mono text-zinc-400 leading-relaxed">{level.description}</div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[9px] font-mono">
          <div className="text-zinc-500">target_dist: <span className="text-[#00ff88]">{level.targetDist}m</span></div>
          <div className="text-zinc-500">par_time: <span className="text-[#00ff88]">{level.parTime}s</span></div>
        </div>
      </div>

      {/* Live lap timer */}
      <div className="bg-black/60 border border-[#00ff88]/40 rounded-lg p-3 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-400">Lap Timer</span>
        <span
          data-testid="lap-timer"
          className={`font-mono text-2xl font-black tracking-tight ${isPB ? "text-[#FFEA00] animate-pulse" : "text-[#00ff88]"}`}
        >
          {fmt(c.lapTimer)}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Laps" value={c.totalLapsCompleted} color="#00ff88" testid="curriculum-total-laps" />
        <Stat label="Best Σ" value={totalBest > 0 ? fmt(totalBest) : "—"} color="#FFEA00" testid="curriculum-total-best" />
        <Stat label="Level" value={`${c.levelIdx + 1}/${CURRICULUM.length}`} color="#002FA7" testid="curriculum-level-num" />
      </div>

      {/* Per-level list */}
      <div className="flex flex-col gap-1">
        <div className="label-xs">Personal Bests</div>
        {CURRICULUM.map((lv, i) => (
          <button
            key={lv.id}
            data-testid={`curriculum-level-${lv.id}`}
            onClick={() => setLevelIdx(i)}
            className={`flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
              c.levelIdx === i ? "bg-[#002FA7]/30 border-[#002FA7]" : "bg-black/30 border-white/5 hover:border-white/20"
            }`}
          >
            <span className="text-white uppercase tracking-wider truncate">L{lv.id} · {lv.name}</span>
            <span className={c.bestTimes[lv.id] ? "text-[#FFEA00]" : "text-zinc-600"}>
              {c.bestTimes[lv.id] ? fmt(c.bestTimes[lv.id]) : "—"}
            </span>
          </button>
        ))}
      </div>

      {/* Share */}
      <button
        data-testid="share-mission-btn"
        onClick={handleShare}
        className="flex items-center justify-center gap-2 bg-transparent border border-white/20 hover:bg-white/5 text-white text-[10px] uppercase tracking-[0.22em] py-2 rounded font-bold transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" /> Share Mission Report
      </button>
    </section>
  );
}

function Stat({ label, value, color, testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-black/40 border rounded-md py-1.5 flex flex-col items-center"
      style={{ borderColor: `${color}44` }}
    >
      <div className="font-mono text-xs font-bold" style={{ color }}>{value}</div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}
