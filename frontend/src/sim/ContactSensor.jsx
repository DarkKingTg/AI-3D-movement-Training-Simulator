/**
 * ContactSensor — now a no-op.
 *
 * In v1, contacts were sampled by polling Rapier's contact pairs. That has
 * been replaced by per-body `onContactForce` callbacks in AiraRagdollPhysics
 * which fire precise per-collision impact magnitudes directly into the store.
 * This component is kept as an empty hook to preserve existing wiring in
 * SimulationCanvas without re-flowing prop/component lists.
 */
export default function ContactSensor() {
  return null;
}
