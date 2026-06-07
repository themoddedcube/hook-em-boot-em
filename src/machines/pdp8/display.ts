/**
 * The PDP-8's "display" is its front panel — rows of lamps you literally watch
 * blink as a program runs. We render three 12-lamp registers as a 12×3 grid:
 * the Accumulator (AC), the Program Counter (PC), and the Memory Buffer (MB,
 * the word currently being executed). Bit 11 is on the left, as on the real
 * console. Lit lamps glow amber.
 */

export const DISPLAY_WIDTH = 12;
export const DISPLAY_HEIGHT = 3;

const ON: [number, number, number] = [0xff, 0x9b, 0x2e];
const OFF: [number, number, number] = [0x1a, 0x12, 0x07];

/** Render AC / PC / MB as a 12×3 lamp grid (one row each, bit 11 leftmost). */
export function renderPanel(ac: number, pc: number, mb: number): Uint8Array {
  const rows = [ac, pc, mb];
  const rgba = new Uint8Array(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  for (let row = 0; row < DISPLAY_HEIGHT; row++) {
    const value = rows[row];
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const bit = 11 - x; // bit 11 on the left
      const on = (value & (1 << bit)) !== 0;
      const [r, g, b] = on ? ON : OFF;
      const o = (row * DISPLAY_WIDTH + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}
