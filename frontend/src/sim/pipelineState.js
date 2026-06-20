/**
 * pipelineState — module-level high-frequency activity tracker for the
 * AI Pipeline Visualization panel.
 *
 * Stages are pulsed at up to 60 Hz from sensors / AiController / JointDriver /
 * physics callbacks. To avoid 60 Hz React rerenders, all writes go here and
 * the PipelinePanel polls this map on its own RAF loop.
 */
const STAGES = ["vision", "imu", "contacts", "senses", "brain", "motor", "physics", "body"];

const lastActive = Object.create(null);
const flowCount = Object.create(null);
STAGES.forEach((s) => { lastActive[s] = 0; flowCount[s] = 0; });

export function pulse(stage) {
  if (!(stage in lastActive)) return;
  lastActive[stage] = performance.now();
  flowCount[stage] = (flowCount[stage] | 0) + 1;
}

/** Returns 0..1 intensity for a stage (1 = just pulsed, decays over 600ms). */
export function intensity(stage) {
  const t = lastActive[stage];
  if (!t) return 0;
  const dt = performance.now() - t;
  if (dt < 0) return 1;
  if (dt > 600) return 0;
  return 1 - dt / 600;
}

export function flow(stage) {
  return flowCount[stage] | 0;
}

export function snapshot() {
  const out = {};
  STAGES.forEach((s) => { out[s] = { intensity: intensity(s), flow: flowCount[s] | 0 }; });
  return out;
}

export { STAGES };
