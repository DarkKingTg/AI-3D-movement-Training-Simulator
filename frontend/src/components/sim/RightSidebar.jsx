import { useSimStore } from "@/store/simStore";
import { Slider } from "@/components/ui/slider";
import { Activity, Gauge, Zap, ChevronsUp, Save, RotateCcw, BrainCircuit, Wifi, WifiOff, ShieldAlert } from "lucide-react";
import { SIM } from "@/constants/testIds";
import { toast } from "sonner";

function TelemetryRow({ label, value, testid, color = "#00ff88" }) {
  return (
    <div data-testid={testid} className="telemetry-row" style={{ borderColor: `${color}55`, color }}>
      <span className="text-[9px] tracking-[0.22em] uppercase text-zinc-400">{label}</span>
      <span className="font-mono text-[11px]">{value}</span>
    </div>
  );
}

export default function RightSidebar() {
  const aira = useSimStore((s) => s.airaState);
  const goal = useSimStore((s) => s.goal);
  const stats = useSimStore((s) => s.stats);
  const speed = useSimStore((s) => s.speed);
  const balance = useSimStore((s) => s.balance);
  const jumpPower = useSimStore((s) => s.jumpPower);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const setBalance = useSimStore((s) => s.setBalance);
  const setJumpPower = useSimStore((s) => s.setJumpPower);
  const saveNow = useSimStore((s) => s.saveNow);
  const resetAll = useSimStore((s) => s.resetAll);
  const training = useSimStore((s) => s.trainingBridge);
  const breakState = useSimStore((s) => s.breakState);
  const lessons = useSimStore((s) => s.movementLessons);
  const setTrainingBridgeEnabled = useSimStore((s) => s.setTrainingBridgeEnabled);
  const setTrainingBridgeMode = useSimStore((s) => s.setTrainingBridgeMode);
  const setTrainingBridgeSkill = useSimStore((s) => s.setTrainingBridgeSkill);

  const distFromOrigin = Math.hypot(aira.pos[0], aira.pos[2]).toFixed(2);
  const velMag = Math.hypot(aira.vel[0], aira.vel[2]).toFixed(2);
  const latestLesson = lessons[0]?.text || "No movement lesson yet";

  return (
    <aside
      data-testid={SIM.rightSidebar}
      className="glass rounded-xl p-5 w-80 flex flex-col gap-5 max-h-[calc(100vh-120px)] overflow-y-auto scroll-thin pointer-events-auto"
    >
      <div>
        <div className="label-xs flex items-center gap-1.5 mb-2">
          <Activity className="w-3 h-3" /> Live Telemetry
        </div>
        <div className="flex flex-col gap-2">
          <TelemetryRow
            label="State"
            value={aira.status.toUpperCase()}
            testid={SIM.telState}
            color={aira.status === "fallen" ? "#FF0000" : aira.status === "success!" ? "#00ff88" : "#FFEA00"}
          />
          <TelemetryRow label="Goal" value={goal.toUpperCase()} testid={SIM.telGoal} color="#002FA7" />
          <TelemetryRow
            label="Pos XYZ"
            value={`${aira.pos[0].toFixed(2)} ${aira.pos[1].toFixed(2)} ${aira.pos[2].toFixed(2)}`}
            testid={SIM.telPosition}
          />
          <TelemetryRow
            label="Vel m/s"
            value={`${velMag} ↦ ${aira.vel[0].toFixed(1)},${aira.vel[2].toFixed(1)}`}
            testid={SIM.telVelocity}
          />
          <TelemetryRow label="Distance" value={`${distFromOrigin} m`} testid={SIM.telDistance} />
        </div>
      </div>

      <div>
        <div className="label-xs mb-2">Training Counters</div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Attempts" value={stats.attempts} testid={SIM.telAttempts} color="#FFEA00" />
          <StatBox label="Success" value={stats.successes} testid={SIM.telSuccesses} color="#00ff88" />
          <StatBox label="Falls" value={stats.falls} testid={SIM.telFalls} color="#FF0000" />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
        <div className="label-xs flex items-center gap-1.5">
          <BrainCircuit className="w-3 h-3" /> Movement Policy
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TelemetryRow
            label="Bridge"
            value={training.connected ? "WS ONLINE" : training.enabled ? "LOCAL" : "OFF"}
            color={training.connected ? "#00ff88" : training.enabled ? "#FFEA00" : "#666666"}
          />
          <TelemetryRow
            label="Reward"
            value={Number(training.lastReward || 0).toFixed(2)}
            color={(training.lastReward || 0) >= 0 ? "#00ff88" : "#FF6666"}
          />
          <TelemetryRow label="Episode" value={`${training.episode}`} color="#A78BFA" />
          <TelemetryRow label="Skill" value={training.skill.toUpperCase()} color="#00d4ff" />
        </div>
        {breakState.lastBreak && (
          <div className="flex items-start gap-2 bg-[#FF0000]/10 border border-[#FF0000]/30 rounded-md px-2 py-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#FF6666] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#FF6666]">
                {breakState.lastBreak.part} · {breakState.lastBreak.reason}
              </div>
              <div className="text-[9px] font-mono text-zinc-400 truncate">
                {latestLesson}
              </div>
            </div>
          </div>
        )}
        {!breakState.lastBreak && (
          <div className="text-[9px] font-mono text-zinc-500 leading-relaxed bg-black/40 border border-white/5 rounded-md p-2">
            {latestLesson}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setTrainingBridgeEnabled(!training.enabled)}
            className={`flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-wider py-2 rounded border font-bold ${
              training.enabled ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10" : "border-white/15 text-zinc-400"
            }`}
          >
            {training.enabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {training.enabled ? "On" : "Off"}
          </button>
          <button
            onClick={() => setTrainingBridgeMode(training.mode === "visible" ? "headless" : "visible")}
            className="text-[9px] uppercase tracking-wider py-2 rounded border border-white/15 text-zinc-300 hover:border-white/30"
          >
            {training.mode}
          </button>
          <button
            onClick={() => setTrainingBridgeSkill(nextSkill(training.skill))}
            className="text-[9px] uppercase tracking-wider py-2 rounded border border-white/15 text-zinc-300 hover:border-white/30"
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="label-xs">Motor Parameters</div>

        <SliderRow
          label="Speed"
          icon={Gauge}
          value={speed}
          min={0.5}
          max={5}
          step={0.1}
          onChange={setSpeed}
          testid={SIM.speedSlider}
          unit="m/s"
        />
        <SliderRow
          label="Balance"
          icon={Zap}
          value={balance}
          min={0}
          max={1.5}
          step={0.05}
          onChange={setBalance}
          testid={SIM.balanceSlider}
          unit=""
        />
        <SliderRow
          label="Jump Power"
          icon={ChevronsUp}
          value={jumpPower}
          min={2}
          max={10}
          step={0.1}
          onChange={setJumpPower}
          testid={SIM.jumpSlider}
          unit="N"
        />
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/10">
        <button
          data-testid={SIM.saveBtn}
          onClick={() => {
            saveNow();
            toast.success("Saved to local storage");
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#002FA7] hover:bg-[#003DD1] text-white text-[10px] uppercase tracking-wider py-2.5 rounded font-bold transition-colors"
        >
          <Save className="w-3 h-3" /> Save
        </button>
        <button
          data-testid={SIM.loadBtn}
          onClick={() => {
            if (window.confirm("Wipe all local progress and settings?")) {
              resetAll();
              toast("Local storage wiped");
            }
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-transparent border border-[#FF0000]/50 hover:bg-[#FF0000]/10 text-[#FF0000] text-[10px] uppercase tracking-wider py-2.5 rounded font-bold transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Wipe
        </button>
      </div>
    </aside>
  );
}

const SKILL_ORDER = ["stand", "balance", "walk", "recover", "run", "jump", "stairs", "push_pull_lift"];

function nextSkill(skill) {
  const idx = SKILL_ORDER.indexOf(skill);
  return SKILL_ORDER[(idx + 1) % SKILL_ORDER.length];
}

function StatBox({ label, value, testid, color }) {
  return (
    <div
      data-testid={testid}
      className="bg-black/60 border rounded-md p-2 flex flex-col items-center"
      style={{ borderColor: `${color}44` }}
    >
      <div className="font-mono text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function SliderRow({ label, icon: Icon, value, min, max, step, onChange, testid, unit }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
          <Icon className="w-3 h-3" /> {label}
        </span>
        <span className="font-mono text-xs text-white">
          {value.toFixed(2)}
          <span className="text-zinc-500 ml-1">{unit}</span>
        </span>
      </div>
      <Slider
        data-testid={testid}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="w-full"
      />
    </div>
  );
}
