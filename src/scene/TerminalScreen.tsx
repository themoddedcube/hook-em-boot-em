/**
 * A live text terminal rendered onto a machine's 3D screen mesh — used by the
 * LC-3, whose output is characters (OUT/PUTS), not pixels. Draws the store's
 * console output to a canvas and maps it onto the screen plane.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeElements } from "@react-three/fiber";
import { useGameStore } from "../state/gameStore";

const CW = 384;
const CH = 224;
const PAD = 14;
const LINE_H = 20;
const FONT = "16px 'JetBrains Mono', ui-monospace, monospace";
const MAX_COLS = 30;

export function TerminalScreen(props: ThreeElements["mesh"]) {
  const output = useGameStore((s) => s.output);
  const halted = useGameStore((s) => s.machineState?.halted ?? false);

  const { texture, ctx } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    const c = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { texture: tex, ctx: c };
  }, []);

  useEffect(() => {
    // Background + faint scanline glow.
    ctx.fillStyle = "#06120a";
    ctx.fillRect(0, 0, CW, CH);
    ctx.font = FONT;
    ctx.textBaseline = "top";

    // Wrap output into lines (respecting explicit newlines).
    const raw = output.length ? output : "LC-3 ready.\nWrite a program and press Run.";
    const lines: string[] = [];
    for (const para of raw.split("\n")) {
      if (para === "") { lines.push(""); continue; }
      for (let i = 0; i < para.length; i += MAX_COLS) {
        lines.push(para.slice(i, i + MAX_COLS));
      }
    }
    const maxLines = Math.floor((CH - PAD * 2) / LINE_H);
    const shown = lines.slice(-maxLines);

    const dim = !output.length;
    ctx.fillStyle = dim ? "#3f7a55" : "#7CFFA8";
    ctx.shadowColor = "#2bff7a";
    ctx.shadowBlur = dim ? 0 : 6;
    shown.forEach((ln, i) => ctx.fillText(ln, PAD, PAD + i * LINE_H));

    // Blinking-ish cursor on the last line when running output exists.
    if (output.length && !halted) {
      const last = shown[shown.length - 1] ?? "";
      const w = ctx.measureText(last).width;
      ctx.fillRect(PAD + w + 2, PAD + (shown.length - 1) * LINE_H, 9, 16);
    }
    ctx.shadowBlur = 0;

    texture.needsUpdate = true;
  }, [output, halted, ctx, texture]);

  return (
    <mesh {...props}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
