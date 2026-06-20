import { useSimStore } from "@/store/simStore";
import { Slider } from "@/components/ui/slider";
import { JOINT_LIMITS } from "@/sim/anatomy";
import { X, RotateCcw, Hand } from "lucide-react";

/**
 * JointPanel — left-floating panel of sliders to manually pose Aira.
 * Useful for testing the articulation system & sensors. Each slider is
 * clamped client-side to the JOINT_LIMITS in anatomy.js so the user can't
 * exceed human range of motion.
 */
const JOINT_GROUPS = [
  ["Head & Spine", ["head", "spine"]],
  ["Arms", ["lShoulder", "rShoulder", "lElbow", "rElbow"]],
  ["Hands", ["lWrist", "rWrist", "lFingers", "rFingers"]],
  ["Legs", ["lHip", "rHip", "lKnee", "rKnee"]],
];

export default function JointPanel() {
  const open = useSimStore((s) => s.jointPanelOpen);
  const toggle = useSimStore((s) => s.toggleJointPanel);
  const joints = useSimStore((s) => s.joints);
  const setJoint = useSimStore((s) => s.setJoint);
  const resetJoints = useSimStore((s) => s.resetJoints);

  if (!open) {
    return (
      <button
        data-testid="open-joint-panel-btn"
        onClick={toggle}
        className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-white hover:bg-white/5"
      >
        <Hand className="w-3.5 h-3.5" /> Manual Posing
      </button>
    );
  }

  return (
    <aside
      data-testid="joint-panel"
      className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[420px] max-h-[60vh] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Hand className="w-3.5 h-3.5 text-white" />
          <span className="heading text-sm font-black tracking-tight">MANUAL POSING</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="reset-joints-btn"
            onClick={resetJoints}
            className="text-zinc-400 hover:text-white text-[9px] uppercase tracking-[0.22em] flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button
            data-testid="close-joint-panel-btn"
            onClick={toggle}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="text-[9px] font-mono text-zinc-500 leading-relaxed">
        Each slider is clamped to anatomical limits (see <code className="text-zinc-300">/sim/anatomy.js</code>). Aira&apos;s body will fight back against unnatural poses while walking.
      </div>

      {JOINT_GROUPS.map(([title, names]) => (
        <section key={title} className="flex flex-col gap-2">
          <div className="label-xs">{title}</div>
          {names.map((n) => {
            const limit = JOINT_LIMITS[n] || {};
            const vals = joints[n] || {};
            return (
              <div key={n} className="bg-black/30 border border-white/5 rounded px-2 py-2 flex flex-col gap-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white">{n}</div>
                {Object.entries(limit).map(([axis, range]) => (
                  <SliderRow
                    key={axis}
                    label={axis}
                    value={vals[axis] || 0}
                    min={range[0]}
                    max={range[1]}
                    onChange={(v) => setJoint(n, axis, v)}
                    testid={`joint-slider-${n}-${axis}`}
                  />
                ))}
              </div>
            );
          })}
        </section>
      ))}
    </aside>
  );
}

function SliderRow({ label, value, min, max, onChange, testid }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] uppercase tracking-[0.22em] text-zinc-500 w-12">{label}</span>
      <Slider
        data-testid={testid}
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0])}
        className="flex-1"
      />
      <span className="font-mono text-[10px] text-[#00ff88] w-12 text-right">{Math.round(value)}°</span>
    </div>
  );
}
