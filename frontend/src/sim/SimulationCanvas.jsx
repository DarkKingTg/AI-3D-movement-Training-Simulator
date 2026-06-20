import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Ground from "@/sim/Ground";
import AiraRagdoll from "@/sim/AiraRagdoll";
import AiController from "@/sim/AiController";
import CameraRig from "@/sim/CameraRig";
import SpawnedObject from "@/sim/SpawnedObject";
import { useSimStore } from "@/store/simStore";
import { SIM } from "@/constants/testIds";

export default function SimulationCanvas() {
  const airaRef = useRef(null);
  const objects = useSimStore((s) => s.objects);
  const paused = useSimStore((s) => s.paused);

  return (
    <div
      data-testid={SIM.canvas}
      className="absolute inset-0"
    >
      <Canvas
        shadows={false}
        camera={{ position: [6, 4, 6], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#080812"]} />
        <fog attach="fog" args={["#020205", 25, 60]} />

        {/* Lights */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 14, 6]} intensity={1.4} />
        <hemisphereLight args={["#445566", "#0a0a0a", 0.6]} />

        <Physics gravity={[0, -9.81, 0]} paused={paused} timeStep={1 / 60}>
          <Ground />
          <AiraRagdoll ref={airaRef} spawnPosition={[0, 1.3, 0]} />
          <AiController airaRef={airaRef} />
          {objects.map((o) => (
            <SpawnedObject key={o.id} object={o} />
          ))}
        </Physics>

        <CameraRig airaRef={airaRef} />
      </Canvas>
    </div>
  );
}
