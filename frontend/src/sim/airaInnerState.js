const DEFAULT_SIGNAL = {
  mood: "focused",
  valence: 0.15,
  arousal: 0.25,
  stress: 0.12,
  confidence: 0.35,
  fatigue: 0.05,
  pain: 0,
  curiosity: 0.35,
  hormones: {
    dopamine: 0.3,
    cortisol: 0.12,
    adrenaline: 0.2,
    oxytocin: 0.22,
    endorphin: 0.18,
  },
  drivers: [],
};

export function defaultAiraInnerState() {
  return {
    ...DEFAULT_SIGNAL,
    hormones: { ...DEFAULT_SIGNAL.hormones },
    drivers: [],
    timeline: [],
    updatedAt: 0,
  };
}

export function deriveAiraInnerState(state, previous = DEFAULT_SIGNAL) {
  const reward = clampNorm((state.trainingBridge?.lastReward || 0) / 12);
  const contacts = state.senses?.contacts || [];
  const maxContact = contacts.reduce((m, c) => Math.max(m, Number(c.force) || 0), 0);
  const injuryLevels = Object.values(state.injuries?.levels || {});
  const injuryLoad = injuryLevels.reduce((sum, v) => sum + Number(v || 0), 0) / Math.max(1, injuryLevels.length || 1);
  const broken = !!state.breakState?.broken;
  const fallen = state.airaState?.status === "fallen";
  const success = state.airaState?.status === "success!";
  const speed = Math.hypot(state.airaState?.vel?.[0] || 0, state.airaState?.vel?.[2] || 0);
  const activeGoal = state.goal && state.goal !== "idle";
  const contactStress = clamp01(maxContact / 90);
  const lessonRecent = state.movementLessons?.[0]?.t && Date.now() - state.movementLessons[0].t < 10000;

  const raw = {
    valence: 0.18 + reward * 0.32 + (success ? 0.22 : 0) - contactStress * 0.2 - injuryLoad * 0.3 - (broken ? 0.7 : 0) - (fallen ? 0.35 : 0),
    arousal: 0.18 + clamp01(speed / 3) * 0.35 + contactStress * 0.28 + (activeGoal ? 0.12 : 0) + (broken ? 0.22 : 0),
    stress: 0.1 + contactStress * 0.4 + injuryLoad * 0.35 + (fallen ? 0.28 : 0) + (broken ? 0.55 : 0),
    confidence: 0.35 + reward * 0.25 + (success ? 0.28 : 0) - (fallen ? 0.25 : 0) - (broken ? 0.45 : 0),
    fatigue: 0.04 + clamp01(speed / 4) * 0.18 + injuryLoad * 0.35 + contactStress * 0.12,
    pain: injuryLoad * 0.7 + contactStress * 0.25 + (broken ? 0.8 : 0),
    curiosity: 0.28 + (activeGoal ? 0.18 : 0) + (lessonRecent ? 0.12 : 0) - (broken ? 0.18 : 0),
  };

  const next = {
    valence: smooth(previous.valence, clamp01((raw.valence + 1) / 2), 0.08),
    arousal: smooth(previous.arousal, clamp01(raw.arousal), 0.1),
    stress: smooth(previous.stress, clamp01(raw.stress), 0.12),
    confidence: smooth(previous.confidence, clamp01(raw.confidence), 0.08),
    fatigue: smooth(previous.fatigue, clamp01(raw.fatigue), 0.05),
    pain: smooth(previous.pain, clamp01(raw.pain), 0.14),
    curiosity: smooth(previous.curiosity, clamp01(raw.curiosity), 0.06),
  };

  const hormones = {
    dopamine: smooth(previous.hormones?.dopamine, clamp01(0.22 + reward * 0.35 + (success ? 0.35 : 0) + next.curiosity * 0.12), 0.12),
    cortisol: smooth(previous.hormones?.cortisol, clamp01(0.08 + next.stress * 0.75 + next.pain * 0.3), 0.14),
    adrenaline: smooth(previous.hormones?.adrenaline, clamp01(0.1 + next.arousal * 0.55 + contactStress * 0.3 + (fallen ? 0.25 : 0)), 0.14),
    oxytocin: smooth(previous.hormones?.oxytocin, clamp01(0.2 + next.confidence * 0.18 + (success ? 0.18 : 0) - next.stress * 0.12), 0.05),
    endorphin: smooth(previous.hormones?.endorphin, clamp01(0.12 + next.pain * 0.25 + next.arousal * 0.14 + (success ? 0.12 : 0)), 0.07),
  };

  const mood = pickMood(next, hormones, { broken, fallen, success });
  const drivers = buildDrivers({ reward, maxContact, injuryLoad, broken, fallen, success, speed, activeGoal, lessonRecent });

  return {
    mood,
    ...next,
    hormones,
    drivers,
    updatedAt: Date.now(),
  };
}

export function appendInnerTimeline(current, snapshot) {
  const row = {
    t: snapshot.updatedAt || Date.now(),
    mood: snapshot.mood,
    valence: round(snapshot.valence),
    stress: round(snapshot.stress),
    arousal: round(snapshot.arousal),
    pain: round(snapshot.pain),
    dopamine: round(snapshot.hormones?.dopamine || 0),
    cortisol: round(snapshot.hormones?.cortisol || 0),
  };
  const prev = current?.timeline?.[0];
  if (prev && row.t - prev.t < 1000 && prev.mood === row.mood) return current?.timeline || [];
  return [row, ...(current?.timeline || [])].slice(0, 60);
}

function pickMood(signal, hormones, flags) {
  if (flags.broken) return "hurt";
  if (flags.fallen) return "startled";
  if (flags.success) return "proud";
  if (signal.pain > 0.45) return "guarded";
  if (signal.stress > 0.65) return "anxious";
  if (hormones.dopamine > 0.62 && signal.confidence > 0.55) return "motivated";
  if (signal.fatigue > 0.55) return "tired";
  if (signal.curiosity > 0.55) return "curious";
  return "focused";
}

function buildDrivers(ctx) {
  const out = [];
  if (ctx.success) out.push("success reward raised confidence");
  if (ctx.fallen) out.push("fall raised stress");
  if (ctx.broken) out.push("broken part raised pain and cortisol");
  if (ctx.maxContact > 20) out.push(`contact force ${ctx.maxContact.toFixed(1)}N`);
  if (ctx.injuryLoad > 0.15) out.push("injury heatmap load");
  if (ctx.speed > 0.5) out.push(`movement speed ${ctx.speed.toFixed(2)}m/s`);
  if (ctx.activeGoal) out.push("active training goal");
  if (ctx.lessonRecent) out.push("recent movement lesson");
  if (ctx.reward > 0.15) out.push("positive reward trend");
  if (ctx.reward < -0.15) out.push("negative reward trend");
  return out.slice(0, 5);
}

function smooth(prev = 0, next, alpha) {
  return clamp01(prev + (next - prev) * alpha);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function clampNorm(v) {
  return Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
}

function round(v) {
  return Number(Number(v).toFixed(3));
}
