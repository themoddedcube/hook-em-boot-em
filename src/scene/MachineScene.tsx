/**
 * R3F scene host (PRD §7). Sets up the canvas, lighting, camera, and controls,
 * and renders the current level's hardware: a Blender-authored GLB (named
 * meshes) when one resolves for `level.modelPath`, else the primitive
 * placeholder. The camera auto-frames each machine's `screen` so the player
 * always starts looking straight at the display.
 */

import { Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Hardware6502 } from "./Hardware6502";
import { HardwareModel, ScreenFrame, ScreenKind } from "./HardwareModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { resolveModelUrl } from "./modelLoader";
import { useGameStore } from "../state/gameStore";
import { getLevel } from "../content/levels";

function Loader() {
  return (
    <Html center>
      <div style={{ color: "#bf5700", fontFamily: "monospace" }}>loading…</div>
    </Html>
  );
}

/** Points the camera + orbit target at the screen whenever the frame changes. */
function CameraRig({ frame }: { frame: ScreenFrame | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: { set: (x: number, y: number, z: number) => void }; update: () => void }
    | null;

  useEffect(() => {
    if (!frame) return;
    const { center, radius } = frame;
    // Distance to fit the bounding sphere given the *actual* viewport: the
    // narrow puzzle/scene column is width-limited, so use the smaller of the
    // vertical and (aspect-derived) horizontal half-FOV.
    const persp = camera as THREE.PerspectiveCamera;
    const vHalf = ((persp.fov ?? 44) * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (persp.aspect || 1));
    const fitHalf = Math.min(vHalf, hHalf);
    const dist = (radius / Math.sin(fitHalf)) * 1.08;
    // A 3/4 view from the front and slightly above, so the whole machine and the
    // human scale figure beside it are both in shot, with the screen visible.
    const pos: [number, number, number] = [
      center[0] + dist * 0.28,
      center[1] + dist * 0.46,
      center[2] + dist * 0.84,
    ];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(center[0], center[1], center[2]);
    if (controls) {
      controls.target.set(center[0], center[1], center[2]);
      controls.update();
    }
  }, [frame, camera, controls]);

  return null;
}

function Hardware({ onFrame }: { onFrame: (f: ScreenFrame) => void }) {
  const levelId = useGameStore((s) => s.levelId);
  const descriptor = useGameStore((s) => s.machine?.descriptor);
  const level = getLevel(levelId);
  const url = resolveModelUrl(level?.modelPath);
  const placeholder = <Hardware6502 />;

  const screenKind: ScreenKind = descriptor?.display
    ? "raster"
    : descriptor?.terminal
    ? "terminal"
    : "none";

  if (!url) return placeholder;
  return (
    <ModelErrorBoundary fallback={placeholder}>
      <HardwareModel url={url} onFrame={onFrame} screenKind={screenKind} />
    </ModelErrorBoundary>
  );
}

export function MachineScene() {
  const [frame, setFrame] = useState<ScreenFrame | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 2.4, 5], fov: 44 }}
      gl={{ toneMappingExposure: 0.78 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0d0b09"]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[4, 7, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#ffb27a" />

      <Suspense fallback={<Loader />}>
        <Hardware onFrame={setFrame} />
        <Environment preset="apartment" environmentIntensity={0.35} />
      </Suspense>

      <ContactShadows
        position={[0, -0.62, 0]}
        opacity={0.45}
        scale={9}
        blur={2.6}
        far={2.5}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.1}
      />
      <CameraRig frame={frame} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.65} intensity={0.5} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
