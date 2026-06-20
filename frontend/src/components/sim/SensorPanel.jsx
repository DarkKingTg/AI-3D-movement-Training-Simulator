import { useSimStore } from "@/store/simStore";
import VisionThumbnail from "@/components/sim/VisionThumbnail";
import { Eye, Hand, Activity, Compass, Crosshair, Database, X, Move } from "lucide-react";
import { useDraggable } from "@/hooks/useDraggable";

/**
 * SensorPanel — bottom-right floating panel showing all live sensory input
 * that would be fed to an AI controller:
 *   - Vision (Aira's eye-view thumbnail)
 *   - IMU (head & pelvis orientation, head linear accel)
 *   - Proprioception (joint angles applied, top 6)
 *   - Contact events (collisions with force)
 *   - Visible objects in FOV (raycast list)
 *   - Distance to current target
 *
 * Also exposes `window.airaAiInput` for external AI code to consume.
 */
export default function SensorPanel() {
  const open = useSimStore((s) => s.sensorPanelOpen);
  const toggle = useSimStore((s) => s.toggleSensorPanel);
  const senses = useSimStore((s) => s.senses);
  const jointsActual = useSimStore((s) => s.jointsActual);
  const stats = useSimStore((s) => s.stats);

  const btnDrag = useDraggable("sensorPanel-btn");
  const panelDrag = useDraggable("sensorPanel-panel");

  // Expose to window for external consumers
  if (typeof window !== "undefined") {
    window.airaAiInput = { senses, jointsActual, stats };
  }

  if (!open) {
    return (
      <button
        data-testid="open-sensor-panel-btn"
        onClick={btnDrag.guardClick(toggle)}
        {...btnDrag.handleProps}
        style={{ ...btnDrag.handleProps.style, ...btnDrag.style }}
        className="pointer-events-auto fixed bottom-5 right-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#00ff88] border-[#00ff88]/40 hover:bg-white/5 select-none"
      >
        <Database className="w-3.5 h-3.5" /> AI Input Feed
      </button>
    );
  }

  // Pick a few proprioception highlights
  const jointEntries = [
    ["head", jointsActual.head],
    ["spine", jointsActual.spine],
    ["lShoulder", jointsActual.lShoulder],
    ["rShoulder", jointsActual.rShoulder],
    ["lElbow", jointsActual.lElbow],
    ["rElbow", jointsActual.rElbow],
    ["lHip", jointsActual.lHip],
    ["rHip", jointsActual.rHip],
    ["lKnee", jointsActual.lKnee],
    ["rKnee", jointsActual.rKnee],
    ["lFingers", jointsActual.lFingers],
    ["rFingers", jointsActual.rFingers],
  ].filter(([, v]) => v);

  return (
    <aside
      data-testid="sensor-panel"
      style={panelDrag.style}
      className="pointer-events-auto fixed bottom-5 right-5 z-30 w-[420px] max-h-[calc(100vh-120px)] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header
        {...panelDrag.handleProps}
        className="flex items-center justify-between border-b border-white/10 pb-2 select-none"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3 h-3 text-zinc-500" />
          <Database className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="heading text-sm font-black tracking-tight">AI INPUT FEED</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">live · {Math.round(stats.attempts)} ep</span>
        </div>
        <button
          data-testid="close-sensor-panel-btn"
          onClick={toggle}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-zinc-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Vision */}
      <section>
        <div className="label-xs flex items-center gap-1.5 mb-1.5">
          <Eye className="w-3 h-3" /> Vision · {senses.visionWidth}×{senses.visionHeight} · {senses.visionFovDeg}° FOV
        </div>
        <VisionThumbnail width={192} height={144} />
        <div className="mt-1 text-[9px] font-mono text-zinc-500">
          frame_id: {senses.visionUpdatedAt} · rgb8 buffer · readable via window.airaAiInput.senses.visionData
        </div>
      </section>

      {/* IMU */}
      <section>
        <div className="label-xs flex items-center gap-1.5 mb-1.5">
          <Compass className="w-3 h-3" /> Inertial (IMU)
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <KV label="head Y/P/R" value={`${senses.imu.headOrientationDeg.yaw}° ${senses.imu.headOrientationDeg.pitch}° ${senses.imu.headOrientationDeg.roll}°`} />
          <KV label="pelvis Y/P/R" value={`${senses.imu.pelvisOrientationDeg.yaw}° ${senses.imu.pelvisOrientationDeg.pitch}° ${senses.imu.pelvisOrientationDeg.roll}°`} />
          <KV label="head accel" value={senses.imu.headAccel.map((n) => n.toFixed(1)).join(",")} />
          <KV label="dist→target" value={`${senses.distanceToTarget} m`} />
        </div>
      </section>

      {/* Proprioception */}
      <section>
        <div className="label-xs flex items-center gap-1.5 mb-1.5">
          <Hand className="w-3 h-3" /> Proprioception · {jointEntries.length} joints
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-[#00ff88]">
          {jointEntries.map(([name, vals]) => (
            <div key={name} data-testid={`joint-actual-${name}`} className="bg-black/40 border border-white/5 rounded px-2 py-1">
              <div className="text-zinc-500 text-[8px] uppercase tracking-[0.22em]">{name}</div>
              <div className="text-white">
                {Object.entries(vals).map(([k, v]) => `${k}:${Math.round(v)}°`).join(" ")}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Visible objects */}
      <section>
        <div className="label-xs flex items-center gap-1.5 mb-1.5">
          <Crosshair className="w-3 h-3" /> Visible objects (in FOV)
        </div>
        <div className="flex flex-col gap-0.5">
          {senses.visibleObjects.length === 0 && (
            <div className="text-[10px] font-mono text-zinc-500">— nothing in view —</div>
          )}
          {senses.visibleObjects.map((o) => (
            <div key={o.id} data-testid={`visible-obj-${o.id}`} className="flex items-center justify-between text-[10px] font-mono bg-black/40 border border-white/5 rounded px-2 py-1">
              <span className="text-white uppercase tracking-wider">#{o.id} {o.type}</span>
              <span className="text-zinc-400">{o.distance}m · {o.angleDeg}°</span>
            </div>
          ))}
        </div>
      </section>

      {/* Contacts */}
      <section>
        <div className="label-xs flex items-center gap-1.5 mb-1.5">
          <Activity className="w-3 h-3" /> Contacts · last {senses.contacts.length}
        </div>
        <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto scroll-thin">
          {senses.contacts.length === 0 && (
            <div className="text-[10px] font-mono text-zinc-500">— no recent contacts —</div>
          )}
          {senses.contacts.slice(0, 8).map((c, i) => (
            <div key={i} data-testid={`contact-${i}`} className="flex items-center justify-between text-[10px] font-mono bg-black/40 border border-[#FF0000]/15 rounded px-2 py-1">
              <span className="text-[#FFEA00] uppercase tracking-wider">{c.part}</span>
              <span className="text-zinc-400">{c.otherName || "world"} · F={c.force.toFixed(1)}N</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function KV({ label, value }) {
  return (
    <div className="bg-black/40 border border-white/5 rounded px-2 py-1">
      <div className="text-zinc-500 text-[8px] uppercase tracking-[0.22em]">{label}</div>
      <div className="text-[#00ff88]">{value}</div>
    </div>
  );
}
