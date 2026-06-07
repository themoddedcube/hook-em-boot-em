/**
 * A functional (not cycle-exact) MOS 6502 CPU core.
 *
 * Covers the full documented instruction set with correct flag behaviour,
 * including binary & BCD (decimal-mode) ADC/SBC, the indirect-JMP page-boundary
 * bug, and branch/page-cross cycle penalties. This is "real but simplified" per
 * the PRD: faithful semantics, approximate cycle counts, no undocumented opcodes.
 */

import { AddrMode, BY_OPCODE, OpDef } from "./opcodes";

export const MEM_SIZE = 0x10000; // 64 KiB
const STACK_BASE = 0x0100;
const RESET_VECTOR = 0xfffc;

/** Status flag bit positions within the packed P register. */
const FLAG = {
  C: 1 << 0,
  Z: 1 << 1,
  I: 1 << 2,
  D: 1 << 3,
  B: 1 << 4,
  U: 1 << 5, // unused, conventionally 1
  V: 1 << 6,
  N: 1 << 7,
};

export class CPU {
  mem = new Uint8Array(MEM_SIZE);

  a = 0;
  x = 0;
  y = 0;
  sp = 0xff;
  pc = 0;

  // Status flags as discrete booleans (packed only for PHP/PLP/BRK/RTI).
  fC = false;
  fZ = false;
  fI = false;
  fD = false;
  fV = false;
  fN = false;

  cycles = 0;
  halted = false;

  /** Injectable RNG (0..255) for the $FE "random byte", for deterministic tests. */
  rng: () => number = () => Math.floor(Math.random() * 256);

  /** Optional hook fired on every memory write (addr, value). */
  onWrite: ((addr: number, value: number) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    this.a = this.x = this.y = 0;
    this.sp = 0xff;
    this.fC = this.fZ = this.fI = this.fD = this.fV = this.fN = false;
    this.cycles = 0;
    this.halted = false;
    this.pc = 0;
  }

  /** Reset only the CPU registers/PC from the reset vector, keeping memory. */
  resetVector(): void {
    this.pc = this.read16(RESET_VECTOR);
    this.sp = 0xff;
    this.halted = false;
    this.cycles = 0;
  }

  // --- memory access ---------------------------------------------------------

  read(addr: number): number {
    return this.mem[addr & 0xffff];
  }

  write(addr: number, value: number): void {
    addr &= 0xffff;
    value &= 0xff;
    this.mem[addr] = value;
    this.onWrite?.(addr, value);
  }

  private read16(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  /** 16-bit read with the 6502 indirect-JMP page-boundary wraparound bug. */
  private read16Bug(addr: number): number {
    const lo = this.read(addr);
    const hiAddr = (addr & 0xff00) | ((addr + 1) & 0x00ff);
    const hi = this.read(hiAddr);
    return lo | (hi << 8);
  }

  // --- stack -----------------------------------------------------------------

  private push(value: number): void {
    this.write(STACK_BASE + this.sp, value);
    this.sp = (this.sp - 1) & 0xff;
  }

  private pop(): number {
    this.sp = (this.sp + 1) & 0xff;
    return this.read(STACK_BASE + this.sp);
  }

  // --- status register packing ----------------------------------------------

  getP(brk: boolean): number {
    let p = FLAG.U;
    if (this.fC) p |= FLAG.C;
    if (this.fZ) p |= FLAG.Z;
    if (this.fI) p |= FLAG.I;
    if (this.fD) p |= FLAG.D;
    if (brk) p |= FLAG.B;
    if (this.fV) p |= FLAG.V;
    if (this.fN) p |= FLAG.N;
    return p;
  }

  setP(p: number): void {
    this.fC = (p & FLAG.C) !== 0;
    this.fZ = (p & FLAG.Z) !== 0;
    this.fI = (p & FLAG.I) !== 0;
    this.fD = (p & FLAG.D) !== 0;
    this.fV = (p & FLAG.V) !== 0;
    this.fN = (p & FLAG.N) !== 0;
  }

  private setZN(value: number): number {
    value &= 0xff;
    this.fZ = value === 0;
    this.fN = (value & 0x80) !== 0;
    return value;
  }

  // --- addressing ------------------------------------------------------------

  /**
   * Resolve the effective address for a memory-addressing mode, advancing PC
   * past the operand bytes. Returns the address plus whether a page boundary
   * was crossed (for the +1 cycle penalty on read instructions).
   *
   * `imm` returns the address of the immediate byte itself.
   */
  private resolve(mode: AddrMode): { addr: number; pageCrossed: boolean } {
    switch (mode) {
      case "imm": {
        const addr = this.pc;
        this.pc = (this.pc + 1) & 0xffff;
        return { addr, pageCrossed: false };
      }
      case "zp": {
        const addr = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xffff;
        return { addr, pageCrossed: false };
      }
      case "zpx": {
        const addr = (this.read(this.pc) + this.x) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        return { addr, pageCrossed: false };
      }
      case "zpy": {
        const addr = (this.read(this.pc) + this.y) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        return { addr, pageCrossed: false };
      }
      case "abs": {
        const addr = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        return { addr, pageCrossed: false };
      }
      case "abx": {
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        const addr = (base + this.x) & 0xffff;
        return { addr, pageCrossed: (base & 0xff00) !== (addr & 0xff00) };
      }
      case "aby": {
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        const addr = (base + this.y) & 0xffff;
        return { addr, pageCrossed: (base & 0xff00) !== (addr & 0xff00) };
      }
      case "ind": {
        const ptr = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        return { addr: this.read16Bug(ptr), pageCrossed: false };
      }
      case "izx": {
        const zp = (this.read(this.pc) + this.x) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        const addr = this.read(zp) | (this.read((zp + 1) & 0xff) << 8);
        return { addr, pageCrossed: false };
      }
      case "izy": {
        const zp = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xffff;
        const base = this.read(zp) | (this.read((zp + 1) & 0xff) << 8);
        const addr = (base + this.y) & 0xffff;
        return { addr, pageCrossed: (base & 0xff00) !== (addr & 0xff00) };
      }
      default:
        // imp / acc / rel are handled by the instruction directly.
        return { addr: 0, pageCrossed: false };
    }
  }

  // --- arithmetic helpers ----------------------------------------------------

  private adc(value: number): void {
    if (this.fD) {
      // Binary-coded-decimal addition (NMOS behaviour).
      let lo = (this.a & 0x0f) + (value & 0x0f) + (this.fC ? 1 : 0);
      let hi = (this.a >> 4) + (value >> 4);
      if (lo > 9) {
        lo += 6;
        hi += 1;
      }
      // V is computed before the high-nibble decimal adjust (NMOS quirk).
      this.fV =
        (~(this.a ^ value) & (this.a ^ (hi << 4)) & 0x80) !== 0;
      if (hi > 9) hi += 6;
      this.fC = hi > 15;
      const result = ((hi << 4) | (lo & 0x0f)) & 0xff;
      this.fZ = ((this.a + value + (this.fC ? 1 : 0)) & 0xff) === 0;
      this.fN = (result & 0x80) !== 0;
      this.a = result;
      return;
    }
    const sum = this.a + value + (this.fC ? 1 : 0);
    const result = sum & 0xff;
    this.fC = sum > 0xff;
    this.fV = (~(this.a ^ value) & (this.a ^ result) & 0x80) !== 0;
    this.a = this.setZN(result);
  }

  private sbc(value: number): void {
    if (this.fD) {
      const carry = this.fC ? 0 : 1;
      let lo = (this.a & 0x0f) - (value & 0x0f) - carry;
      let hi = (this.a >> 4) - (value >> 4);
      if (lo < 0) {
        lo += 10;
        hi -= 1;
      }
      if (hi < 0) hi += 10;
      const binDiff = this.a - value - carry;
      this.fC = binDiff >= 0;
      this.fV = ((this.a ^ value) & (this.a ^ (binDiff & 0xff)) & 0x80) !== 0;
      const result = ((hi << 4) | (lo & 0x0f)) & 0xff;
      this.fZ = (binDiff & 0xff) === 0;
      this.fN = (result & 0x80) !== 0;
      this.a = result;
      return;
    }
    // SBC is ADC of the one's complement.
    this.adc(value ^ 0xff);
  }

  private compare(reg: number, value: number): void {
    const diff = (reg - value) & 0x1ff;
    this.fC = reg >= value;
    this.setZN(diff & 0xff);
  }

  private branch(cond: boolean): void {
    // Operand is a signed 8-bit offset relative to the byte after it.
    const offset = (this.read(this.pc) << 24) >> 24; // sign-extend
    this.pc = (this.pc + 1) & 0xffff;
    if (cond) {
      const target = (this.pc + offset) & 0xffff;
      this.cycles += (this.pc & 0xff00) !== (target & 0xff00) ? 2 : 1;
      this.pc = target;
    }
  }

  // --- the main step ---------------------------------------------------------

  step(): void {
    if (this.halted) return;

    // easy6502 convention: $FE holds a fresh random byte each instruction.
    this.mem[0xfe] = this.rng() & 0xff;

    const opcode = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    const def: OpDef | undefined = BY_OPCODE[opcode];

    if (!def) {
      // Illegal/undocumented opcode — halt honestly rather than guess.
      this.halted = true;
      return;
    }

    this.cycles += def.cycles;
    this.execute(def);
  }

  private execute(def: OpDef): void {
    const m = def.mode;
    switch (def.mnemonic) {
      // --- load / store ---
      case "LDA": {
        const { addr, pageCrossed } = this.resolve(m);
        this.a = this.setZN(this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "LDX": {
        const { addr, pageCrossed } = this.resolve(m);
        this.x = this.setZN(this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "LDY": {
        const { addr, pageCrossed } = this.resolve(m);
        this.y = this.setZN(this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "STA": {
        const { addr } = this.resolve(m);
        this.write(addr, this.a);
        break;
      }
      case "STX": {
        const { addr } = this.resolve(m);
        this.write(addr, this.x);
        break;
      }
      case "STY": {
        const { addr } = this.resolve(m);
        this.write(addr, this.y);
        break;
      }

      // --- transfers ---
      case "TAX": this.x = this.setZN(this.a); break;
      case "TAY": this.y = this.setZN(this.a); break;
      case "TXA": this.a = this.setZN(this.x); break;
      case "TYA": this.a = this.setZN(this.y); break;
      case "TSX": this.x = this.setZN(this.sp); break;
      case "TXS": this.sp = this.x; break; // TXS does not affect flags

      // --- stack ---
      case "PHA": this.push(this.a); break;
      case "PHP": this.push(this.getP(true)); break;
      case "PLA": this.a = this.setZN(this.pop()); break;
      case "PLP": this.setP(this.pop()); break;

      // --- logic ---
      case "AND": {
        const { addr, pageCrossed } = this.resolve(m);
        this.a = this.setZN(this.a & this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "ORA": {
        const { addr, pageCrossed } = this.resolve(m);
        this.a = this.setZN(this.a | this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "EOR": {
        const { addr, pageCrossed } = this.resolve(m);
        this.a = this.setZN(this.a ^ this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "BIT": {
        const { addr } = this.resolve(m);
        const value = this.read(addr);
        this.fZ = (this.a & value) === 0;
        this.fN = (value & 0x80) !== 0;
        this.fV = (value & 0x40) !== 0;
        break;
      }

      // --- arithmetic ---
      case "ADC": {
        const { addr, pageCrossed } = this.resolve(m);
        this.adc(this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "SBC": {
        const { addr, pageCrossed } = this.resolve(m);
        this.sbc(this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "CMP": {
        const { addr, pageCrossed } = this.resolve(m);
        this.compare(this.a, this.read(addr));
        if (pageCrossed) this.cycles++;
        break;
      }
      case "CPX": {
        const { addr } = this.resolve(m);
        this.compare(this.x, this.read(addr));
        break;
      }
      case "CPY": {
        const { addr } = this.resolve(m);
        this.compare(this.y, this.read(addr));
        break;
      }

      // --- inc / dec ---
      case "INC": {
        const { addr } = this.resolve(m);
        this.write(addr, this.setZN(this.read(addr) + 1));
        break;
      }
      case "DEC": {
        const { addr } = this.resolve(m);
        this.write(addr, this.setZN(this.read(addr) - 1));
        break;
      }
      case "INX": this.x = this.setZN(this.x + 1); break;
      case "INY": this.y = this.setZN(this.y + 1); break;
      case "DEX": this.x = this.setZN(this.x - 1); break;
      case "DEY": this.y = this.setZN(this.y - 1); break;

      // --- shifts / rotates ---
      case "ASL": this.shiftOp(m, (v) => {
        this.fC = (v & 0x80) !== 0;
        return (v << 1) & 0xff;
      }); break;
      case "LSR": this.shiftOp(m, (v) => {
        this.fC = (v & 0x01) !== 0;
        return v >> 1;
      }); break;
      case "ROL": this.shiftOp(m, (v) => {
        const carryIn = this.fC ? 1 : 0;
        this.fC = (v & 0x80) !== 0;
        return ((v << 1) | carryIn) & 0xff;
      }); break;
      case "ROR": this.shiftOp(m, (v) => {
        const carryIn = this.fC ? 0x80 : 0;
        this.fC = (v & 0x01) !== 0;
        return (v >> 1) | carryIn;
      }); break;

      // --- branches ---
      case "BCC": this.branch(!this.fC); break;
      case "BCS": this.branch(this.fC); break;
      case "BEQ": this.branch(this.fZ); break;
      case "BNE": this.branch(!this.fZ); break;
      case "BMI": this.branch(this.fN); break;
      case "BPL": this.branch(!this.fN); break;
      case "BVS": this.branch(this.fV); break;
      case "BVC": this.branch(!this.fV); break;

      // --- jumps / subroutines ---
      case "JMP": {
        const { addr } = this.resolve(m);
        this.pc = addr;
        break;
      }
      case "JSR": {
        const target = this.read16(this.pc);
        const ret = (this.pc + 1) & 0xffff; // address of last operand byte
        this.push((ret >> 8) & 0xff);
        this.push(ret & 0xff);
        this.pc = target;
        break;
      }
      case "RTS": {
        const lo = this.pop();
        const hi = this.pop();
        this.pc = (((hi << 8) | lo) + 1) & 0xffff;
        break;
      }
      case "RTI": {
        this.setP(this.pop());
        const lo = this.pop();
        const hi = this.pop();
        this.pc = ((hi << 8) | lo) & 0xffff;
        break;
      }

      // --- flags ---
      case "CLC": this.fC = false; break;
      case "SEC": this.fC = true; break;
      case "CLI": this.fI = false; break;
      case "SEI": this.fI = true; break;
      case "CLD": this.fD = false; break;
      case "SED": this.fD = true; break;
      case "CLV": this.fV = false; break;

      // --- system ---
      case "NOP": break;
      case "BRK": {
        // In this teaching emulator, BRK halts the program (no IRQ handler).
        this.halted = true;
        break;
      }

      default:
        this.halted = true;
        break;
    }
  }

  private shiftOp(mode: AddrMode, fn: (v: number) => number): void {
    if (mode === "acc") {
      this.a = this.setZN(fn(this.a));
    } else {
      const { addr } = this.resolve(mode);
      this.write(addr, this.setZN(fn(this.read(addr))));
    }
  }
}
