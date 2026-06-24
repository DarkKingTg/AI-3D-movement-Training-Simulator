import { useRef, useEffect } from "react";
import { RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useSimStore } from "@/store/simStore";

/**
 * Renders a single spawned object based on its type.
 * Types: box, ramp, ball, target, light, liftBox
 */
export default function SpawnedObject({ object }) {
  const bodyRef = useRef(null);
  const updateObjectPose = useSimStore((s) => s.updateObjectPose);
  const lastPoseRef = useRef(0);

  // Manipulation events: Aira's motor policy can push, pull, lift, or carry dynamic props.
  useEffect(() => {
    if (!["liftBox", "ball"].includes(object.type)) return;
    const applyManipulation = (type, detail = {}) => {
      if (detail.targetId != null && detail.targetId !== object.id) return;
      const body = bodyRef.current;
      if (!body) return;
      const force = Math.max(0, Math.min(60, Number(detail.force ?? (type === "lift" ? 12 : 8))));
      const dir = Array.isArray(detail.direction) ? detail.direction : defaultDirection(type);
      const scale = 0.018;
      body.applyImpulse({
        x: (dir[0] || 0) * force * scale,
        y: (dir[1] || 0) * force * scale,
        z: (dir[2] || 0) * force * scale,
      }, true);
    };
    const onPush = (e) => applyManipulation("push", e.detail);
    const onPull = (e) => applyManipulation("pull", e.detail);
    const onLift = (e) => applyManipulation("lift", e.detail);
    const onCarry = (e) => applyManipulation("carry", e.detail);
    window.addEventListener("aira:push", onPush);
    window.addEventListener("aira:pull", onPull);
    window.addEventListener("aira:lift", onLift);
    window.addEventListener("aira:carry", onCarry);
    return () => {
      window.removeEventListener("aira:push", onPush);
      window.removeEventListener("aira:pull", onPull);
      window.removeEventListener("aira:lift", onLift);
      window.removeEventListener("aira:carry", onCarry);
    };
  }, [object.id, object.type]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || typeof body.translation !== "function") return;
    const now = performance.now();
    if (now - lastPoseRef.current < 150) return;
    lastPoseRef.current = now;
    try {
      const t = body.translation();
      const lv = typeof body.linvel === "function" ? body.linvel() : { x: 0, y: 0, z: 0 };
      updateObjectPose(object.id, {
        type: object.type,
        position: [round(t.x), round(t.y), round(t.z)],
        velocity: [round(lv.x), round(lv.y), round(lv.z)],
      });
    } catch {}
  });

  const { type, position, id } = object;
  const labelOffset = [0, 1.0, 0];

  if (type === "box") {
    return (
      <RigidBody ref={bodyRef} type="fixed" colliders="cuboid" position={position}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color="#FFEA00" roughness={0.6} />
        </mesh>
        <Label position={labelOffset} text="OBSTACLE" color="#FFEA00" testid={`label-obstacle-${id}`} />
      </RigidBody>
    );
  }

  if (type === "ramp") {
    return (
      <RigidBody ref={bodyRef} type="fixed" colliders="trimesh" position={position}>
        <mesh castShadow receiveShadow rotation={[0, 0, -Math.PI / 8]}>
          <boxGeometry args={[2.4, 0.2, 1.2]} />
          <meshStandardMaterial color="#5b3b1f" roughness={0.9} />
        </mesh>
        <Label position={labelOffset} text="RAMP" color="#FFEA00" testid={`label-ramp-${id}`} />
      </RigidBody>
    );
  }

  if (type === "ball") {
    return (
      <RigidBody ref={bodyRef} colliders="ball" position={position} mass={0.5} restitution={0.55} friction={0.6}>
        <mesh castShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial color="#FF3366" roughness={0.4} />
        </mesh>
        <Label position={labelOffset} text="BALL" color="#FF3366" testid={`label-ball-${id}`} />
      </RigidBody>
    );
  }

  if (type === "target") {
    return (
      <group position={position}>
        {/* visual flag — kinematic so it doesn't move */}
        <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
            <meshStandardMaterial color="#00ff88" />
          </mesh>
          <mesh position={[0.25, 1.05, 0]} castShadow>
            <boxGeometry args={[0.5, 0.3, 0.02]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.4} />
          </mesh>
        </RigidBody>
        <Label position={[0, 1.6, 0]} text="TARGET" color="#00ff88" testid={`label-target-${id}`} />
      </group>
    );
  }

  if (type === "light") {
    return (
      <group position={position}>
        <mesh>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#FFEA00" emissive="#FFEA00" emissiveIntensity={2} />
        </mesh>
        <pointLight color="#FFEA00" intensity={4} distance={10} decay={1.5} />
        <Label position={[0, 0.55, 0]} text="LIGHT" color="#FFEA00" testid={`label-light-${id}`} />
      </group>
    );
  }

  if (type === "stairs") {
    // A 4-step procedural staircase along +Z, each step 0.4m wide, 0.2m tall, 0.4m deep
    const steps = 4;
    const stepW = 1.2;
    const stepH = 0.16;
    const stepD = 0.45;
    return (
      <group position={position}>
        {Array.from({ length: steps }).map((_, i) => (
          <RigidBody key={i} type="fixed" colliders="cuboid" position={[0, stepH / 2 + i * stepH, i * stepD]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[stepW, stepH, stepD]} />
              <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
            </mesh>
          </RigidBody>
        ))}
        <Label position={[0, steps * stepH + 0.3, 0]} text="STAIRS" color="#888888" testid={`label-stairs-${id}`} />
      </group>
    );
  }

  if (type === "liftBox") {
    return (
      <RigidBody ref={bodyRef} colliders="cuboid" position={position} mass={0.4} linearDamping={0.5} angularDamping={0.4} restitution={0.05}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#002FA7" roughness={0.5} />
        </mesh>
        <Label position={labelOffset} text="LIFT-CRATE" color="#002FA7" testid={`label-lift-${id}`} />
      </RigidBody>
    );
  }

  return null;
}

function Label({ position, text, color, testid }) {
  return (
    <Html position={position} center distanceFactor={8} zIndexRange={[20, 0]}>
      <div
        data-testid={testid}
        className="no-select"
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          padding: "2px 6px",
          background: "rgba(0,0,0,0.75)",
          color,
          border: `1px solid ${color}`,
          borderRadius: 2,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function defaultDirection(type) {
  if (type === "lift" || type === "carry") return [0, 1, 0];
  if (type === "pull") return [0, 0, -1];
  return [0, 0, 1];
}

function round(n) {
  return Number(Number(n).toFixed(3));
}
