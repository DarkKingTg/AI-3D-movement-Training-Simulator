import { useRef, useEffect } from "react";
import { RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { useSimStore } from "@/store/simStore";

/**
 * Renders a single spawned object based on its type.
 * Types: box, ramp, ball, target, light, liftBox
 */
export default function SpawnedObject({ object }) {
  const bodyRef = useRef(null);
  const removeObject = useSimStore((s) => s.removeObject);

  // Lift event: if this is a liftBox and Aira tries to lift, apply upward impulse
  useEffect(() => {
    if (object.type !== "liftBox") return;
    const onLift = (e) => {
      if (e.detail?.targetId === object.id && bodyRef.current) {
        bodyRef.current.applyImpulse({ x: 0, y: 0.25, z: 0 }, true);
      }
    };
    window.addEventListener("aira:lift", onLift);
    return () => window.removeEventListener("aira:lift", onLift);
  }, [object.id, object.type]);

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
