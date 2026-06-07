/**
 * DEC PDP-8 (1965) CPU — the machine that made computers affordable enough for
 * ordinary labs and factories: the first commercially successful minicomputer.
 *
 * 12-bit words, 4096-word memory, one accumulator (AC) plus a 1-bit Link (L),
 * and just EIGHT instructions. Six are "memory reference" (AND, TAD, ISZ, DCA,
 * JMS, JMP); the other two are escape hatches — IOT for input/output (the
 * Teletype) and OPR, a bag of micro-operations packed into one word.
 *
 * Addressing is the lesson here: only a 7-bit offset fits in an instruction, so
 * you can reach the current 128-word "page" or page 0 directly, and anywhere
 * else through an indirect pointer. This is the constraint that later registers
 * and wider words exist to relieve.
 *
 * Faithful to documented PDP-8 behaviour (TAD link-carry, ISZ skip, JMS return-
 * word, autoindex registers 010–017, the OPR group-1/group-2 microcode, and the
 * Teletype IOTs). Simplified: no interrupts, no EAE (group-3 OPR is a no-op).
 */

export const MEM_WORDS = 4096;
export const MASK = 0o7777; // 12-bit
const SIGN = 0o4000; // bit 11

export class CPU {
  mem = new Int16Array(MEM_WORDS);
  ac = 0; // 12-bit accumulator
  l = 0; // 1-bit link
  pc = 0o200; // program counter (programs conventionally start at 0200)
  halted = false;
  steps = 0;

  /** Latched memory-buffer (the last word fetched) — for the lamp display. */
  mb = 0;

  onWrite: ((addr: number, value: number) => void) | null = null;
  onPrint: ((ch: number) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    this.ac = 0;
    this.l = 0;
    this.pc = 0o200;
    this.halted = false;
    this.steps = 0;
    this.mb = 0;
  }

  private read(addr: number): number {
    return this.mem[addr & (MEM_WORDS - 1)] & MASK;
  }
  private write(addr: number, value: number): void {
    addr &= MEM_WORDS - 1;
    this.mem[addr] = value & MASK;
    this.onWrite?.(addr, this.mem[addr]);
  }

  step(): void {
    if (this.halted) return;
    const instrAddr = this.pc;
    const instr = this.read(instrAddr);
    this.mb = instr;
    this.pc = (this.pc + 1) & MASK;
    this.steps++;

    const op = (instr >> 9) & 7;
    if (op === 7) return this.operate(instr);
    if (op === 6) return this.iot(instr);

    // --- memory-reference instructions ---
    const indirect = (instr >> 8) & 1;
    const pageBit = (instr >> 7) & 1;
    const offset = instr & 0o177;
    let addr = pageBit ? (instrAddr & 0o7600) | offset : offset;

    if (indirect) {
      // Autoindex: indirect through 010–017 pre-increments the pointer.
      if (addr >= 0o10 && addr <= 0o17) {
        this.write(addr, (this.read(addr) + 1) & MASK);
      }
      addr = this.read(addr);
    }

    switch (op) {
      case 0: // AND
        this.ac &= this.read(addr);
        break;
      case 1: { // TAD — two's-complement add; carry complements Link
        const sum = this.ac + this.read(addr);
        if (sum & 0o10000) this.l ^= 1;
        this.ac = sum & MASK;
        break;
      }
      case 2: { // ISZ — increment memory, skip if it became zero
        const v = (this.read(addr) + 1) & MASK;
        this.write(addr, v);
        if (v === 0) this.pc = (this.pc + 1) & MASK;
        break;
      }
      case 3: // DCA — deposit AC to memory and clear AC
        this.write(addr, this.ac);
        this.ac = 0;
        break;
      case 4: // JMS — jump to subroutine (return address stored at target)
        this.write(addr, this.pc);
        this.pc = (addr + 1) & MASK;
        break;
      case 5: // JMP
        this.pc = addr;
        break;
    }
  }

  private iot(instr: number): void {
    // Minimal Teletype model. The printer is always "ready".
    switch (instr) {
      case 0o6041: // TSF — skip if printer flag set (always ready)
        this.pc = (this.pc + 1) & MASK;
        break;
      case 0o6042: // TCF — clear printer flag
        break;
      case 0o6044: // TPC — print AC<0:7>
      case 0o6046: // TLS — load printer + start (print)
        this.onPrint?.(this.ac & 0o177);
        break;
      case 0o6031: // KSF — keyboard skip (no input in this model: never skip)
        break;
      case 0o6032: // KCC — clear AC (and keyboard flag)
        this.ac = 0;
        break;
      default:
        break; // other IOTs: no-op
    }
  }

  private operate(instr: number): void {
    if ((instr & 0o400) === 0) {
      // --- Group 1 ---
      if (instr & 0o200) this.ac = 0; // CLA
      if (instr & 0o100) this.l = 0; // CLL
      if (instr & 0o040) this.ac = ~this.ac & MASK; // CMA
      if (instr & 0o020) this.l ^= 1; // CML
      if (instr & 0o001) { // IAC
        const t = this.ac + 1;
        if (t & 0o10000) this.l ^= 1;
        this.ac = t & MASK;
      }
      const twice = (instr & 0o002) !== 0;
      if (instr & 0o010) this.rar(twice ? 2 : 1); // RAR / RTR
      else if (instr & 0o004) this.ral(twice ? 2 : 1); // RAL / RTL
      else if (twice) this.bsw(); // BSW (0o002 alone)
      return;
    }

    if (instr & 0o001) return; // Group 3 (EAE) — not modelled, no-op

    // --- Group 2 (skip / OR-or-AND group) ---
    const sma = (instr & 0o100) !== 0;
    const sza = (instr & 0o040) !== 0;
    const snl = (instr & 0o020) !== 0;
    const reverse = (instr & 0o010) !== 0;

    let skip: boolean;
    if (!reverse) {
      skip =
        (sma && (this.ac & SIGN) !== 0) ||
        (sza && this.ac === 0) ||
        (snl && this.l !== 0);
    } else {
      // Reversed sense (SPA / SNA / SZL); SKP with no conditions always skips.
      skip = true;
      if (sma) skip = skip && (this.ac & SIGN) === 0;
      if (sza) skip = skip && this.ac !== 0;
      if (snl) skip = skip && this.l === 0;
    }
    if (skip) this.pc = (this.pc + 1) & MASK;

    if (instr & 0o200) this.ac = 0; // CLA (after the skip test)
    if (instr & 0o002) this.halted = true; // HLT
  }

  private rar(n: number): void {
    for (let i = 0; i < n; i++) {
      const newL = this.ac & 1;
      this.ac = ((this.ac >> 1) | (this.l << 11)) & MASK;
      this.l = newL;
    }
  }
  private ral(n: number): void {
    for (let i = 0; i < n; i++) {
      const newL = (this.ac >> 11) & 1;
      this.ac = ((this.ac << 1) | this.l) & MASK;
      this.l = newL;
    }
  }
  private bsw(): void {
    this.ac = ((this.ac & 0o77) << 6) | ((this.ac >> 6) & 0o77);
  }

  run(maxSteps = 500000): void {
    let n = 0;
    while (!this.halted && n < maxSteps) {
      this.step();
      n++;
    }
    if (!this.halted && n >= maxSteps) this.halted = true;
  }
}
