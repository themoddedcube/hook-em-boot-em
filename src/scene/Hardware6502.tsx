/**
 * Placeholder 3D hardware for the 6502 level — a boxy KIM-1/Apple-I-style
 * console built from primitives, with the live pixel display inset in its face
 * and one interactive element (a power/reset toggle).
 *
 * Phase 3 replaces this with a Blender-authored GLB (named meshes) loaded via
 * useGLTF; this component keeps the scene meaningful until then.
 */

import { useState } from "react";
import { useGameStore } from "../state/gameStore";
import { Display } from "./Display";

export function Hardware6502() {
  const reset = useGameStore((s) => s.reset);
  const halted = useGameStore((s) => s.machineState?.halted ?? false);
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, -0.2, 0]}>
      {/* Case body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[3.2, 0.5, 2.2]} />
        <meshStandardMaterial color="#2b2b30" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Angled front panel */}
      <group position={[0, 0.32, 0.35]} rotation={[-0.55, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.08, 1.5]} />
          <meshStandardMaterial color="#3a3a40" roughness={0.6} metalness={0.3} />
        </mesh>

        {/* Screen bezel */}
        <mesh position={[-0.7, 0.05, 0]}>
          <boxGeometry args={[1.25, 0.04, 1.25]} />
          <meshStandardMaterial color="#111" roughness={0.4} />
        </mesh>
        {/* Live pixel display */}
        <Display
          position={[-0.7, 0.09, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1.08, 1.08, 1.08]}
        />

        {/* Keypad grid (decorative) */}
        <group position={[0.95, 0.06, 0]}>
          {Array.from({ length: 16 }).map((_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <mesh
                key={i}
                position={[(col - 1.5) * 0.26, 0, (row - 1.5) * 0.26]}
              >
                <boxGeometry args={[0.2, 0.05, 0.2]} />
                <meshStandardMaterial
                  color="#d7d2c8"
                  roughness={0.5}
                  metalness={0.1}
                />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* Interactive power/reset toggle (PRD §6.1: at least one interactive element) */}
      <group position={[1.35, 0.3, -0.7]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          castShadow
        >
          <cylinderGeometry args={[0.16, 0.18, 0.14, 24]} />
          <meshStandardMaterial
            color={hovered ? "#ff7a1a" : "#bf5700"}
            emissive={halted ? "#000000" : "#ff5a00"}
            emissiveIntensity={halted ? 0 : 0.6}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}
