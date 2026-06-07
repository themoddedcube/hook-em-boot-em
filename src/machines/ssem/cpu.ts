/**
 * The Manchester Baby (Small-Scale Experimental Machine, 1948) CPU.
 *
 * The SSEM was the first computer to run a program held in electronic memory.
 * It is gloriously minimal:
 *   - a 32-word store, each word 32 bits (we model words as signed 32-bit ints);
 *   - ONE register, the accumulator (A);
 *   - a control instruction counter (CI), the ancestor of the program counter;
 *   - just SEVEN instructions — and, famously, NO ADD. You subtract, and you
 *     load the *negative* of a word. Everything else is built from those.
 *
 * Instruction encoding (per word): bits 0–4 hold the line number (operand),
 * bits 13–15 hold the 3-bit function. Data words are plain 32-bit values that
 * happen to share the same store.
 *
 * SIMPLIFICATION (documented, per the PRD's "real but simplified" rule): the
 * real Baby *incremented CI before* fetching, and its jumps took their target
 * indirectly from the store. We model CI as a modern program counter (execute
 * the instruction at CI, then advance) and make JMP/JRP take their target
 * directly. The historically essential traits — subtract-only arithmetic,
 * load-negative, skip-if-negative, the 32×32 store, and STOP — are faithful.
 */

export const STORE_WORDS = 32;
export const WORD_BITS = 32;

/** 3-bit function codes. (4 and 5 are both SUB on the real machine.) */
export const FUNC = {
  JMP: 0, // CI := operand            (absolute jump)
  JRP: 1, // CI := CI + operand       (relative jump)
  LDN: 2, // A  := -store[operand]    (load negative)
  STO: 3, // store[operand] := A
  SUB: 4, // A  := A - store[operand]
  CMP: 6, // skip next instruction if A < 0  (a.k.a. SKN)
  STP: 7, // halt
} as const;

export class CPU {
  store = new Int32Array(STORE_WORDS);
  a = 0; // accumulator (32-bit signed)
  ci = 0; // control instruction counter (program counter)
  halted = false;
  steps = 0;

  /** Optional hook fired whenever a store word changes (for the live display). */
  onWrite: ((line: number, value: number) => void) | null = null;

  reset(): void {
    this.store.fill(0);
    this.a = 0;
    this.ci = 0;
    this.halted = false;
    this.steps = 0;
  }

  private writeStore(line: number, value: number): void {
    line &= STORE_WORDS - 1;
    this.store[line] = value | 0;
    this.onWrite?.(line, this.store[line]);
  }

  step(): void {
    if (this.halted) return;
    if (this.ci < 0 || this.ci >= STORE_WORDS) {
      this.halted = true;
      return;
    }

    const instr = this.store[this.ci] | 0;
    const func = (instr >> 13) & 0x7;
    const operand = instr & 0x1f;
    let next = this.ci + 1;

    switch (func) {
      case FUNC.JMP:
        next = operand;
        break;
      case FUNC.JRP:
        next = this.ci + operand;
        break;
      case FUNC.LDN:
        this.a = -this.store[operand] | 0;
        break;
      case FUNC.STO:
        this.writeStore(operand, this.a);
        break;
      case FUNC.SUB:
      case 5: // 5 is also SUB
        this.a = (this.a - this.store[operand]) | 0;
        break;
      case FUNC.CMP:
        if (this.a < 0) next = this.ci + 2; // skip next instruction
        break;
      case FUNC.STP:
        this.halted = true;
        break;
      default:
        this.halted = true;
        break;
    }

    this.ci = next;
    this.steps++;
  }

  run(maxSteps = 200000): void {
    let n = 0;
    while (!this.halted && n < maxSteps) {
      this.step();
      n++;
    }
    if (!this.halted && n >= maxSteps) this.halted = true;
  }
}
