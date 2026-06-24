import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Ground from "@/sim/Ground";
import AiraRagdoll from "@/sim/AiraRagdoll";
import AiraRagdollPhysics from "@/sim/AiraRagdollPhysics";
import AiController from "@/sim/AiController";
import AiTrainingBridge from "@/sim/AiTrainingBridge";
import AiraInnerStateMonitor from "@/sim/AiraInnerStateMonitor";
import CameraRig from "@/sim/CameraRig";
import SpawnedObject from "@/sim/SpawnedObject";
import JointDriver from "@/sim/JointDriver";
import MotionPlayer from "@/sim/MotionPlayer";
import VisionCamera from "@/sim/VisionCamera";
import ContactSensor from "@/sim/ContactSensor";
import CurriculumDirector from "@/sim/CurriculumDirector";
import FallRecorder from "@/sim/FallRecorder";
import FallReplayer from "@/sim/FallReplayer";
import InjuryHeatmap from "@/sim/InjuryHeatmap";
import GLBPreview from "@/sim/GLBPreview";
import { useSimStore } from "@/store/simStore";
import { SIM } from "@/constants/testIds";

export default function SimulationCanvas() {
  const airaRef = useRef(null);
  const objects = useSimStore((s) => s.objects);
  const paused = useSimStore((s) => s.paused);
  const ragdollMode = useSimStore((s) => s.ragdoll.mode);
  const pelvisLocked = useSimStore((s) => s.ragdoll.pelvisLocked);
  const driveSkeleton = useSimStore((s) => s.glbAvatar.driveSkeleton);
  const hideProcedural = useSimStore((s) => s.glbAvatar.hideProcedural);
  const glbLoaded = useSimStore((s) => !!s.glbAvatar.url);
  const meshHidden = driveSkeleton && hideProcedural && glbLoaded;

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
          {ragdollMode === "physics" ? (
            <AiraRagdollPhysics
              key={`physics-${pelvisLocked}`}
              ref={airaRef}
              spawnPosition={[0, 1.0, 0]}
              pelvisLocked={pelvisLocked}
              meshHidden={meshHidden}
            />
          ) : (
            <AiraRagdoll
              key="kinematic"
              ref={airaRef}
              spawnPosition={[0, 1.3, 0]}
              meshHidden={meshHidden}
            />
          )}
          <AiController airaRef={airaRef} />
          <MotionPlayer />
          <JointDriver airaRef={airaRef} />
          <AiTrainingBridge airaRef={airaRef} />
          <AiraInnerStateMonitor />
          <ContactSensor airaRef={airaRef} />
          <CurriculumDirector airaRef={airaRef} />
          <FallRecorder airaRef={airaRef} />
          <FallReplayer airaRef={airaRef} />
          <InjuryHeatmap airaRef={airaRef} />
          {objects.map((o) => (
            <SpawnedObject key={o.id} object={o} />
          ))}
          <GLBPreview airaRef={airaRef} />
        </Physics>

        <VisionCamera airaRef={airaRef} />

        <CameraRig airaRef={airaRef} />
      </Canvas>
    </div>
  );
}
