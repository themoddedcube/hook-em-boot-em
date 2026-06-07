/**
 * LC-3 — implements the uniform `Machine` interface (PRD §6).
 *
 * The curriculum bridge: the teaching ISA from UT Austin's EE 306. It has no
 * physical hardware and no raster display — programs talk to the world through
 * the OUT/PUTS traps, which appear in the console. (descriptor.display is
 * omitted, so the scene shows a terminal with no live pixel overlay.)
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
import { CPU, MEM_WORDS } from "./cpu";

const DESCRIPTOR: MachineDescriptor = {
  id: "lc3",
  name: "LC-3",
  registerOrder: ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "PC"],
  registerBits: {
    R0: 16, R1: 16, R2: 16, R3: 16, R4: 16, R5: 16, R6: 16, R7: 16, PC: 16,
  },
  flagOrder: ["N", "Z", "P"],
  defaultOrigin: DEFAULT_ORIGIN,
  memorySize: MEM_WORDS * 2,
  // No raster display — the monitor shows OUT/PUTS output as a text terminal.
  terminal: true,
};

class Lc3 implements Machine {
  readonly descriptor = DESCRIPTOR;

  private cpu = new CPU();
  private outputCbs = new Set<OutputCallback>();

  constructor() {
    this.cpu.reset();
    this.cpu.onPrint = (ch) => this.emit(String.fromCharCode(ch));
  }

  assemble(src: string): AssembleResult {
    const { bytes, origin, errors } = assemble(src);
    return { bytes, origin, errors };
  }

  load(bytes: Uint8Array, origin = DEFAULT_ORIGIN): void {
    this.cpu.reset();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const words = Math.floor(bytes.byteLength / 2);
    for (let i = 0; i < words; i++) {
      this.cpu.mem[(origin + i) & 0xffff] = view.getUint16(i * 2, true);
    }
    this.cpu.pc = origin & 0xffff;
    this.cpu.halted = false;
  }

  step(): void {
    this.cpu.step();
  }

  run(maxSteps?: number): void {
    this.cpu.run(maxSteps);
  }

  reset(): void {
    this.cpu.reset();
  }

  getState(): MachineState {
    const c = this.cpu;
    const regs: Record<string, number> = { PC: c.pc & 0xffff };
    for (let i = 0; i < 8; i++) regs[`R${i}`] = c.reg[i];
    return {
      registers: regs,
      flags: { N: c.n, Z: c.z, P: c.p },
      memory: new Uint8Array(c.mem.buffer),
      cycles: c.steps,
      halted: c.halted,
    };
  }

  onDisplayUpdate(_cb: DisplayCallback): () => void {
    // No raster display on the LC-3.
    return () => {};
  }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  private emit(text: string): void {
    for (const cb of this.outputCbs) cb(text);
  }
}

export const createLc3: MachineFactory = () => new Lc3();

export { Lc3 };
