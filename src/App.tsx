import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";

// Placeholder scene: an isometric patch of campus with one lab block.
// The real world renderer lives in src/render/ (see docs/DESIGN.md).
export function App() {
  return (
    <>
      <Canvas orthographic shadows camera={{ position: [20, 20, 20], zoom: 40, near: -100, far: 200 }}>
        <color attach="background" args={["#9fd3e6"]} />
        <hemisphereLight args={["#ffffff", "#4a6b3a", 1.2]} />
        <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[16, 16]} />
          <meshStandardMaterial color="#6fae4f" />
        </mesh>
        <gridHelper args={[16, 16, "#4f8a39", "#4f8a39"]} position-y={0.01} />
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[3, 2, 3]} />
          <meshStandardMaterial color="#e8e2d0" />
        </mesh>
        <MapControls enableRotate={false} />
      </Canvas>
      <div className="title">
        <h1>Frontier Lab Tycoon</h1>
        <p>Build the future. Ask forgiveness later.</p>
      </div>
    </>
  );
}
