/**
 * A small ARM64-flavored teaching CPU, suitable for the iPhone level.
 *
 * This is NOT a full ARMv8-A implementation. It's a curated subset large
 * enough to write the same shape of small programs students write on MIPS or
 * the LC-3, while still feeling like the AArch64 they would read in a real
 * disassembly. The goal is recognition: "yes, that's ARM."
 *
 * Implemented (a textbook teaching subset):
 *   - 64-bit GP registers x0..x9 plus sp (x31), lr (x30), pc
 *     (we use a small register file; the rest of x10..x29 aren't named)
 *   - NZCV condition flags
 *   - MOV / ADD / SUB / AND / ORR / EOR  (register or immediate)
 *   - LDR / STR  (base + signed offset)
 *   - CMP / B / B.EQ / B.NE / B.LT / B.GT
 *   - BL  (link) / RET  (jump through lr)
 *   - SVC #0  (syscall, Darwin-style: x16 selects, x0 = arg; print int /
 *     print string / exit only)
 *
 * Programs are encoded as a tiny custom bytecode (one 32-bit word per
 * instruction) — NOT real ARM machine code. The assembler is what makes the
 * syntax look like ARM; the wire format is private to this teaching emulator.
 * That keeps the code short and focused on pedagogy, not on faithfully
 * decoding Apple's silicon.
 */

export const MEM_BYTES = 1 << 16; // 64 KB
export const TEXT_BASE = 0x0400;
export const DATA_BASE = 0x1000;

// Encoded opcodes (our private bytecode, not real ARM).
export const OP = {
  MOV_IMM: 0x01, MOV_REG: 0x02,
  ADD_IMM: 0x03, ADD_REG: 0x04,
  SUB_IMM: 0x05, SUB_REG: 0x06,
  AND_IMM: 0x07, AND_REG: 0x08,
  ORR_IMM: 0x09, ORR_REG: 0x0a,
  EOR_IMM: 0x0b, EOR_REG: 0x0c,
  LDR: 0x10, STR: 0x11,
  CMP_IMM: 0x20, CMP_REG: 0x21,
  B: 0x30, B_EQ: 0x31, B_NE: 0x32, B_LT: 0x33, B_GT: 0x34, B_LE: 0x35, B_GE: 0x36,
  BL: 0x40, RET: 0x41,
  SVC: 0x50,
  HALT: 0xff,
} as const;

/** Register names → register index in our 32-slot file. */
export const REG_NAMES: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < 32; i++) m[`x${i}`] = i;
  m["sp"] = 31;
  m["lr"] = 30;
  m["xzr"] = 32; // pseudo: hardwired zero (we model it specially in setReg)
  return m;
})();

export class CPU {
  mem = new Uint8Array(MEM_BYTES);
  reg = new BigInt64Array(32);
  pc = TEXT_BASE;
  // Flags
  n = false; z = true; c = false; v = false;
  halted = false;
  steps = 0;

  onPrint: ((s: string) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    for (let i = 0; i < 32; i++) this.reg[i] = 0n;
    this.pc = TEXT_BASE;
    this.n = false; this.z = true; this.c = false; this.v = false;
    this.halted = false;
    this.steps = 0;
  }

  // --- helpers ---
  private get reg64() { return this.reg; }

  private setReg(i: number, v: bigint): void {
    if (i === 32) return; // xzr
    this.reg64[i & 31] = v;
  }
  private getReg(i: number): bigint {
    if (i === 32) return 0n;
    return this.reg64[i & 31];
  }
  private toI64(v: bigint): bigint {
    const mask = (1n << 64n) - 1n;
    let r = v & mask;
    if (r >= (1n << 63n)) r -= (1n << 64n);
    return r;
  }

  private view(): DataView { return new DataView(this.mem.buffer); }
  private read32(addr: number): number {
    return this.view().getInt32(addr & 0xffff, true);
  }

  private setFlagsFromCompare(a: bigint, b: bigint): void {
    const r = this.toI64(a - b);
    this.n = r < 0n;
    this.z = r === 0n;
    this.c = a >= b;
    this.v = false; // simplified
  }

  step(): void {
    if (this.halted) return;
    const instr = this.read32(this.pc) >>> 0;
    this.pc = (this.pc + 4) & 0xffff;
    this.steps++;

    const op = (instr >>> 24) & 0xff;
    const a = (instr >>> 16) & 0xff; // rd / rs / cond word
    const b = (instr >>> 8) & 0xff;
    const c = instr & 0xff;
    // 16-bit signed immediate sometimes packed into the low two bytes
    const imm16 = ((instr & 0xffff) << 16) >> 16;

    switch (op) {
      case OP.MOV_IMM: this.setReg(a, BigInt(imm16)); return;
      case OP.MOV_REG: this.setReg(a, this.getReg(b)); return;

      case OP.ADD_IMM: this.setReg(a, this.toI64(this.getReg(b) + BigInt(c))); return;
      case OP.ADD_REG: this.setReg(a, this.toI64(this.getReg(b) + this.getReg(c))); return;
      case OP.SUB_IMM: this.setReg(a, this.toI64(this.getReg(b) - BigInt(c))); return;
      case OP.SUB_REG: this.setReg(a, this.toI64(this.getReg(b) - this.getReg(c))); return;
      case OP.AND_IMM: this.setReg(a, this.getReg(b) & BigInt(c)); return;
      case OP.AND_REG: this.setReg(a, this.getReg(b) & this.getReg(c)); return;
      case OP.ORR_IMM: this.setReg(a, this.getReg(b) | BigInt(c)); return;
      case OP.ORR_REG: this.setReg(a, this.getReg(b) | this.getReg(c)); return;
      case OP.EOR_IMM: this.setReg(a, this.getReg(b) ^ BigInt(c)); return;
      case OP.EOR_REG: this.setReg(a, this.getReg(b) ^ this.getReg(c)); return;

      case OP.LDR: {
        // a = dst, b = base reg, c = signed byte offset (in 4-byte words)
        const off = (c << 24) >> 24; // sign-extend
        const addr = Number(this.getReg(b)) + off * 4;
        this.setReg(a, BigInt(this.read32(addr)));
        return;
      }
      case OP.STR: {
        const off = (c << 24) >> 24;
        const addr = Number(this.getReg(b)) + off * 4;
        const value = Number(this.getReg(a) & 0xffffffffn) | 0;
        this.view().setInt32(addr & 0xffff, value, true);
        return;
      }

      case OP.CMP_IMM: this.setFlagsFromCompare(this.getReg(a), BigInt(imm16)); return;
      case OP.CMP_REG: this.setFlagsFromCompare(this.getReg(a), this.getReg(b)); return;

      case OP.B:    this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_EQ: if (this.z) this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_NE: if (!this.z) this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_LT: if (this.n) this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_GT: if (!this.n && !this.z) this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_LE: if (this.n || this.z) this.pc = (this.pc + imm16 * 4) & 0xffff; return;
      case OP.B_GE: if (!this.n) this.pc = (this.pc + imm16 * 4) & 0xffff; return;

      case OP.BL: {
        this.setReg(30, BigInt(this.pc)); // lr = pc-after-this
        this.pc = (this.pc + imm16 * 4) & 0xffff;
        return;
      }
      case OP.RET: this.pc = Number(this.getReg(30)) & 0xffff; return;

      case OP.SVC: this.svc(); return;
      case OP.HALT: this.halted = true; return;
      default: this.halted = true; return;
    }
  }

  /** Darwin-style: x16 selects, x0 carries the argument. */
  private svc(): void {
    const code = Number(this.getReg(16) & 0xffn);
    const a0 = this.getReg(0);
    switch (code) {
      case 1: this.onPrint?.(String(this.toI64(a0))); break;              // print int
      case 4: { // print zero-terminated string at x0
        let addr = Number(a0 & 0xffffn);
        let s = "";
        let guard = 0;
        while (guard++ < 0x10000) {
          const b = this.mem[addr & 0xffff];
          if (b === 0) break;
          s += String.fromCharCode(b);
          addr++;
        }
        this.onPrint?.(s);
        break;
      }
      case 11: this.onPrint?.(String.fromCharCode(Number(a0 & 0xffn))); break; // print char
      case 93: this.halted = true; break;                                  // exit
      default: this.halted = true; break;
    }
  }

  run(maxSteps = 1_000_000): void {
    let i = 0;
    while (!this.halted && i < maxSteps) { this.step(); i++; }
    if (!this.halted && i >= maxSteps) this.halted = true;
  }
}
