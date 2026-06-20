import { useEffect, useRef } from "react";
import { useSimStore } from "@/store/simStore";
import { useDraggable } from "@/hooks/useDraggable";
import { Brain, X, Eraser, Eye, Ear, Hand, Footprints, Zap, GraduationCap, Move } from "lucide-react";

/**
 * AIThinkingPanel — live ringbuffer of Aira's "internal monologue".
 *
 * Each thought is one of:
 *   • sense  — "I see / I feel / I hear"
 *   • decide — "next action: walk to target"
 *   • act    — "applying jump impulse"
 *   • reflex — automatic safety reactions (fall recovery, etc.)
 *   • learn  — milestone / success learnings
 *
 * The AiController, CurriculumDirector, and FallRecorder push thoughts here.
 * This panel auto-scrolls to the newest entry and color-codes by kind.
 */
const KIND_META = {
  sense:  { color: "#00d4ff", label: "SENSE",  Icon: Eye },
  decide: { color: "#FFEA00", label: "DECIDE", Icon: Brain },
  act:    { color: "#ff9900", label: "ACT",    Icon: Hand },
  reflex: { color: "#ff3366", label: "REFLEX", Icon: Zap },
  learn:  { color: "#00ff88", label: "LEARN",  Icon: GraduationCap },
  audio:  { color: "#A78BFA", label: "AUDIO",  Icon: Ear },
  motor:  { color: "#ff6666", label: "MOTOR",  Icon: Footprints },
};

export default function AIThinkingPanel() {
  const open = useSimStore((s) => s.aiThinkingPanelOpen);
  const toggle = useSimStore((s) => s.toggleAiThinkingPanel);
  const thoughts = useSimStore((s) => s.aiThoughts);
  const clear = useSimStore((s) => s.clearThoughts);
  const listRef = useRef(null);

  // Drag state — buttons & panels share the same translate so the panel
  // opens where the button was, and the button returns where the panel was.
  const btnDrag = useDraggable("aiThinking-btn");
  const panelDrag = useDraggable("aiThinking-panel");

  // Auto-scroll to top (new thought)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [thoughts]);

  if (!open) {
    return (
      <button
        data-testid="open-ai-thinking-panel-btn"
        onClick={btnDrag.guardClick(toggle)}
        {...btnDrag.handleProps}
        style={{ ...btnDrag.handleProps.style, ...btnDrag.style }}
        className="pointer-events-auto fixed bottom-5 left-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#FFEA00] border-[#FFEA00]/40 hover:bg-white/5 select-none"
      >
        <Brain className="w-3.5 h-3.5" />
        AI Thinking
        {thoughts.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#FFEA00]/20 text-[#FFEA00] font-mono text-[9px]">
            {thoughts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      data-testid="ai-thinking-panel"
      style={panelDrag.style}
      className="pointer-events-auto fixed bottom-5 left-5 z-30 w-[360px] max-h-[42vh] glass rounded-xl p-4 flex flex-col gap-3"
    >
      <header
        {...panelDrag.handleProps}
        className="flex items-center justify-between border-b border-white/10 pb-2 select-none"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3 h-3 text-zinc-500" />
          <Brain className="w-4 h-4 text-[#FFEA00]" />
          <span className="heading text-base font-black tracking-tight">AI THINKING</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">stream</span>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            data-testid="clear-ai-thoughts-btn"
            onClick={clear}
            className="text-zinc-400 hover:text-white p-1"
            title="Clear"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button onClick={toggle} data-testid="close-ai-thinking-panel-btn" className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 flex flex-col gap-1.5 overflow-y-auto scroll-thin pr-1"
        data-testid="ai-thoughts-list"
      >
        {thoughts.length === 0 ? (
          <div className="text-[10px] font-mono text-zinc-500 py-6 text-center">
            no thoughts yet — set a goal or click play on a motion
          </div>
        ) : (
          thoughts.map((th) => {
            const meta = KIND_META[th.kind] || KIND_META.sense;
            const Icon = meta.Icon;
            return (
              <div
                key={th.id}
                className="flex items-start gap-2 bg-black/30 border-l-2 rounded px-2 py-1.5 animate-thought-in"
                style={{ borderLeftColor: meta.color }}
              >
                <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[8px] font-mono uppercase tracking-[0.22em] font-bold"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-600">
                      {formatTime(th.t)}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-mono text-white/90 leading-relaxed break-words">
                    {th.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function formatTime(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
