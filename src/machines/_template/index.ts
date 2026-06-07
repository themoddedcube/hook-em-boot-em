/**
 * _template — a copyable, minimal reference machine (PRD §7.1).
 *
 * This is NOT a historical machine. It is the smallest possible thing that
 * fully implements the `Machine` interface, so you can copy this folder to
 * start a new era. It demonstrates every part of the contract — assemble, load,
 * step, run, reset, getState, onDisplayUpdate, onOutput — in ~120 lines.
 *
 * TO ADD A REAL LEVEL (see README.md for the full checklist):
 *   1. Copy this folder to `src/machines/<yourmachine>/`.
 *   2. Replace the toy ISA below with your machine's real assembler + CPU
 *      (keep them in separate files like mos6502/ does once they grow).
 *   3. Add challenge JSON under `src/content/challenges/<dir>/`.
 *   4. Drop a GLB at `assets/models/<id>.glb` (optional until Phase 3).
 *   5. Add ONE entry to `src/content/levels.ts`. Done — no engine/UI edits.
 *
 * The toy ISA (one instruction per line, operand optional):
 *   SET n   A = n            ADD n   A = A + n
 *   SUB n   A = A - n        OUT     print A as decimal
 *   HLT     stop
 */

import {
  AssembleResult,
  AsmError,
  DisplayCallback,
  Machine,
  MachineDescriptor,
  MachineFactory,
  MachineState,
  OutputCallback,
} from "../../engine/machineInterface";

const DESCRIPTOR: MachineDescriptor = {
  id: "_template",
  name: "Template VM",
  registerOrder: ["A", "PC"],
  wideRegisters: ["PC"],
  flagOrder: ["Z"],
  defaultOrigin: 0,
  memorySize: 256,
};

const OPS: Record<string, number> = { SET: 1, ADD: 2, SUB: 3, OUT: 4, HLT: 5 };
const HAS_OPERAND = new Set([1, 2, 3]);

class TemplateVM implements Machine {
  readonly descriptor = DESCRIPTOR;

  private mem = new Uint8Array(256);
  private a = 0;
  private pc = 0;
  private halted = false;
  private steps = 0;
  private displayCbs = new Set<DisplayCallback>();
  private outputCbs = new Set<OutputCallback>();

  assemble(src: string): AssembleResult {
    const bytes: number[] = [];
    const errors: AsmError[] = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].replace(/;.*$/, "").trim();
      if (!text) continue;
      const [mnemonicRaw, operandRaw] = text.split(/\s+/);
      const mnemonic = mnemonicRaw.toUpperCase();
      const op = OPS[mnemonic];
      if (op === undefined) {
        errors.push({ line: i + 1, message: `Unknown instruction '${mnemonicRaw}'.` });
        continue;
      }
      bytes.push(op);
      if (HAS_OPERAND.has(op)) {
        const v = Number(operandRaw);
        if (!Number.isFinite(v)) {
          errors.push({ line: i + 1, message: `${mnemonic} needs a numeric operand.` });
          bytes.push(0);
        } else {
          bytes.push(v & 0xff);
        }
      }
    }
    return { bytes: Uint8Array.from(bytes), origin: 0, errors };
  }

  load(bytes: Uint8Array, origin = 0): void {
    this.reset();
    this.mem.set(bytes.subarray(0, this.mem.length - origin), origin);
    this.pc = origin;
    this.halted = false;
  }

  step(): void {
    if (this.halted) return;
    const op = this.mem[this.pc++];
    switch (op) {
      case 1: this.a = this.mem[this.pc++]; break; // SET
      case 2: this.a = (this.a + this.mem[this.pc++]) & 0xff; break; // ADD
      case 3: this.a = (this.a - this.mem[this.pc++]) & 0xff; break; // SUB
      case 4: this.emit(`${this.a}\n`); break; // OUT
      case 5: this.halted = true; break; // HLT
      default: this.halted = true; break; // unknown / ran off the end
    }
    this.steps++;
  }

  run(maxSteps = 100000): void {
    let n = 0;
    while (!this.halted && n < maxSteps) {
      this.step();
      n++;
    }
    this.halted = true;
  }

  reset(): void {
    this.mem.fill(0);
    this.a = 0;
    this.pc = 0;
    this.halted = false;
    this.steps = 0;
  }

  getState(): MachineState {
    return {
      registers: { A: this.a, PC: this.pc },
      flags: { Z: this.a === 0 },
      memory: this.mem,
      cycles: this.steps,
      halted: this.halted,
    };
  }

  onDisplayUpdate(cb: DisplayCallback): () => void {
    this.displayCbs.add(cb);
    return () => this.displayCbs.delete(cb);
  }

  onOutput(cb: OutputCallback): () => void {
    this.outputCbs.add(cb);
    return () => this.outputCbs.delete(cb);
  }

  private emit(text: string): void {
    for (const cb of this.outputCbs) cb(text);
  }
}

export const createTemplateVM: MachineFactory = () => new TemplateVM();
