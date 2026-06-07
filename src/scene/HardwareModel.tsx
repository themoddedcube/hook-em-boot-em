/**
 * Loads a Blender-authored GLB (named meshes) and binds interactive parts by
 * name (PRD §4, §7): overlays the live pixel display on the `screen` mesh, makes
 * `knob_reset` clickable, and ties `led_power` emissive to the run state.
 *
 * Falls back gracefully: if the GLB is missing/broken, the ErrorBoundary in
 * MachineScene swaps in the primitive placeholder.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useGameStore } from "../state/gameStore";
import { Display } from "./Display";
import { TerminalScreen } from "./TerminalScreen";

export type ScreenKind = "raster" | "terminal" | "none";

export interface ScreenFrame {
  /** World-space centre to look at. */
  center: [number, number, number];
  /** Half the larger relevant dimension (for camera distance). */
  radius: number;
}

export function HardwareModel({
  url,
  onFrame,
  screenKind = "raster",
}: {
  url: string;
  onFrame?: (f: ScreenFrame) => void;
  screenKind?: ScreenKind;
}) {
  const { scene } = useGLTF(url);
  const reset = useGameStore((s) => s.reset);
  const halted = useGameStore((s) => s.machineState?.halted ?? false);
  const [hovered, setHovered] = useState(false);

  // Clone so multiple mounts / hot-reloads don't fight over one graph.
  const model = useMemo(() => scene.clone(true), [scene]);

  const modelBox = useMemo(() => new THREE.Box3().setFromObject(model), [model]);

  // Auto-center any model: rest its base on a fixed ground line and centre it
  // horizontally, so machines of very different sizes frame consistently.
  const groupPos = useMemo(() => {
    const c = new THREE.Vector3();
    modelBox.getCenter(c);
    return [-c.x, -0.6 - modelBox.min.y, -c.z] as [number, number, number];
  }, [modelBox]);

  // Locate the screen mesh and derive a placement for the live display plane.
  // Orientation is inferred from the mesh's thinnest axis (its facing normal),
  // so an upward-facing console screen and a forward-facing CRT both work.
  const screenPlacement = useMemo(() => {
    const screen = model.getObjectByName("screen");
    if (!screen) return null;
    const box = new THREE.Box3().setFromObject(screen);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const eps = 0.012;
    const min = Math.min(size.x, size.y, size.z);
    type V3 = [number, number, number];
    let position: V3, rotation: V3, scale: V3;
    if (min === size.y) {
      // thin vertically -> faces up
      position = [center.x, center.y + size.y / 2 + eps, center.z];
      rotation = [-Math.PI / 2, 0, 0];
      scale = [size.x * 0.96, size.z * 0.96, 1];
    } else if (min === size.z) {
      // thin in depth -> faces the viewer (+Z)
      position = [center.x, center.y, center.z + size.z / 2 + eps];
      rotation = [0, 0, 0];
      scale = [size.x * 0.96, size.y * 0.96, 1];
    } else {
      // thin in width -> faces +X
      position = [center.x + size.x / 2 + eps, center.y, center.z];
      rotation = [0, Math.PI / 2, 0];
      scale = [size.z * 0.96, size.y * 0.96, 1];
    }
    return { position, rotation, scale };
  }, [model]);

  // Report a world-space frame covering the whole machine, so the default
  // camera always shows it at a good 3/4 angle with the screen visible.
  useEffect(() => {
    if (!onFrame) return;
    const min = modelBox.min;
    const max = modelBox.max;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const cz = (min.z + max.z) / 2;
    // Bounding-sphere radius, so the camera can fit it at any viewport aspect.
    const radius = 0.5 * Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
    onFrame({
      center: [cx + groupPos[0], cy + groupPos[1], cz + groupPos[2]],
      radius,
    });
  }, [modelBox, groupPos, onFrame]);

  // Locate the reset knob so we can put a single, stable hover/click target on
  // it (a group-wide pointermove flickered as the ray crossed nearby meshes).
  const knobInfo = useMemo(() => {
    const knob = model.getObjectByName("knob_reset");
    if (!knob) return null;
    const box = new THREE.Box3().setFromObject(knob);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    box.getCenter(c);
    box.getSize(s);
    return { pos: [c.x, c.y, c.z] as [number, number, number], r: Math.max(s.x, s.y, s.z) / 2 };
  }, [model]);

  // Tie the power LED's glow to whether the machine is running.
  const ledMat = useRef<THREE.MeshStandardMaterial | null>(null);
  useEffect(() => {
    const led = model.getObjectByName("led_power") as THREE.Mesh | null;
    const m = led?.material;
    if (m && m instanceof THREE.MeshStandardMaterial) ledMat.current = m;
  }, [model]);
  useEffect(() => {
    if (ledMat.current) ledMat.current.emissiveIntensity = halted ? 0.4 : 4.0;
  }, [halted]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  return (
    <group position={groupPos}>
      <primitive object={model} />

      {/* One stable, invisible hover/click target over the reset knob. */}
      {knobInfo && (
        <mesh
          position={knobInfo.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
          }}
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
        >
          <sphereGeometry args={[knobInfo.r * 1.8, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {screenPlacement && screenKind === "raster" && (
        <Display
          position={screenPlacement.position}
          scale={screenPlacement.scale}
          rotation={screenPlacement.rotation}
        />
      )}
      {screenPlacement && screenKind === "terminal" && (
        <TerminalScreen
          position={screenPlacement.position}
          scale={screenPlacement.scale}
          rotation={screenPlacement.rotation}
        />
      )}
    </group>
  );
}
