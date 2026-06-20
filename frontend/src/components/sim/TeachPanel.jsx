import { useSimStore } from "@/store/simStore";
import { MOTION_LIST, MOTIONS } from "@/sim/motionLibrary";
import { Slider } from "@/components/ui/slider";
import {
  Play, Square, GraduationCap, X, User, Footprints, Wind, ArrowUp,
  HandMetal, Armchair, Move, ChevronsDown,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ICONS = { User, Footprints, Wind, ArrowUp, HandMetal, Armchair, Move, ChevronsDown };

/**
 * TeachPanel — Browse the motion library and play clips on Aira to teach her
 * canonical human motor patterns: walk, run, jump, wave, sit, reach, squat.
 *
 * While a motion plays, MotionPlayer drives her joints from the keyframes →
 * JointDriver clamps and applies them → the AI Input Feed shows the resulting
 * joint angles, head orientation, and vision the AI agent would receive while
 * mimicking the demonstration.
 */
export default function TeachPanel() {
  const teaching = useSimStore((s) => s.teaching);
  const playMotion = useSimStore((s) => s.playMotion);
  const stopMotion = useSimStore((s) => s.stopMotion);
  const setMotionSpeed = useSimStore((s) => s.setMotionSpeed);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        data-testid="open-teach-panel-btn"
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed top-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#FFEA00] border-[#FFEA00]/40 hover:bg-white/5"
      >
        <GraduationCap className="w-3.5 h-3.5" /> Teach Aira
        {teaching.playing && (
          <span className="ml-1 inline-block w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        )}
      </button>
    );
  }

  const activeMotion = teaching.activeMotion ? MOTIONS[teaching.activeMotion] : null;

  return (
    <aside
      data-testid="teach-panel"
      className="pointer-events-auto fixed top-24 left-1/2 -translate-x-1/2 z-30 w-[640px] max-h-[70vh] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[#FFEA00]" />
          <span className="heading text-base font-black tracking-tight">TEACH AIRA</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">motion library · {MOTION_LIST.length} clips</span>
        </div>
        <button
          data-testid="close-teach-panel-btn"
          onClick={() => setOpen(false)}
          className="text-zinc-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="text-[10px] font-mono text-zinc-400 leading-relaxed">
        Play a demonstration clip → its keyframes drive Aira&apos;s joints in real time. JointDriver clamps each pose to anatomical limits. The AI Input Feed simultaneously logs the resulting joint angles, head orientation and vision frames — exactly what an AI agent would see while learning to mimic the motion.
      </div>

      {/* Grid of motion clips */}
      <div className="grid grid-cols-2 gap-2">
        {MOTION_LIST.map((m) => {
          const Icon = ICONS[m.icon] || User;
          const isActive = teaching.activeMotion === m.id && teaching.playing;
          return (
            <button
              key={m.id}
              data-testid={`motion-${m.id}-btn`}
              onClick={() => {
                if (isActive) stopMotion();
                else { playMotion(m.id, teaching.speed); toast(`Demonstrating: ${m.label}`); }
              }}
              className={`flex items-start gap-3 text-left rounded-lg p-3 border transition-colors ${
                isActive
                  ? "bg-[#FFEA00]/10 border-[#FFEA00]/60"
                  : "bg-black/30 border-white/10 hover:border-white/30"
              }`}
            >
              <Icon className={`w-5 h-5 mt-0.5 ${isActive ? "text-[#FFEA00]" : "text-white"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold tracking-tight ${isActive ? "text-[#FFEA00]" : "text-white"}`}>
                    {m.label}
                  </span>
                  {isActive && <Play className="w-2.5 h-2.5 text-[#00ff88] animate-pulse" />}
                  {m.loop && <span className="text-[8px] font-mono uppercase tracking-[0.22em] text-zinc-500">loop</span>}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 leading-snug mt-0.5 line-clamp-2">
                  {m.description}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-zinc-500">
                  <span>{m.duration.toFixed(1)}s</span>
                  <span>·</span>
                  <span>{m.keyframes.length} keyframes</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active controls */}
      {activeMotion && teaching.playing && (
        <div className="bg-black/40 border border-[#FFEA00]/40 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-white">Playing</span>
              <span className="font-mono text-xs text-[#FFEA00]">{activeMotion.label}</span>
            </div>
            <span className="font-mono text-[10px] text-[#00ff88]">
              t = {teaching.time.toFixed(2)}s / {activeMotion.keyframes[activeMotion.keyframes.length - 1].t.toFixed(2)}s
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-400 w-12">Speed</span>
            <Slider
              data-testid="motion-speed-slider"
              value={[teaching.speed]}
              min={0.25}
              max={2.0}
              step={0.05}
              onValueChange={(v) => setMotionSpeed(v[0])}
              className="flex-1"
            />
            <span className="font-mono text-[10px] text-white w-10 text-right">{teaching.speed.toFixed(2)}×</span>
          </div>
          <button
            data-testid="stop-motion-btn"
            onClick={() => { stopMotion(); toast("Demonstration paused"); }}
            className="flex items-center justify-center gap-1.5 bg-[#FF0000]/15 border border-[#FF0000]/40 text-[#FF6666] text-[10px] uppercase tracking-[0.22em] py-1.5 rounded font-bold hover:bg-[#FF0000]/25"
          >
            <Square className="w-3 h-3" /> Stop Demonstration
          </button>
        </div>
      )}
    </aside>
  );
}
