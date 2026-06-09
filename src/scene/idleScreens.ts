/**
 * Authentic idle/boot screens painted onto a machine's 3D display before the
 * player runs any code (and again after Reset). Each painter draws what the
 * real device showed at power-on: the C64's blue BASIC banner, an N64-style
 * boot splash on the TV, the iPhone's icon-grid home screen. Machines without
 * a painter fall back to the generic "<name> ready." terminal greeting; the
 * SSEM / PDP-8 / Altair raster panels are already authentic (Williams tube,
 * lamps, LEDs) and don't come through here.
 *
 * Each machine also declares how its screen transitions from the idle screen
 * to live program output, so the cut isn't abrupt:
 *  - `transition` (terminal hosts): "crt" collapses the picture into a bright
 *    line like a CRT changing input; "zoom" opens the terminal like an app
 *    launching from the home screen.
 *  - `paintTransition` (raster hosts): a hand-drawn timeline; the C64 types
 *    RUN under READY. and clears the screen, like BASIC really did.
 */

export interface ScreenSpec {
  /** Canvas size; pick an aspect close to the model's screen mesh. */
  width: number;
  height: number;
  /** Draw the idle screen. Absent = generic terminal greeting. */
  paint?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Terminal hosts: how to animate idle -> output (default: hard cut). */
  transition?: "crt" | "zoom";
  /** Raster hosts: hand-drawn idle -> live timeline, t in [0,1]. */
  paintTransition?: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number
  ) => void;
}

const DEFAULT_SPEC: ScreenSpec = { width: 384, height: 224 };

/* ---------------------------------------------------------------- C64 ---- */

const C64_BORDER = "#867ade";
const C64_SCREEN = "#40318d";

/** The blue BASIC screen; `typedRun` chars of "RUN" typed at the prompt. */
function paintC64Screen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  typedRun = 0,
  cleared = false
): void {
  ctx.fillStyle = C64_BORDER;
  ctx.fillRect(0, 0, w, h);
  const bx = Math.round(w * 0.08);
  const by = Math.round(h * 0.09);
  ctx.fillStyle = C64_SCREEN;
  ctx.fillRect(bx, by, w - bx * 2, h - by * 2);
  if (cleared) return;

  ctx.fillStyle = C64_BORDER;
  ctx.font = "13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const cx = w / 2;
  let y = by + 10;
  ctx.fillText("**** COMMODORE 64 BASIC V2 ****", cx, y);
  y += 34;
  ctx.fillText("64K RAM SYSTEM  38911 BASIC", cx, y);
  y += 17;
  ctx.fillText("BYTES FREE", cx, y);
  y += 34;
  ctx.textAlign = "left";
  ctx.fillText("READY.", bx + 8, y);
  y += 17;
  const typed = "RUN".slice(0, typedRun);
  if (typed) ctx.fillText(typed, bx + 8, y);
  const cursorX = bx + 8 + ctx.measureText(typed).width;
  ctx.fillRect(cursorX, y, 9, 14); // block cursor
}

function paintC64(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  paintC64Screen(ctx, w, h);
}

/** Running a program, 1982-style: type RUN, screen clears, program owns it. */
function paintC64Transition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
): void {
  if (t < 0.6) {
    const typed = Math.min(3, Math.floor((t / 0.6) * 4));
    paintC64Screen(ctx, w, h, typed);
  } else {
    paintC64Screen(ctx, w, h, 3, true);
  }
}

/* ---------------------------------------------------------------- N64 ---- */

function paintN64(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  // Four-colour block cluster, the console's badge colours.
  const colors = ["#2a47d4", "#1da13c", "#e03022", "#f4c711"];
  const s = 26;
  const gap = 6;
  const cx = w / 2;
  const top = h * 0.18;
  const grid: Array<[number, number]> = [
    [cx - s - gap / 2, top],
    [cx + gap / 2, top],
    [cx - s - gap / 2, top + s + gap],
    [cx + gap / 2, top + s + gap],
  ];
  grid.forEach(([x, y], i) => {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, 5);
    ctx.fill();
  });

  ctx.fillStyle = "#e8e8e8";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 24px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("NINTENDO 64", cx, top + s * 2 + gap + 22);
  ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#9a9aa2";
  ctx.fillText("MIPS R4300i  93.75 MHz", cx, top + s * 2 + gap + 56);
  ctx.textAlign = "left";
}

/* ------------------------------------------------------------- iPhone ---- */

function paintIphone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Wallpaper: deep blue-violet gradient.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2b2f6e");
  g.addColorStop(1, "#0e1024");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Status bar.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillText("9:41", w / 2, 8);
  // Battery pill, top right.
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(w - 32, 10, 20, 9, 2.5);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(w - 30.5, 11.5, 13, 6);
  ctx.fillRect(w - 11, 12.5, 2, 4);

  // App icon grid: 4 columns x 5 rows.
  const iconColors = [
    "#34c759", "#007aff", "#ff9500", "#ff3b30",
    "#5856d6", "#ffcc00", "#af52de", "#00c7be",
    "#ff2d55", "#8e8e93", "#30b0c7", "#a2845e",
    "#32ade6", "#66d4cf", "#ff6482", "#d1a33c",
    "#4cd964", "#5ac8fa", "#c969e0", "#e0a800",
  ];
  const cols = 4;
  const rows = 5;
  const icon = 36;
  const gx = (w - cols * icon) / (cols + 1);
  const topY = 36;
  const gy = 18;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gx + c * (icon + gx);
      const y = topY + r * (icon + gy + 8);
      ctx.fillStyle = iconColors[r * cols + c];
      ctx.beginPath();
      ctx.roundRect(x, y, icon, icon, 9);
      ctx.fill();
      // Tiny label bar under each icon.
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.roundRect(x + 7, y + icon + 5, icon - 14, 4, 2);
      ctx.fill();
    }
  }

  // Dock: translucent strip with four icons.
  const dockH = icon + 20;
  const dockY = h - dockH - 8;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.roundRect(8, dockY, w - 16, dockH, 16);
  ctx.fill();
  const dockColors = ["#34c759", "#007aff", "#ff9500", "#5856d6"];
  for (let c = 0; c < 4; c++) {
    const x = gx + c * (icon + gx);
    ctx.fillStyle = dockColors[c];
    ctx.beginPath();
    ctx.roundRect(x, dockY + 10, icon, icon, 9);
    ctx.fill();
  }
  ctx.textAlign = "left";
}

/* ----------------------------------------------------------------- SSEM --- */

/**
 * The Baby's Williams tube at power-on: the 32x32 store as a lattice of faint
 * phosphor dots (every bit 0, nothing loaded yet). The live raster takes over
 * on the first run, lighting dots for 1-bits exactly like the real monitor
 * tube did.
 */
function paintSsem(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#040a05";
  ctx.fillRect(0, 0, w, h);
  const cell = w / 32;
  const r = cell * 0.18;
  ctx.fillStyle = "#1c3a22";
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      ctx.beginPath();
      ctx.arc((col + 0.5) * cell, (row + 0.5) * cell, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Soft phosphor vignette glow in the centre, like a warmed-up tube.
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
  g.addColorStop(0, "rgba(60, 160, 80, 0.10)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* -------------------------------------------------------------- lookup --- */

const SPECS: Record<string, ScreenSpec> = {
  ssem: { width: 256, height: 256, paint: paintSsem },
  commodore64: {
    width: 320,
    height: 240,
    paint: paintC64,
    paintTransition: paintC64Transition,
  },
  n64: { width: 384, height: 224, paint: paintN64, transition: "crt" },
  iphone: { width: 224, height: 448, paint: paintIphone, transition: "zoom" },
};

export function getScreenSpec(levelId: string): ScreenSpec {
  return SPECS[levelId] ?? DEFAULT_SPEC;
}
