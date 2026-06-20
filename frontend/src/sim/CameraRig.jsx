import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";

/**
 * Camera controller — supports orbit / follow / top-down modes.
 */
export default function CameraRig({ airaRef }) {
  const mode = useSimStore((s) => s.cameraMode);
  const { camera } = useThree();
  const orbitRef = useRef(null);

  useEffect(() => {
    if (mode === "top") {
      camera.position.set(0, 18, 0.001);
      camera.lookAt(0, 0, 0);
    } else if (mode === "orbit") {
      camera.position.set(6, 4, 6);
      camera.lookAt(0, 1, 0);
    } else if (mode === "follow") {
      camera.position.set(3, 2.5, 4);
    }
  }, [mode, camera]);

  useFrame(() => {
    if (mode === "follow" && airaRef.current?.pelvis.current) {
      const t = airaRef.current.pelvis.current.translation();
      const target = new THREE.Vector3(t.x, t.y, t.z);
      const desired = target.clone().add(new THREE.Vector3(3, 2.5, 4));
      camera.position.lerp(desired, 0.08);
      camera.lookAt(target);
    }
  });

  return (
    <OrbitControls
      ref={orbitRef}
      enabled={mode === "orbit"}
      target={[0, 1, 0]}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={3}
      maxDistance={30}
    />
  );
}
