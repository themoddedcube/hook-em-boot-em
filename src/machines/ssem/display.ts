/**
 * The SSEM's display IS its memory. The "Manchester Baby" used a Williams–
 * Kilburn cathode-ray tube as its 32-word × 32-bit store: each bit was a charged
 * dot on the phosphor, and a second monitor tube mirrored it so operators could
 * literally *watch* the store. We reproduce that here — the 32×32 dot grid is a
 * direct view of the 32 words, one row per word, one column per bit.
 *
 * Historically the bits were shown least-significant-first (left to right); we
 * keep that order so the picture matches photographs of the real machine.
 */

import { STORE_WORDS, WORD_BITS } from "./cpu";

export const DISPLAY_WIDTH = WORD_BITS; // 32 bits across
export const DISPLAY_HEIGHT = STORE_WORDS; // 32 words down

// CRT phosphor look: a greenish-white dot on near-black.
const ON: [number, number, number] = [0xc8, 0xff, 0xc0];
const OFF: [number, number, number] = [0x0a, 0x12, 0x0a];

/** Render the 32 store words as a 32×32 dot image (LSB-first per row). */
export function renderStore(store: Int32Array): Uint8Array {
  const rgba = new Uint8Array(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  for (let word = 0; word < STORE_WORDS; word++) {
    const value = store[word] | 0;
    for (let bit = 0; bit < WORD_BITS; bit++) {
      const on = (value & (1 << bit)) !== 0; // bit 0 (LSB) at the left
      const [r, g, b] = on ? ON : OFF;
      const o = (word * DISPLAY_WIDTH + bit) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}
