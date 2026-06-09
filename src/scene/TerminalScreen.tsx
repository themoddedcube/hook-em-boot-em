/**
 * A live text terminal rendered onto a machine's 3D screen mesh — used by the
 * LC-3, MIPS, and ARM eras, whose output is characters (traps/syscalls), not
 * pixels. Draws the store's console output to a canvas and maps it onto the
 * screen plane. While idle (nothing run yet, or just reset), machines with an
 * authentic boot/home screen show that instead (see idleScreens.ts), and the
 * switch to live output plays that machine's transition (CRT collapse on the
 * N64's TV, app-launch zoom on the iPhone) rather than cutting hard.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ThreeElements } from "@react-three/fiber";
import { useGameStore } from "../state/gameStore";
import { getScreenSpec, ScreenSpec } from "./idleScreens";

const PAD = 14;
const LINE_H = 20;
const FONT = "16px 'JetBrains Mono', ui-monospace, monospace";
const TRANSITION_MS = 750;

/** Wrap output into terminal lines and draw them (alpha for fade-ins). */
function paintTerminal(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  text: string,
  showCursor: boolean,
  dim: boolean,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#06120a";
  ctx.fillRect(0, 0, cw, ch);
  ctx.font = FONT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const maxCols = Math.max(10, Math.floor((cw - PAD * 2) / 11.8));
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") { lines.push(""); continue; }
    for (let i = 0; i < para.length; i += maxCols) {
      lines.push(para.slice(i, i + maxCols));
    }
  }
  const maxLines = Math.floor((ch - PAD * 2) / LINE_H);
  const shown = lines.slice(-maxLines);

  ctx.fillStyle = dim ? "#3f7a55" : "#7CFFA8";
  ctx.shadowColor = "#2bff7a";
  ctx.shadowBlur = dim ? 0 : 6;
  shown.forEach((ln, i) => ctx.fillText(ln, PAD, PAD + i * LINE_H));

  if (showCursor) {
    const last = shown[shown.length - 1] ?? "";
    const w = ctx.measureText(last).width;
    ctx.fillRect(PAD + w + 2, PAD + (shown.length - 1) * LINE_H, 9, 16);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** CRT input-change: picture collapses to a bright line, output fades in. */
function paintCrtTransition(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  t: number,
  spec: ScreenSpec,
  drawLive: (alpha: number) => void
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);
  if (t < 0.45) {
    // The idle picture squashes vertically into the centre line.
    const p = t / 0.45;
    const sc = Math.max(0.02, 1 - p);
    ctx.save();
    ctx.translate(0, (ch / 2) * (1 - sc));
    ctx.scale(1, sc);
    spec.paint!(ctx, cw, ch);
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.65 * p).toFixed(3)})`;
    ctx.fillRect(0, ch / 2 - 2, cw, 4);
  } else if (t < 0.6) {
    // A fading white dot, like the tube discharging.
    const p = (t - 0.45) / 0.15;
    const r = 6 * (1 - p) + 1;
    ctx.fillStyle = `rgba(255,255,255,${(0.9 * (1 - p)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawLive((t - 0.6) / 0.4);
  }
}

/** App launch: a dark terminal window zooms out of the home screen. */
function paintZoomTransition(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  t: number,
  spec: ScreenSpec,
  drawLive: (alpha: number) => void
): void {
  spec.paint!(ctx, cw, ch);
  const e = 1 - Math.pow(1 - Math.min(1, t / 0.7), 3); // easeOutCubic
  const rw = cw * (0.3 + 0.7 * e);
  const rh = ch * (0.18 + 0.82 * e);
  const x = (cw - rw) / 2;
  const y = (ch - rh) * (1 - 0.5 * e); // rises from the dock to centre/full
  ctx.fillStyle = "rgba(4, 12, 7, 0.97)";
  ctx.beginPath();
  ctx.roundRect(x, y, rw, rh, 14 * (1 - e) + 2);
  ctx.fill();
  if (t > 0.7) {
    drawLive((t - 0.7) / 0.3);
  }
}

export function TerminalScreen(props: ThreeElements["mesh"]) {
  const output = useGameStore((s) => s.output);
  const halted = useGameStore((s) => s.machineState?.halted ?? false);
  const machineName = useGameStore((s) => s.machine?.descriptor.name ?? "Machine");
  const levelId = useGameStore((s) => s.levelId);

  const spec = getScreenSpec(levelId);

  // Transition progress: null = not animating. Starts when output first
  // appears over an idle screen; resets when output clears (Reset / level
  // change), so the next run plays it again.
  const [transT, setTransT] = useState<number | null>(null);
  const hadOutput = useRef(false);

  useEffect(() => {
    const has = output.length > 0;
    if (has && !hadOutput.current && spec.paint && spec.transition) {
      hadOutput.current = true;
      let start: number | null = null;
      let raf = 0;
      const tick = (ts: number) => {
        if (start === null) start = ts;
        const t = Math.min(1, (ts - start) / TRANSITION_MS);
        setTransT(t < 1 ? t : null);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (!has) {
      hadOutput.current = false;
      setTransT(null);
    } else {
      hadOutput.current = true;
    }
  }, [output, spec]);

  const { texture, ctx, cw, ch } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    const c = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { texture: tex, ctx: c, cw: spec.width, ch: spec.height };
  }, [spec]);

  useEffect(() => {
    // Idle, with an authentic boot/home screen for this machine? Paint it.
    if (!output.length && spec.paint) {
      spec.paint(ctx, cw, ch);
      texture.needsUpdate = true;
      return;
    }

    const drawLive = (alpha: number) =>
      paintTerminal(ctx, cw, ch, output, !halted, false, alpha);

    if (transT !== null && spec.paint && spec.transition) {
      if (spec.transition === "crt") {
        paintCrtTransition(ctx, cw, ch, transT, spec, drawLive);
      } else {
        paintZoomTransition(ctx, cw, ch, transT, spec, drawLive);
      }
      texture.needsUpdate = true;
      return;
    }

    const raw = output.length
      ? output
      : `${machineName} ready.\nWrite a program and press Run.`;
    paintTerminal(ctx, cw, ch, raw, output.length > 0 && !halted, !output.length);
    texture.needsUpdate = true;
  }, [output, halted, machineName, spec, ctx, texture, cw, ch, transT]);

  return (
    <mesh {...props}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
