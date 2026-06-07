/**
 * Manchester Baby (SSEM) — implements the uniform `Machine` interface (PRD §6).
 *
 * Phase 5's "proof of extensibility" machine: a brand-new era that plugs into
 * the unchanged engine, UI, challenge runner, and progression purely by
 * implementing this interface (PRD §5, §7.1). Its display is the live 32×32
 * view of the store — exactly what the real Williams-tube monitor showed.
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
import { assemble } from "./assembler";
import { CPU, STORE_WORDS } from "./cpu";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderStore } from "./display";

const DESCRIPTOR: MachineDescriptor = {
  id: "ssem",
  name: "Manchester Baby (SSEM)",
  registerOrder: ["A", "CI"],
  registerBits: { A: 32, CI: 8 },
  flagOrder: ["NEG"],
  defaultOrigin: 0,
  memorySize: STORE_WORDS * 4,
  display: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
};

const DEFAULT_MAX_STEPS = 200_000;

class Ssem implements Machine {
  readonly descriptor = DESCRIPTOR;

  private cpu = new CPU();
  private displayCbs = new Set<DisplayCallback>();
  private outputCbs = new Set<OutputCallback>();
  private displayDirty = false;

  constructor() {
    this.cpu.reset();
    this.cpu.onWrite = () => {
      this.displayDirty = true;
    };
  }

  assemble(src: string): AssembleResult {
    const { bytes, origin, errors } = assemble(src);
    return { bytes, origin, errors };
  }

  load(bytes: Uint8Array, _origin = 0): void {
    void _origin; // the SSEM store always begins at line 0
    this.cpu.reset();
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );
    const words = Math.min(STORE_WORDS, Math.floor(bytes.byteLength / 4));
    for (let i = 0; i < words; i++) {
      this.cpu.store[i] = view.getInt32(i * 4, true);
    }
    this.cpu.ci = 0;
    this.cpu.halted = false;
    this.displayDirty = true;
    this.flushDisplay();
  }

  step(): void {
    this.cpu.step();
    this.flushDisplay();
  }

  run(maxSteps = DEFAULT_MAX_STEPS): void {
    this.cpu.run(maxSteps);
    this.flushDisplay();
  }

  reset(): void {
    this.cpu.reset();
    this.displayDirty = true;
    this.flushDisplay();
  }

  getState(): MachineState {
    const c = this.cpu;
    // Expose the store as little-endian bytes for the generic memory view.
    const memory = new Uint8Array(STORE_WORDS * 4);
    const view = new DataView(memory.buffer);
    for (let i = 0; i < STORE_WORDS; i++) view.setInt32(i * 4, c.store[i], true);

    return {
      registers: { A: c.a | 0, CI: c.ci },
      flags: { NEG: c.a < 0 },
      memory,
      cycles: c.steps,
      halted: c.halted,
    };
  }

  onDisplayUpdate(cb: DisplayCallback): () => void {
    this.displayCbs.add(cb);
    cb({
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      rgba: renderStore(this.cpu.store),
    });
    return () => this.displayCbs.delete(cb);
  }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  private flushDisplay(): void {
    if (!this.displayDirty) return;
    this.displayDirty = false;
    if (this.displayCbs.size === 0) return;
    const rgba = renderStore(this.cpu.store);
    for (const cb of this.displayCbs) {
      cb({ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, rgba });
    }
  }
}

export const createSsem: MachineFactory = () => new Ssem();

export { Ssem };
