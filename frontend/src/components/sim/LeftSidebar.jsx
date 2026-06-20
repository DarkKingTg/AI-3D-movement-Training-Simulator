import { useSimStore, GOALS, GOAL_LABELS } from "@/store/simStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Box, MountainSnow, Circle, Flag, Sun, Package, Trash2, Sparkles } from "lucide-react";
import { SIM } from "@/constants/testIds";
import CurriculumPanel from "@/components/sim/CurriculumPanel";
import { toast } from "sonner";

function SpawnBtn({ icon: Icon, label, type, testid, onSpawn }) {
  return (
    <button
      data-testid={testid}
      onClick={() => onSpawn(type)}
      className="flex flex-col items-center justify-center gap-1.5 aspect-square bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg p-2 transition-all group"
    >
      <Icon className="w-5 h-5 text-white group-hover:text-[#00ff88] transition-colors" />
      <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-400 group-hover:text-white">
        {label}
      </span>
    </button>
  );
}

export default function LeftSidebar() {
  const goal = useSimStore((s) => s.goal);
  const setGoal = useSimStore((s) => s.setGoal);
  const spawnObject = useSimStore((s) => s.spawnObject);
  const clearObjects = useSimStore((s) => s.clearObjects);
  const objects = useSimStore((s) => s.objects);

  const handleAssign = () => {
    setGoal(goal);
    toast.success(`Goal assigned: ${GOAL_LABELS[goal]}`);
  };

  const spawn = (type) => {
    spawnObject(type);
    toast(`Spawned ${type}`);
  };

  return (
    <aside
      data-testid={SIM.leftSidebar}
      className="glass rounded-xl p-5 w-80 flex flex-col gap-5 max-h-[calc(100vh-120px)] overflow-y-auto scroll-thin pointer-events-auto"
    >
      {/* Aira profile */}
      <div data-testid={SIM.airaProfile} className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="relative">
          <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/20 bg-zinc-900">
            <img
              src="https://images.pexels.com/photos/33168444/pexels-photo-33168444.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200"
              alt="Aira"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#00ff88] rounded-full border-2 border-black" />
        </div>
        <div className="flex-1">
          <div className="label-xs">Subject</div>
          <div className="heading text-xl font-black tracking-tight">AIRA</div>
          <div className="text-[10px] font-mono text-zinc-500">child humanoid · v1.0</div>
        </div>
      </div>

      {/* Curriculum mission panel */}
      <CurriculumPanel />

      {/* Goal selector */}
      <div className="flex flex-col gap-2">
        <div className="label-xs flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Goal Directive
        </div>
        <Select value={goal} onValueChange={(v) => setGoal(v)}>
          <SelectTrigger
            data-testid={SIM.goalSelect}
            className="bg-black/60 border-white/20 text-white h-10 rounded-md font-mono text-xs uppercase tracking-wider"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/20 text-white">
            {Object.entries(GOAL_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k} className="font-mono text-xs uppercase">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          data-testid={SIM.goalAssignBtn}
          onClick={handleAssign}
          className="bg-[#002FA7] hover:bg-[#003DD1] text-white font-bold uppercase tracking-wider text-xs h-10"
        >
          Re-Assign Goal
        </Button>
      </div>

      {/* Object spawner */}
      <div className="flex flex-col gap-2">
        <div className="label-xs">Object Spawner</div>
        <div className="grid grid-cols-3 gap-2">
          <SpawnBtn icon={Box} label="Box" type="box" testid={SIM.spawnBox} onSpawn={spawn} />
          <SpawnBtn icon={MountainSnow} label="Ramp" type="ramp" testid={SIM.spawnRamp} onSpawn={spawn} />
          <SpawnBtn icon={Circle} label="Ball" type="ball" testid={SIM.spawnBall} onSpawn={spawn} />
          <SpawnBtn icon={Flag} label="Target" type="target" testid={SIM.spawnTarget} onSpawn={spawn} />
          <SpawnBtn icon={Sun} label="Light" type="light" testid={SIM.spawnLight} onSpawn={spawn} />
          <SpawnBtn icon={Package} label="Crate" type="liftBox" testid={SIM.spawnLiftBox} onSpawn={spawn} />
        </div>
        <button
          data-testid={SIM.clearObjectsBtn}
          onClick={() => {
            clearObjects();
            toast("Scene cleared");
          }}
          className="mt-2 flex items-center justify-center gap-2 bg-transparent border border-white/15 hover:border-[#FF0000] hover:text-[#FF0000] text-white/80 text-xs uppercase tracking-wider py-2 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Scene ({objects.length})
        </button>
      </div>

      {/* Object list */}
      {objects.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="label-xs">Active Objects · {objects.length}</div>
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto scroll-thin">
            {objects.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-1 rounded border border-white/5"
              >
                <span className="uppercase tracking-wider">
                  #{o.id} {o.type}
                </span>
                <span className="text-zinc-600">
                  {o.position.map((n) => n.toFixed(1)).join(",")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
