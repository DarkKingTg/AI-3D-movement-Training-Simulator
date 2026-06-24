import { useSimStore } from "@/store/simStore";
import { useDraggable } from "@/hooks/useDraggable";
import { Activity, BrainCircuit, HeartPulse, Move, Sparkles, X, Zap } from "lucide-react";

const MOOD_COLOR = {
  focused: "#00d4ff",
  curious: "#A78BFA",
  motivated: "#00ff88",
  proud: "#FFEA00",
  anxious: "#ff9900",
  startled: "#ff6666",
  hurt: "#FF3366",
  guarded: "#ff6699",
  tired: "#8b9bb4",
};

export default function AiraInnerStatePanel() {
  const open = useSimStore((s) => s.airaInnerPanelOpen);
  const toggle = useSimStore((s) => s.toggleAiraInnerPanel);
  const inner = useSimStore((s) => s.airaInnerState);
  const btnDrag = useDraggable("airaInner-btn");
  const panelDrag = useDraggable("airaInner-panel");
  const moodColor = MOOD_COLOR[inner.mood] || "#00d4ff";

  if (!open) {
    return (
      <button
        data-testid="open-aira-inner-panel-btn"
        onClick={btnDrag.guardClick(toggle)}
        {...btnDrag.handleProps}
        style={{ ...btnDrag.handleProps.style, ...btnDrag.style }}
        className="pointer-events-auto fixed top-[148px] right-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#00d4ff] border-[#00d4ff]/40 hover:bg-white/5 select-none"
      >
        <HeartPulse className="w-3.5 h-3.5" />
        Inner State
      </button>
    );
  }

  return (
    <aside
      data-testid="aira-inner-panel"
      style={panelDrag.style}
      className="pointer-events-auto fixed top-[148px] right-5 z-30 w-[440px] max-h-[calc(100vh-190px)] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header
        {...panelDrag.handleProps}
        className="flex items-center justify-between border-b border-white/10 pb-2 select-none"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3 h-3 text-zinc-500" />
          <HeartPulse className="w-4 h-4" style={{ color: moodColor }} />
          <span className="heading text-base font-black tracking-tight">INNER STATE</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">Aira affect</span>
        </div>
        <button onClick={toggle} data-testid="close-aira-inner-panel-btn" className="text-zinc-400 hover:text-white" onPointerDown={(e) => e.stopPropagation()}>
          <X className="w-4 h-4" />
        </button>
      </header>

      <section className="grid grid-cols-[120px_1fr] gap-3 items-stretch">
        <div className="bg-black/45 border rounded-lg p-3 flex flex-col items-center justify-center" style={{ borderColor: `${moodColor}66` }}>
          <div className="relative w-20 h-20 rounded-full border flex items-center justify-center" style={{ borderColor: moodColor, boxShadow: `0 0 ${18 + inner.arousal * 24}px ${moodColor}44` }}>
            <BrainCircuit className="w-8 h-8" style={{ color: moodColor }} />
            <div className="absolute inset-2 rounded-full border border-white/10" />
          </div>
          <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: moodColor }}>{inner.mood}</div>
          <div className="text-[8px] font-mono text-zinc-500">mood state</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Signal label="Valence" value={inner.valence} color="#00ff88" />
          <Signal label="Arousal" value={inner.arousal} color="#FFEA00" />
          <Signal label="Stress" value={inner.stress} color="#ff9900" />
          <Signal label="Pain Load" value={inner.pain} color="#FF3366" />
          <Signal label="Confidence" value={inner.confidence} color="#00d4ff" />
          <Signal label="Fatigue" value={inner.fatigue} color="#8b9bb4" />
        </div>
      </section>

      <section>
        <div className="label-xs flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3 h-3" /> Hormone-like Modulators
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Signal label="Dopamine / reward drive" value={inner.hormones?.dopamine} color="#00ff88" />
          <Signal label="Cortisol / stress load" value={inner.hormones?.cortisol} color="#ff9900" />
          <Signal label="Adrenaline / readiness" value={inner.hormones?.adrenaline} color="#FFEA00" />
          <Signal label="Oxytocin / trust bond" value={inner.hormones?.oxytocin} color="#A78BFA" />
          <Signal label="Endorphin / pain buffer" value={inner.hormones?.endorphin} color="#ff6699" />
        </div>
      </section>

      <section>
        <div className="label-xs flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3" /> Active Drivers
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(inner.drivers || []).length === 0 && (
            <span className="text-[9px] font-mono text-zinc-500 bg-black/35 border border-white/5 rounded px-2 py-1">steady baseline</span>
          )}
          {(inner.drivers || []).map((driver) => (
            <span key={driver} className="text-[9px] font-mono text-zinc-300 bg-black/35 border border-white/10 rounded px-2 py-1">
              {driver}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="label-xs flex items-center gap-1.5 mb-2">
          <Activity className="w-3 h-3" /> Recent State Changes
        </div>
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto scroll-thin">
          {(inner.timeline || []).slice(0, 8).map((row) => (
            <div key={row.t} className="grid grid-cols-[54px_72px_1fr] gap-2 items-center text-[9px] font-mono bg-black/35 border border-white/5 rounded px-2 py-1">
              <span className="text-zinc-500">{formatTime(row.t)}</span>
              <span className="uppercase tracking-[0.16em]" style={{ color: MOOD_COLOR[row.mood] || "#fff" }}>{row.mood}</span>
              <span className="text-zinc-400">stress {pct(row.stress)} · pain {pct(row.pain)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="text-[9px] font-mono text-zinc-500 leading-relaxed">
        These values are simulated training modulators derived from reward, body stress, injuries, and lessons.
      </div>
    </aside>
  );
}

function Signal({ label, value = 0, color }) {
  const safe = Math.max(0, Math.min(1, Number(value) || 0));
  return (
    <div className="bg-black/40 border border-white/5 rounded px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-400">{label}</span>
        <span className="text-[9px] font-mono font-bold" style={{ color }}>{pct(safe)}</span>
      </div>
      <div className="mt-1 h-1 bg-white/5 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${safe * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function pct(v) {
  return `${Math.round((Number(v) || 0) * 100)}%`;
}

function formatTime(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
