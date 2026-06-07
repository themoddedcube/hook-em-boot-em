/**
 * DEC PDP-8 — implements the uniform `Machine` interface (PRD §6).
 *
 * The minicomputer era: a real, mass-produced machine with a Teletype for I/O,
 * subroutines (JMS), and the ISZ-loop idiom. Output goes to the console via the
 * Teletype; the live display is the blinking front-panel lamp readout.
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
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderPanel } from "./display";

const DESCRIPTOR: MachineDescriptor = {
  id: "pdp8",
  name: "DEC PDP-8",
  registerOrder: ["AC", "PC"],
  registerBits: { AC: 12, PC: 12 },
  flagOrder: ["L"],
  defaultOrigin: DEFAULT_ORIGIN,
  memorySize: MEM_WORDS * 2,
  display: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
};

const DEFAULT_MAX_STEPS = 500_000;

class Pdp8 implements Machine {
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

  load(bytes: Uint8Array, origin = DEFAULT_ORIGIN): void {
    this.cpu.reset();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const words = Math.floor(bytes.byteLength / 2);
    for (let i = 0; i < words; i++) {
      this.cpu.mem[(origin + i) & (MEM_WORDS - 1)] = view.getUint16(i * 2, true);
    }
    this.cpu.pc = origin & (MEM_WORDS - 1);
    this.cpu.halted = false;
    this.cpu.mb = this.cpu.mem[this.cpu.pc] & 0o7777;
    this.pushDisplay();
  }

  step(): void {
    this.cpu.step();
    this.pushDisplay();
  }

  run(maxSteps = DEFAULT_MAX_STEPS): void {
    this.cpu.run(maxSteps);
    this.pushDisplay();
  }

  reset(): void {
    this.cpu.reset();
    this.pushDisplay();
  }

  getState(): MachineState {
    const c = this.cpu;
    const memory = new Uint8Array(MEM_WORDS * 2);
    const view = new DataView(memory.buffer);
    for (let i = 0; i < MEM_WORDS; i++) view.setUint16(i * 2, c.mem[i] & 0o7777, true);
    return {
      registers: { AC: c.ac & 0o7777, PC: c.pc & 0o7777 },
      flags: { L: c.l !== 0 },
      memory,
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
      rgba: renderPanel(this.cpu.ac, this.cpu.pc, this.cpu.mb),
    };
  }

  private pushDisplay(): void {
    if (this.displayCbs.size === 0) return;
    const f = this.frame();
    for (const cb of this.displayCbs) cb(f);
  }
}

export const createPdp8: MachineFactory = () => new Pdp8();

export { Pdp8 };
