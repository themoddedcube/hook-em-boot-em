/**
 * ARM — implements the uniform `Machine` interface (PRD §6).
 *
 * A small ARM64-flavored teaching subset, used for the iPhone level. The chip
 * inside today's iPhone (Apple A18 and friends) is part of the same ARMv8/9
 * family this subset is modeled on. Programs are syntactically real AArch64
 * (MOV, ADD, CMP, B.NE, LDR/STR, BL/RET, SVC #0), encoded into a private
 * teaching bytecode for simplicity. The architectural ideas — load/store
 * design, NZCV condition flags, link-register subroutine calls — are real.
 *
 * No raster display: programs print via `svc #0` exactly like the LC-3's
 * TRAPs and MIPS's syscalls.
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
  id: "arm",
  name: "ARM64",
  registerOrder: ["x0", "x1", "x2", "x3", "x4", "lr", "sp", "pc"],
  // Registers are 64-bit internally, but the inspector shows the low 32 bits
  // (the same view ARM itself calls w0..w4) so the hex fits the register card.
  registerBits: {
    x0: 32, x1: 32, x2: 32, x3: 32, x4: 32, lr: 32, sp: 32, pc: 32,
  },
  flagOrder: ["N", "Z", "C", "V"],
  defaultOrigin: TEXT_BASE,
  memorySize: MEM_BYTES,
  // No raster display; the iPhone's screen renders syscall console output.
  terminal: true,
};

class Arm implements Machine {
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
    // BigInts are masked to 32 bits for the inspector (registers are 64-bit
    // internally; the display widget shows the low 32 hex digits anyway).
    const trunc = (v: bigint) => Number(v & 0xffffffffn) | 0;
    return {
      registers: {
        x0: trunc(c.reg[0]), x1: trunc(c.reg[1]), x2: trunc(c.reg[2]),
        x3: trunc(c.reg[3]), x4: trunc(c.reg[4]),
        lr: trunc(c.reg[30]), sp: trunc(c.reg[31]),
        pc: c.pc & 0xffff,
      },
      flags: { N: c.n, Z: c.z, C: c.c, V: c.v },
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

export const createArm: MachineFactory = () => new Arm();
export { Arm };
