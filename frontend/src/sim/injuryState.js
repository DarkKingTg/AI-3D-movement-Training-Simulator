/**
 * Injury State — module-level accumulator for limb impact damage.
 *
 * We deliberately keep this OUT of the Zustand store. Contact events fire
 * 30-60 times per second during a fall; routing each one through the store
 * would re-render the SensorPanel + every joint slider. Instead we maintain
 * a plain Map and let the InjuryHeatmap component read & decay it inside
 * useFrame at 60 Hz, then push a throttled summary back to the store every
 * 250 ms for the AI Input Feed.
 *
 * Keys are short part names without the "aira-" prefix (e.g. "pelvis").
 */
export const injuryLevels = new Map();

const DECAY_HALF_LIFE_S = 2.5;
const NORMALIZE_DIVISOR = 35;   // force at which a limb hits "fully red" (1.0)

export function addImpact(partKey, force) {
  if (!partKey || !Number.isFinite(force) || force <= 0) return;
  injuryLevels.set(partKey, (injuryLevels.get(partKey) || 0) + force);
}

export function decayAll(deltaSec) {
  const factor = Math.pow(0.5, deltaSec / DECAY_HALF_LIFE_S);
  for (const [k, v] of injuryLevels.entries()) {
    const next = v * factor;
    if (next < 0.01) injuryLevels.delete(k);
    else injuryLevels.set(k, next);
  }
}

export function getNormalized(partKey) {
  const v = injuryLevels.get(partKey) || 0;
  return Math.min(1, v / NORMALIZE_DIVISOR);
}

export function snapshotNormalized() {
  const out = {};
  for (const [k, v] of injuryLevels.entries()) {
    out[k] = Math.min(1, v / NORMALIZE_DIVISOR);
  }
  return out;
}

export function clearAll() {
  injuryLevels.clear();
}
