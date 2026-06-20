import { RigidBody } from "@react-three/rapier";

export default function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1.0} restitution={0} name="ground">
      <mesh receiveShadow position={[0, -0.5, 0]} name="ground-mesh">
        <boxGeometry args={[80, 1, 80]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>
      {/* grid lines decoration */}
      <gridHelper args={[80, 80, "#1a1a1a", "#101010"]} position={[0, 0.01, 0]} />
    </RigidBody>
  );
}
