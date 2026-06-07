/**
 * Altair 8800 / Intel 8080 — implements the uniform `Machine` interface.
 *
 * The personal-computer era's opening act. Output (the 8080 `OUT` instruction)
 * appears in the console as characters; the live display is the front-panel LED
 * readout of the address and data buses.
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
import { CPU, MEM_SIZE } from "./cpu";
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderPanel } from "./display";

const DESCRIPTOR: MachineDescriptor = {
  id: "altair8800",
  name: "Intel 8080",
  registerOrder: ["A", "B", "C", "D", "E", "H", "L", "SP", "PC"],
  registerBits: {
    A: 8, B: 8, C: 8, D: 8, E: 8, H: 8, L: 8, SP: 16, PC: 16,
  },
  flagOrder: ["S", "Z", "AC", "P", "CY"],
  defaultOrigin: 0,
  memorySize: MEM_SIZE,
  display: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
};

class Altair8800 implements Machine {
  readonly descriptor = DESCRIPTOR;

  private cpu = new CPU();
  private displayCbs = new Set<DisplayCallback>();
  private outputCbs = new Set<OutputCallback>();

  constructor() {
    this.cpu.reset();
    this.cpu.onPrint = (ch) => this.emit(String.fromCharCode(ch));
  }

  assemble(src: string): AssembleResult {
    const { bytes, origin, errors } = assemble(src);
    return { bytes, origin, errors };
  }

  load(bytes: Uint8Array, origin = 0): void {
    this.cpu.reset();
    for (let i = 0; i < bytes.length; i++) {
      this.cpu.mem[(origin + i) & (MEM_SIZE - 1)] = bytes[i];
    }
    this.cpu.pc = origin & 0xffff;
    this.cpu.halted = false;
    this.pushDisplay();
  }

  step(): void {
    this.cpu.step();
    this.pushDisplay();
  }

  run(maxSteps?: number): void {
    this.cpu.run(maxSteps);
    this.pushDisplay();
  }

  reset(): void {
    this.cpu.reset();
    this.pushDisplay();
  }

  getState(): MachineState {
    const c = this.cpu;
    const r = c.r;
    return {
      registers: {
        A: r[7], B: r[0], C: r[1], D: r[2], E: r[3], H: r[4], L: r[5],
        SP: c.sp, PC: c.pc,
      },
      flags: { S: c.fS, Z: c.fZ, AC: c.fAC, P: c.fP, CY: c.fCY },
      memory: c.mem,
      cycles: c.steps,
      halted: c.halted,
    };
  }

  onDisplayUpdate(cb: DisplayCallback): () => void {
    this.displayCbs.add(cb);
    cb(this.frame());
    return () => this.displayCbs.delete(cb);
  }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  private emit(text: string): void {
    for (const cb of this.outputCbs) cb(text);
  }
  private frame() {
    return {
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      rgba: renderPanel(this.cpu.pc, this.cpu.a),
    };
  }
  private pushDisplay(): void {
    if (this.displayCbs.size === 0) return;
    const f = this.frame();
    for (const cb of this.displayCbs) cb(f);
  }
}

export const createAltair8800: MachineFactory = () => new Altair8800();

export { Altair8800 };
