import { useSimStore } from "@/store/simStore";
import { Slider } from "@/components/ui/slider";
import { Film, Play, Square, Trash2, Download, Share2, X, Activity, Clock } from "lucide-react";
import { toast } from "sonner";

/**
 * FallsPanel — UI for the auto-recorded fall clips. Lists every captured
 * "Fall #xxxx" with peak force / duration / level metadata. User can replay
 * in slow-mo (0.1×–1.0×), download the clip as JSON, share via clipboard,
 * or wipe the library.
 */
export default function FallsPanel() {
  const open = useSimStore((s) => s.fallsPanelOpen);
  const toggle = useSimStore((s) => s.toggleFallsPanel);
  const clips = useSimStore((s) => s.fallsClips);
  const recorderEnabled = useSimStore((s) => s.recorder.enabled);
  const toggleRecorder = useSimStore((s) => s.toggleRecorder);
  const playback = useSimStore((s) => s.playback);
  const playClip = useSimStore((s) => s.playClip);
  const stopPlayback = useSimStore((s) => s.stopPlayback);
  const setPlaybackSpeed = useSimStore((s) => s.setPlaybackSpeed);
  const removeClip = useSimStore((s) => s.removeClip);
  const clearClips = useSimStore((s) => s.clearClips);
  const recordingPostFall = useSimStore((s) => s.recorder.recordingPostFall);

  if (!open) {
    return (
      <button
        data-testid="open-falls-panel-btn"
        onClick={toggle}
        className="pointer-events-auto fixed top-24 right-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#FF6666] border-[#FF0000]/40 hover:bg-white/5"
      >
        <Film className="w-3.5 h-3.5" /> Falls · {clips.length}
        {recordingPostFall && (
          <span className="ml-1 inline-block w-2 h-2 rounded-full bg-[#FF0000] animate-pulse" />
        )}
      </button>
    );
  }

  const handleShare = async (clip) => {
    const summary = [
      "🤸 Aira's Fall Compilation",
      `Clip: ${clip.name} · ${clip.level}`,
      `Peak Force: ${clip.peakForce} N`,
      `Duration: ${clip.durationSec}s · ${clip.frameCount} frames @ 10Hz`,
      `Captured: ${new Date(clip.dateISO).toLocaleString()}`,
      "",
      `→ aira-motion-lab`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Clip summary copied");
    } catch {
      toast("Could not copy");
    }
  };

  const handleDownload = (clip) => {
    const blob = new Blob([JSON.stringify(clip, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aira-${clip.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Clip JSON downloaded");
  };

  return (
    <aside
      data-testid="falls-panel"
      className="pointer-events-auto fixed top-24 right-5 z-30 w-[380px] max-h-[calc(100vh-160px)] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#FF6666]" />
          <span className="heading text-base font-black tracking-tight">FALLS</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">{clips.length} clips</span>
        </div>
        <button data-testid="close-falls-panel-btn" onClick={toggle} className="text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Recorder status */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${recordingPostFall ? "bg-[#FF0000] animate-pulse" : recorderEnabled ? "bg-[#00ff88]" : "bg-zinc-600"}`} />
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-300">
            {recordingPostFall ? "Capturing post-fall…" : recorderEnabled ? "Recorder armed" : "Recorder off"}
          </span>
        </div>
        <button
          data-testid="toggle-recorder-btn"
          onClick={toggleRecorder}
          className={`text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded border transition-colors ${
            recorderEnabled
              ? "border-[#00ff88]/40 text-[#00ff88]"
              : "border-zinc-600 text-zinc-400 hover:text-white"
          }`}
        >
          {recorderEnabled ? "On" : "Off"}
        </button>
      </div>

      {/* Active playback controls */}
      {playback.playing && (
        <div className="bg-black/60 border border-[#FF0000]/40 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#FF6666] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-white">Replaying</span>
            </div>
            <button
              data-testid="stop-replay-btn"
              onClick={stopPlayback}
              className="flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] text-[#FF6666]"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-400 w-12">Slow-mo</span>
            <Slider
              data-testid="replay-speed-slider"
              value={[playback.speed]}
              min={0.1}
              max={1.0}
              step={0.05}
              onValueChange={(v) => setPlaybackSpeed(v[0])}
              className="flex-1"
            />
            <span className="font-mono text-[10px] text-[#FFEA00] w-10 text-right">{playback.speed.toFixed(2)}×</span>
          </div>
        </div>
      )}

      {/* Clips list */}
      {clips.length === 0 && (
        <div className="text-[10px] font-mono text-zinc-500 text-center py-6">
          No clips yet. Switch to physics ragdoll mode and let Aira fall — clips will appear here automatically.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {clips.map((c) => (
          <article
            key={c.id}
            data-testid={`fall-clip-${c.id}`}
            className="bg-black/30 border border-white/10 rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-white tracking-tight">{c.name}</div>
                <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
                  {new Date(c.dateISO).toLocaleTimeString()} · {c.level}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-[#FF6666]">F<sub>peak</sub> {c.peakForce} N</div>
                <div className="text-[9px] font-mono text-zinc-500">{c.durationSec}s · {c.frameCount} frames</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                data-testid={`play-clip-${c.id}-btn`}
                onClick={() => { playClip(c.id, 0.4); toast(`Replaying ${c.name} @ 0.4×`); }}
                disabled={playback.playing && playback.clipId === c.id}
                className="flex-1 flex items-center justify-center gap-1 bg-[#FFEA00]/15 border border-[#FFEA00]/40 text-[#FFEA00] text-[10px] uppercase tracking-[0.22em] py-1.5 rounded font-bold hover:bg-[#FFEA00]/25 disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Slow-Mo
              </button>
              <button
                data-testid={`share-clip-${c.id}-btn`}
                onClick={() => handleShare(c)}
                className="flex items-center gap-1 text-zinc-400 hover:text-white text-[9px] uppercase tracking-[0.22em] px-2 py-1.5 border border-white/10 hover:border-white/30 rounded"
              >
                <Share2 className="w-3 h-3" />
              </button>
              <button
                data-testid={`download-clip-${c.id}-btn`}
                onClick={() => handleDownload(c)}
                className="flex items-center gap-1 text-zinc-400 hover:text-white text-[9px] uppercase tracking-[0.22em] px-2 py-1.5 border border-white/10 hover:border-white/30 rounded"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                data-testid={`remove-clip-${c.id}-btn`}
                onClick={() => removeClip(c.id)}
                className="flex items-center gap-1 text-zinc-500 hover:text-[#FF6666] text-[9px] uppercase tracking-[0.22em] px-2 py-1.5 border border-white/10 hover:border-[#FF0000]/40 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </article>
        ))}
      </div>

      {clips.length > 0 && (
        <button
          data-testid="clear-clips-btn"
          onClick={() => { if (window.confirm("Wipe all fall clips?")) { clearClips(); toast("All clips wiped"); } }}
          className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-[#FF6666] py-2 rounded border border-white/5 hover:border-[#FF0000]/40"
        >
          Wipe All Clips
        </button>
      )}
    </aside>
  );
}
