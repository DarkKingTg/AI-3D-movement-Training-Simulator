import { useEffect, useRef, useState } from "react";
import { useSimStore } from "@/store/simStore";
import { intensity, flow, STAGES } from "@/sim/pipelineState";
import { Workflow, X, Eye, Compass, Hand, Brain, Cog, Wind, User } from "lucide-react";

/**
 * PipelinePanel — Live visualization of Aira's perception → cognition →
 * action data flow. Reads from the module-level `pipelineState` ringbuffer
 * (bypassing zustand for 60-Hz pulses) and re-renders at 30 fps via RAF.
 *
 * Each stage's "intensity" decays from 1.0 → 0.0 over 600 ms after the last
 * pulse, mapped to halo size + color saturation. Arrows between stages
 * animate when both endpoints are active.
 *
 * Pipeline graph:
 *   VISION ─┐
 *   IMU   ─┼─► SENSES ─► BRAIN ─► MOTOR ─► PHYSICS ─► BODY
 *   CONTACTS┘                                ▲          │
 *                                            └──────────┘ (feedback loop)
 */

const NODES = [
  { id: "vision",   x: 24,  y: 38,  label: "VISION",   Icon: Eye,     desc: "96×72×100° eye view" },
  { id: "imu",      x: 24,  y: 96,  label: "IMU",      Icon: Compass, desc: "head + pelvis YPR" },
  { id: "contacts", x: 24,  y: 154, label: "CONTACTS", Icon: Hand,    desc: "per-body impact force" },
  { id: "senses",   x: 150, y: 96,  label: "SENSES",   Icon: Workflow,desc: "fused observation" },
  { id: "brain",    x: 250, y: 96,  label: "BRAIN",    Icon: Brain,   desc: "AiController policy" },
  { id: "motor",    x: 350, y: 96,  label: "MOTOR",    Icon: Cog,     desc: "joint motors / impulses" },
  { id: "physics",  x: 450, y: 96,  label: "PHYSICS",  Icon: Wind,    desc: "Rapier integration" },
  { id: "body",     x: 550, y: 96,  label: "BODY",     Icon: User,    desc: "world transforms" },
];

const EDGES = [
  ["vision",   "senses"],
  ["imu",      "senses"],
  ["contacts", "senses"],
  ["senses",   "brain"],
  ["brain",    "motor"],
  ["motor",    "physics"],
  ["physics",  "body"],
  ["body",     "vision"],   // closed loop: body movement creates new visual data
];

const COLOR = {
  vision:   "#00d4ff",
  imu:      "#00ff88",
  contacts: "#ff3366",
  senses:   "#A78BFA",
  brain:    "#FFEA00",
  motor:    "#ff9900",
  physics:  "#ff6666",
  body:     "#ffffff",
};

export default function PipelinePanel() {
  const open = useSimStore((s) => s.pipelinePanelOpen);
  const toggle = useSimStore((s) => s.togglePipelinePanel);

  // Local 30 fps "tick" so we re-read module-level intensities each frame.
  const [tick, setTick] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (!open) return undefined;
    let last = 0;
    const loop = (t) => {
      if (t - last > 33) { // ~30 fps
        last = t;
        setTick((n) => (n + 1) & 0xffff);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

  if (!open) {
    return (
      <button
        data-testid="open-pipeline-panel-btn"
        onClick={toggle}
        className="pointer-events-auto fixed top-24 right-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#A78BFA] border-[#A78BFA]/40 hover:bg-white/5"
      >
        <Workflow className="w-3.5 h-3.5" />
        Pipeline
      </button>
    );
  }

  // Read live intensities (0..1) from module state
  const intens = {};
  for (const s of STAGES) intens[s] = intensity(s);

  // Compute SVG path data for edges + active animation state
  const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <aside
      data-testid="pipeline-panel"
      className="pointer-events-auto fixed top-24 right-5 z-30 w-[640px] glass rounded-xl p-4 flex flex-col gap-3"
    >
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-[#A78BFA]" />
          <span className="heading text-base font-black tracking-tight">PIPELINE</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">perception → action</span>
        </div>
        <button onClick={toggle} data-testid="close-pipeline-panel-btn" className="text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="bg-black/40 border border-white/10 rounded-lg p-3 overflow-hidden">
        <svg
          viewBox="0 0 620 200"
          width="100%"
          height="200"
          data-testid="pipeline-svg"
          style={{ display: "block" }}
        >
          {/* Edges */}
          {EDGES.map(([a, b], i) => {
            const fa = nodeById[a];
            const fb = nodeById[b];
            const aActive = intens[a] > 0.05;
            const bActive = intens[b] > 0.05;
            const edgeActive = aActive && bActive;
            // For body→vision feedback edge, curve under
            const isFeedback = a === "body" && b === "vision";
            const d = isFeedback
              ? `M ${fa.x} ${fa.y + 22} Q ${(fa.x + fb.x) / 2} 195, ${fb.x} ${fb.y + 22}`
              : `M ${fa.x + 22} ${fa.y} L ${fb.x - 22} ${fb.y}`;
            return (
              <g key={i}>
                <path
                  d={d}
                  stroke={edgeActive ? COLOR[a] : "rgba(255,255,255,0.10)"}
                  strokeWidth={edgeActive ? 1.5 : 1}
                  fill="none"
                  opacity={edgeActive ? Math.max(0.4, intens[a]) : 0.5}
                  style={{ transition: "stroke 0.15s, opacity 0.15s" }}
                />
                {edgeActive && (
                  <PacketAlongPath d={d} color={COLOR[a]} duration={1.4 + i * 0.07} />
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map((n) => {
            const it = intens[n.id];
            const c = COLOR[n.id];
            const haloR = 22 + it * 18;
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} data-testid={`pipeline-node-${n.id}`}>
                {/* Halo */}
                <circle r={haloR} fill={c} opacity={it * 0.22} style={{ transition: "opacity 0.1s, r 0.1s" }} />
                {/* Body */}
                <circle r={22} fill="rgba(10,10,15,0.95)" stroke={c} strokeWidth={it > 0.05 ? 2 : 1} opacity={1} />
                {/* Pulse ring on activation */}
                {it > 0.5 && (
                  <circle r={22} fill="none" stroke={c} strokeWidth={1.2}>
                    <animate attributeName="r" from={22} to={44} dur="0.6s" repeatCount="1" />
                    <animate attributeName="opacity" from={0.8} to={0} dur="0.6s" repeatCount="1" />
                  </circle>
                )}
                {/* Label */}
                <text
                  y={40}
                  textAnchor="middle"
                  fill={c}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="2"
                  fontWeight="700"
                >
                  {n.label}
                </text>
                {/* Icon */}
                <foreignObject x={-7} y={-7} width="14" height="14" style={{ pointerEvents: "none" }}>
                  <n.Icon width={14} height={14} color={c} />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stage detail grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {NODES.map((n) => {
          const it = intens[n.id];
          const c = COLOR[n.id];
          const f = flow(n.id);
          return (
            <div
              key={n.id}
              className="bg-black/40 border rounded px-2 py-1.5"
              style={{
                borderColor: it > 0.05 ? c : "rgba(255,255,255,0.08)",
                transition: "border-color 0.15s",
              }}
              data-testid={`pipeline-stage-${n.id}`}
            >
              <div className="flex items-center gap-1">
                <n.Icon className="w-3 h-3" style={{ color: c }} />
                <span className="text-[8px] font-mono uppercase tracking-[0.22em] font-bold" style={{ color: c }}>
                  {n.label}
                </span>
              </div>
              <div className="text-[8px] font-mono text-zinc-500">{n.desc}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[8px] font-mono text-zinc-400">flow:</span>
                <span className="text-[9px] font-mono font-bold" style={{ color: it > 0.05 ? c : "#666" }}>
                  {f}
                </span>
              </div>
              <div className="mt-1 h-0.5 bg-white/5 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${it * 100}%`, background: c, transition: "width 0.1s" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] font-mono text-zinc-500 leading-relaxed">
        Each node pulses when data passes through. Halos decay over 600 ms. Feedback arc closes the
        perception–action loop: body movement → new visual input.
      </div>
    </aside>
  );
}

/**
 * PacketAlongPath — small dot that animates along an SVG path using SMIL
 * animateMotion. Re-created on every parent re-render which restarts the
 * animation, giving a visible flowing-packet effect.
 */
function PacketAlongPath({ d, color, duration = 1.5 }) {
  return (
    <circle r={2.4} fill={color}>
      <animateMotion dur={`${duration}s`} repeatCount="indefinite" path={d} />
    </circle>
  );
}
