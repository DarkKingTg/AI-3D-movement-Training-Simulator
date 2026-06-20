import { useEffect } from "react";
import { useSimStore } from "@/store/simStore";

/**
 * ContactSensor — listens for collision events on Aira's body and
 * pushes each contact (with estimated force) to senses.contacts.
 *
 * Uses Rapier's onCollisionEnter via the RigidBody. We attach to the
 * pelvis body since it's the main physics body. The other limbs are
 * cosmetic, so all real contacts flow through the core capsule.
 */
export default function ContactSensor({ airaRef }) {
  const addContact = useSimStore((s) => s.addContact);

  useEffect(() => {
    if (!airaRef.current) return;
    const rb = airaRef.current.pelvis?.current;
    if (!rb) return;

    // Rapier RigidBody from r3f has userData; bind a global JS listener via the rb
    // We poll contact pairs each ~250ms using the physics world.
    let raf;
    let lastSeen = new Set();
    const tick = () => {
      try {
        const world = rb.world?.();
        const handle = rb.handle;
        if (world && handle !== undefined) {
          const newSeen = new Set();
          world.contactPairsWith(rb.collider(0), (other) => {
            const id = other.handle;
            newSeen.add(id);
            if (lastSeen.has(id)) return;
            // Estimate impulse force magnitude from current linvel difference
            const lv = rb.linvel();
            const force = Math.hypot(lv.x, lv.y, lv.z) * 4; // mass=4
            const parent = other.parent?.();
            const otherName = parent?.userData?.name || parent?.name || "world";
            addContact({
              part: "core",
              otherName,
              force,
              t: Date.now(),
            });
          });
          lastSeen = newSeen;
        }
      } catch {}
      raf = setTimeout(tick, 250);
    };
    raf = setTimeout(tick, 500);
    return () => clearTimeout(raf);
  }, [airaRef, addContact]);

  return null;
}
