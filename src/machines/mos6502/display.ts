/**
 * The easy6502 pixel display: a 32x32 grid mapped to memory $0200-$05FF
 * (one byte per pixel), where the low nibble selects a 16-colour palette.
 *
 * Palette matches the easy6502 tutorial (CC BY 4.0). See ATTRIBUTION.md.
 */

export const DISPLAY_WIDTH = 32;
export const DISPLAY_HEIGHT = 32;
export const DISPLAY_BASE = 0x0200;
export const DISPLAY_END = DISPLAY_BASE + DISPLAY_WIDTH * DISPLAY_HEIGHT - 1; // $05FF

/** 16-colour palette as [r, g, b] triples, indexed by the low nibble. */
export const PALETTE: readonly [number, number, number][] = [
  [0x00, 0x00, 0x00], // 0  black
  [0xff, 0xff, 0xff], // 1  white
  [0x88, 0x00, 0x00], // 2  red
  [0xaa, 0xff, 0xee], // 3  cyan
  [0xcc, 0x44, 0xcc], // 4  purple
  [0x00, 0xcc, 0x55], // 5  green
  [0x00, 0x00, 0xaa], // 6  blue
  [0xee, 0xee, 0x77], // 7  yellow
  [0xdd, 0x88, 0x55], // 8  orange
  [0x66, 0x44, 0x00], // 9  brown
  [0xff, 0x77, 0x77], // 10 light red
  [0x33, 0x33, 0x33], // 11 dark grey
  [0x77, 0x77, 0x77], // 12 grey
  [0xaa, 0xff, 0x66], // 13 light green
  [0x00, 0x88, 0xff], // 14 light blue
  [0xbb, 0xbb, 0xbb], // 15 light grey
];

/** Render the display region of `memory` into a fresh RGBA byte buffer. */
export function renderDisplay(memory: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  for (let i = 0; i < DISPLAY_WIDTH * DISPLAY_HEIGHT; i++) {
    const cell = memory[DISPLAY_BASE + i] & 0x0f;
    const [r, g, b] = PALETTE[cell];
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
  return rgba;
}

/** True if an address falls inside the display-mapped region. */
export function isDisplayAddr(addr: number): boolean {
  return addr >= DISPLAY_BASE && addr <= DISPLAY_END;
}
