/**
 * MOS 6502 machine — implements the uniform `Machine` interface (PRD §6).
 *
 * Wraps the standalone CPU, assembler, and display modules so the game engine
 * and UI never touch 6502 internals. This is the MVP machine; every later era
 * ships an analogous folder exporting a `MachineFactory`.
 */

import {
  AssembleResult,
  DisplayCallback,
  Machine,
  MachineDescriptor,
  MachineFactory,
  MachineState,
  OutputCallback,
} from "../../engine/machineInterface";
import { assemble, DEFAULT_ORIGIN } from "./assembler";
import { CPU, MEM_SIZE } from "./cpu";
import {
  DISPLAY_BASE,
  DISPLAY_END,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  renderDisplay,
} from "./display";

const DESCRIPTOR: MachineDescriptor = {
  id: "mos6502",
  name: "MOS 6502",
  registerOrder: ["A", "X", "Y", "SP", "PC"],
  wideRegisters: ["PC"],
  flagOrder: ["N", "V", "D", "I", "Z", "C"],
  defaultOrigin: DEFAULT_ORIGIN,
  memorySize: MEM_SIZE,
  display: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
};

/** Safety cap so a buggy `run()` (infinite loop) can't hang the browser tab. */
const DEFAULT_MAX_STEPS = 1_000_000;

class Mos6502 implements Machine {
  readonly descriptor = DESCRIPTOR;

  private cpu = new CPU();
  private origin = DEFAULT_ORIGIN;
  private displayCbs = new Set<DisplayCallback>();
  private outputCbs = new Set<OutputCallback>();
  private displayDirty = false;

  constructor() {
    this.cpu.reset();
    // Flag display-region writes so we only re-render when pixels change.
    this.cpu.onWrite = (addr) => {
      if (addr >= DISPLAY_BASE && addr <= DISPLAY_END) this.displayDirty = true;
    };
  }

  assemble(src: string): AssembleResult {
    const { bytes, origin, errors } = assemble(src);
    return { bytes, origin, errors };
  }

  load(bytes: Uint8Array, origin = DEFAULT_ORIGIN): void {
    this.cpu.reset();
    this.origin = origin & 0xffff;
    for (let i = 0; i < bytes.length; i++) {
      this.cpu.mem[(this.origin + i) & 0xffff] = bytes[i];
    }
    // Point the reset vector at the program and start the PC there.
    this.cpu.mem[0xfffc] = this.origin & 0xff;
    this.cpu.mem[0xfffd] = (this.origin >> 8) & 0xff;
    this.cpu.pc = this.origin;
    this.cpu.halted = false;
    this.displayDirty = true;
    this.flushDisplay();
  }

  step(): void {
    this.cpu.step();
    this.flushDisplay();
  }

  run(maxSteps = DEFAULT_MAX_STEPS): void {
    let n = 0;
    while (!this.cpu.halted && n < maxSteps) {
      this.cpu.step();
      n++;
    }
    if (n >= maxSteps && !this.cpu.halted) {
      // Surfaced to the console so the player knows it was a runaway loop.
      this.emitOutput(
        `\n[halted: exceeded ${maxSteps.toLocaleString()} instruction budget — possible infinite loop]`
      );
      this.cpu.halted = true;
    }
    this.flushDisplay();
  }

  reset(): void {
    this.cpu.reset();
    this.displayDirty = true;
    this.flushDisplay();
  }

  getState(): MachineState {
    const c = this.cpu;
    return {
      registers: { A: c.a, X: c.x, Y: c.y, SP: c.sp, PC: c.pc },
      flags: {
        N: c.fN,
        V: c.fV,
        D: c.fD,
        I: c.fI,
        Z: c.fZ,
        C: c.fC,
      },
      memory: c.mem,
      cycles: c.cycles,
      halted: c.halted,
    };
  }

  onDisplayUpdate(cb: DisplayCallback): () => void {
    this.displayCbs.add(cb);
    // Push current frame immediately so a fresh subscriber is in sync.
    cb({
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      rgba: renderDisplay(this.cpu.mem),
    });
    return () => this.displayCbs.delete(cb);
  }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  /** Expose the RNG seam so challenges/tests can run deterministically. */
  setRng(rng: () => number): void {
    this.cpu.rng = rng;
  }

  private emitOutput(text: string): void {
    for (const cb of this.outputCbs) cb(text);
  }

  private flushDisplay(): void {
    if (!this.displayDirty) return;
    this.displayDirty = false;
    if (this.displayCbs.size === 0) return;
    const rgba = renderDisplay(this.cpu.mem);
    for (const cb of this.displayCbs) {
      cb({ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, rgba });
    }
  }
}

export const createMos6502: MachineFactory = () => new Mos6502();

export { Mos6502 };
