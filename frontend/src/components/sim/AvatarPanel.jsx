import { useRef, useState } from "react";
import { useSimStore } from "@/store/simStore";
import { Upload, User, ChevronDown, ChevronRight, X, Eye, EyeOff, Trash2, Sliders } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

/**
 * AvatarPanel — Drag-and-drop GLB upload + bone-tree inspector + auto-mapping UI.
 *
 * v1 scope: the GLB is rendered as a stand-alone preview next to procedural
 * Aira (doesn't drive her physics yet). The user can see every bone the GLB
 * exposes, and accept/override the auto-generated mapping from GLB-bone-name
 * → Aira-joint-slot. The mapping is persisted; the actual bone-driving
 * implementation will read this mapping in a follow-up.
 */
const AIRA_SLOTS = [
  "head", "spine",
  "lShoulder", "rShoulder", "lElbow", "rElbow",
  "lWrist", "rWrist", "lFingers", "rFingers",
  "lHip", "rHip", "lKnee", "rKnee",
];

export default function AvatarPanel() {
  const avatar = useSimStore((s) => s.glbAvatar);
  const setGlbUrl = useSimStore((s) => s.setGlbUrl);
  const toggleGlbPreview = useSimStore((s) => s.toggleGlbPreview);
  const setGlbScale = useSimStore((s) => s.setGlbScale);
  const setGlbMapping = useSimStore((s) => s.setGlbMapping);
  const clearGlb = useSimStore((s) => s.clearGlb);
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [showBones, setShowBones] = useState(false);

  const onFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb") && !file.name.toLowerCase().endsWith(".gltf")) {
      toast.error("Please upload a .glb or .gltf file");
      return;
    }
    const url = URL.createObjectURL(file);
    setGlbUrl(url, file.name);
    toast.success(`Loaded ${file.name}`);
  };

  if (!open) {
    return (
      <button
        data-testid="open-avatar-panel-btn"
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed top-24 left-5 z-30 flex items-center gap-2 glass rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] font-bold text-[#FFEA00] border-[#FFEA00]/40 hover:bg-white/5"
      >
        <User className="w-3.5 h-3.5" />
        Avatar {avatar.url ? "· loaded" : ""}
      </button>
    );
  }

  const acceptDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]);
  };

  return (
    <aside
      data-testid="avatar-panel"
      className="pointer-events-auto fixed top-24 left-5 z-30 w-[380px] max-h-[calc(100vh-160px)] glass rounded-xl p-4 flex flex-col gap-3 overflow-y-auto scroll-thin"
    >
      <header className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#FFEA00]" />
          <span className="heading text-base font-black tracking-tight">AVATAR</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-500">glb · gltf</span>
        </div>
        <button onClick={() => setOpen(false)} data-testid="close-avatar-panel-btn" className="text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </header>

      {!avatar.url ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={acceptDrop}
          className="border-2 border-dashed border-white/20 hover:border-[#FFEA00]/60 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-6 h-6 text-zinc-400" />
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400 text-center">
            Drop a .GLB / .GLTF file here<br />or click to browse
          </div>
          <input
            data-testid="avatar-file-input"
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <>
          <div className="bg-black/40 border border-white/10 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">Loaded</div>
              <div className="text-white text-xs font-bold truncate max-w-[200px]">{avatar.filename || "avatar.glb"}</div>
              <div className="text-[9px] font-mono text-zinc-500">{avatar.bones.length} bones detected</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                data-testid="toggle-glb-preview-btn"
                onClick={toggleGlbPreview}
                className={`p-1.5 rounded border ${avatar.previewVisible ? "text-[#00ff88] border-[#00ff88]/40" : "text-zinc-500 border-white/10"}`}
                title={avatar.previewVisible ? "Hide preview" : "Show preview"}
              >
                {avatar.previewVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                data-testid="clear-avatar-btn"
                onClick={() => { clearGlb(); toast("Avatar cleared"); }}
                className="p-1.5 rounded border text-zinc-500 hover:text-[#FF6666] border-white/10 hover:border-[#FF0000]/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="label-xs flex items-center gap-1.5"><Sliders className="w-3 h-3" /> Scale</div>
            <div className="flex items-center gap-2">
              <Slider
                data-testid="glb-scale-slider"
                value={[avatar.scale]}
                min={0.1}
                max={3}
                step={0.05}
                onValueChange={(v) => setGlbScale(v[0])}
                className="flex-1"
              />
              <span className="font-mono text-[10px] text-white w-10 text-right">{avatar.scale.toFixed(2)}</span>
            </div>
          </div>

          <button
            data-testid="toggle-bones-tree-btn"
            onClick={() => setShowBones((v) => !v)}
            className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] py-2 px-3 rounded border border-white/10 hover:border-white/30 text-white"
          >
            <span className="flex items-center gap-1.5">
              {showBones ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Bone Tree · {avatar.bones.length}
            </span>
          </button>

          {showBones && (
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto scroll-thin">
              {avatar.bones.map((b) => (
                <BoneRow
                  key={b.name}
                  bone={b}
                  mapped={avatar.mapping[b.name]}
                  onChange={(slot) => setGlbMapping(b.name, slot)}
                />
              ))}
            </div>
          )}

          <div className="text-[9px] font-mono text-zinc-500 leading-relaxed">
            v1: Avatar renders as a non-interactive preview at +2x in scene. Auto-mapping populates each bone&apos;s best-guess Aira joint slot — driving the GLB skeleton from joint state is the next step.
          </div>
        </>
      )}
    </aside>
  );
}

function BoneRow({ bone, mapped, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-black/30 border border-white/5 rounded px-2 py-1">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono text-white truncate">{bone.name}</div>
        {bone.guess && !mapped && (
          <div className="text-[8px] font-mono text-zinc-500">guess → {bone.guess}</div>
        )}
      </div>
      <Select value={mapped || bone.guess || "_none"} onValueChange={onChange}>
        <SelectTrigger className="w-[100px] h-7 bg-black/40 border-white/10 text-[10px] font-mono">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-950 border-white/20 text-white">
          <SelectItem value="_none" className="text-[10px] font-mono">— none —</SelectItem>
          {AIRA_SLOTS.map((s) => (
            <SelectItem key={s} value={s} className="text-[10px] font-mono">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
