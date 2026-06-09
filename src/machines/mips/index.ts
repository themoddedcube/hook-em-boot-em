/**
 * MIPS — implements the uniform `Machine` interface (PRD §6).
 *
 * The CPU is a teaching subset of MIPS (R-type, I-type, J-type, syscall) in
 * the spirit of MARS and SPIM. This is the family of chips inside the
 * Nintendo 64 (R4300i) and an entire generation of Unix workstations. The
 * level shipped to players is "Nintendo 64" — see content/levels.ts.
 *
 * No raster display: programs print via `syscall` exactly like the LC-3.
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
import { assemble, TEXT_BASE } from "./assembler";
import { CPU, MEM_BYTES } from "./cpu";

const DESCRIPTOR: MachineDescriptor = {
  id: "mips",
  name: "MIPS",
  // Order chosen so the most useful registers appear first in the inspector.
  registerOrder: ["$v0", "$a0", "$t0", "$t1", "$t2", "$t3", "$ra", "$sp", "$pc"],
  registerBits: {
    $v0: 32, $a0: 32, $t0: 32, $t1: 32, $t2: 32, $t3: 32,
    $ra: 32, $sp: 32, $pc: 32,
  },
  flagOrder: [],
  defaultOrigin: TEXT_BASE,
  memorySize: MEM_BYTES,
  // No raster display; the 3D screen renders the syscall console output live.
  terminal: true,
};

class Mips implements Machine {
  readonly descriptor = DESCRIPTOR;

  private cpu = new CPU();
  private outputCbs = new Set<OutputCallback>();

  constructor() {
    this.cpu.reset();
    this.cpu.onPrint = (s) => this.emit(s);
  }

  assemble(src: string): AssembleResult {
    const { bytes, origin, errors } = assemble(src);
    return { bytes, origin, errors };
  }

  load(bytes: Uint8Array, origin = TEXT_BASE): void {
    this.cpu.reset();
    for (let i = 0; i < bytes.length; i++) {
      this.cpu.mem[(origin + i) & (MEM_BYTES - 1)] = bytes[i];
    }
    this.cpu.pc = origin & 0xffff;
    this.cpu.halted = false;
  }

  step(): void { this.cpu.step(); }
  run(maxSteps?: number): void { this.cpu.run(maxSteps); }
  reset(): void { this.cpu.reset(); }

  getState(): MachineState {
    const c = this.cpu;
    const regs: Record<string, number> = {
      $v0: c.reg[2], $a0: c.reg[4],
      $t0: c.reg[8], $t1: c.reg[9], $t2: c.reg[10], $t3: c.reg[11],
      $ra: c.reg[31], $sp: c.reg[29],
      $pc: c.pc & 0xffff,
    };
    return {
      registers: regs,
      flags: {},
      memory: c.mem,
      cycles: c.steps,
      halted: c.halted,
    };
  }

  onDisplayUpdate(_cb: DisplayCallback): () => void { return () => {}; }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  private emit(text: string): void {
    for (const cb of this.outputCbs) cb(text);
  }
}

export const createMips: MachineFactory = () => new Mips();
export { Mips };
