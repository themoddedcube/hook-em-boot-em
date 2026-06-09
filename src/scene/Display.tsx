/**
 * The machine's raster display, rendered as a nearest-filtered DataTexture on a
 * plane so it can sit on the 3D hardware (PRD §6.1, §7). Driven by the store's
 * `display` update (RGBA bytes from the machine's `onDisplayUpdate`).
 *
 * Before the player has run anything (and again after Reset), machines with an
 * authentic power-on screen (the C64's blue BASIC banner) show that instead of
 * an empty raster — see idleScreens.ts. When the player runs code, the boot
 * screen plays its transition timeline (the C64 types RUN and clears, like
 * BASIC really did) before the live raster takes over.
 */

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ThreeElements } from "@react-three/fiber";
import { useGameStore } from "../state/gameStore";
import { getScreenSpec } from "./idleScreens";

const TRANSITION_MS = 700;

function BootScreen(
  props: ThreeElements["mesh"] & { levelId: string; running: boolean }
) {
  const { levelId, running, ...meshProps } = props;
  const spec = getScreenSpec(levelId);

  const { texture, ctx } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    const c = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { texture: tex, ctx: c };
  }, [spec]);

  useEffect(() => {
    if (!running || !spec.paintTransition) {
      spec.paint!(ctx, spec.width, spec.height);
      texture.needsUpdate = true;
      return;
    }
    // Play the machine's idle -> live timeline (e.g. the C64 typing RUN).
    let start: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / TRANSITION_MS);
      spec.paintTransition!(ctx, spec.width, spec.height, t);
      texture.needsUpdate = true;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, spec, ctx, texture]);

  return (
    <mesh {...meshProps}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function Display(props: ThreeElements["mesh"]) {
  const display = useGameStore((s) => s.display);
  const hasRun = useGameStore((s) => s.hasRun);
  const levelId = useGameStore((s) => s.levelId);
  const spec = getScreenSpec(levelId);

  // Hold the boot screen through its transition before showing the raster.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!hasRun) { setLive(false); return; }
    if (!spec.paint) { setLive(true); return; }
    const tm = setTimeout(() => setLive(true), TRANSITION_MS + 30);
    return () => clearTimeout(tm);
  }, [hasRun, spec]);

  const texture = useMemo(() => {
    const w = display?.width ?? 32;
    const h = display?.height ?? 32;
    const data = new Uint8Array(w * h * 4);
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
    // Recreate only if geometry changes (rare; per-machine).
  }, [display?.width, display?.height]);

  useEffect(() => {
    if (!display?.rgba) return;
    const w = display.width;
    const h = display.height;
    const dst = texture.image.data as Uint8Array;
    // DataTexture ignores flipY for raw data, so flip rows manually: source row
    // 0 (top) must land at the bottom of texture space (v increases upward).
    for (let y = 0; y < h; y++) {
      const srcOff = y * w * 4;
      const dstOff = (h - 1 - y) * w * 4;
      dst.set(display.rgba.subarray(srcOff, srcOff + w * 4), dstOff);
    }
    texture.needsUpdate = true;
  }, [display, texture]);

  // Idle or mid-transition on a machine with an authentic power-on screen.
  if (spec.paint && (!hasRun || !live)) {
    return <BootScreen levelId={levelId} running={hasRun} {...props} />;
  }

  return (
    <mesh {...props}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
