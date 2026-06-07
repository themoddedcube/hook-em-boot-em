/**
 * The machine's raster display, rendered as a nearest-filtered DataTexture on a
 * plane so it can sit on the 3D hardware (PRD §6.1, §7). Driven by the store's
 * `display` update (RGBA bytes from the machine's `onDisplayUpdate`).
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeElements } from "@react-three/fiber";
import { useGameStore } from "../state/gameStore";

export function Display(props: ThreeElements["mesh"]) {
  const display = useGameStore((s) => s.display);

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

  return (
    <mesh {...props}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
