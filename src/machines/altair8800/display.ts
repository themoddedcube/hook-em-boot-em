/**
 * The Altair 8800's front panel — its iconic row of red LEDs. The top row shows
 * the 16-bit address bus (here the PC); the bottom row shows the 8-bit data bus
 * (here the accumulator A), left-aligned over the low 8 lamps. You "watch the
 * LEDs blink" exactly as 1975 hobbyists did.
 */

export const DISPLAY_WIDTH = 16;
export const DISPLAY_HEIGHT = 2;

const ON: [number, number, number] = [0xff, 0x33, 0x22];
const OFF: [number, number, number] = [0x1c, 0x08, 0x06];

/** Render PC (address LEDs) and A (data LEDs) as a 16×2 lamp grid. */
export function renderPanel(pc: number, a: number): Uint8Array {
  const rgba = new Uint8Array(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  const setLamp = (row: number, x: number, on: boolean) => {
    const [r, g, b] = on ? ON : OFF;
    const o = (row * DISPLAY_WIDTH + x) * 4;
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
  };
  for (let x = 0; x < 16; x++) setLamp(0, x, (pc & (1 << (15 - x))) !== 0);
  for (let x = 0; x < 16; x++) {
    const on = x < 8 && (a & (1 << (7 - x))) !== 0;
    setLamp(1, x, on);
  }
  return rgba;
}
