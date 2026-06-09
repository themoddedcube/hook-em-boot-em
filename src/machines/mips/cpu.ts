/**
 * A teaching-grade MIPS CPU, in the spirit of the textbook subsets used by
 * SPIM and MARS. This is the architecture inside the Nintendo 64's R4300i,
 * and the same family that ran Unix workstations through the 90s.
 *
 * 32-bit registers, 32 of them ($0–$31), with $0 hardwired to zero. Big-endian
 * by historical convention but not user-visible here (we operate on 32-bit
 * words via DataView).
 *
 * Implemented (a textbook teaching subset):
 *   R-type: ADD SUB AND OR XOR SLT SLL SRL JR
 *   I-type: ADDI ANDI ORI LW SW LUI BEQ BNE SLTI
 *   J-type: J JAL
 *   syscall: MARS/SPIM convention ($v0 = 1 print int, 4 print string,
 *            10 exit; $a0 = arg)
 *
 * Faithful enough for teaching; simplified by omitting branch delay slots,
 * hi/lo for mult/div, and the system coprocessor.
 */

export const MEM_BYTES = 1 << 16; // 64 KB, enough for the teaching programs
export const TEXT_BASE = 0x0400; // .text loads here
export const DATA_BASE = 0x1000; // .data loads here

// Conventional MIPS register names → numbers.
// Used by the assembler; the CPU itself only cares about the numbers.
export const REG_NAMES: Record<string, number> = {
  $zero: 0, $0: 0,
  $at: 1, $1: 1,
  $v0: 2, $2: 2, $v1: 3, $3: 3,
  $a0: 4, $4: 4, $a1: 5, $5: 5, $a2: 6, $6: 6, $a3: 7, $7: 7,
  $t0: 8, $8: 8, $t1: 9, $9: 9, $t2: 10, $10: 10, $t3: 11, $11: 11,
  $t4: 12, $12: 12, $t5: 13, $13: 13, $t6: 14, $14: 14, $t7: 15, $15: 15,
  $s0: 16, $16: 16, $s1: 17, $17: 17, $s2: 18, $18: 18, $s3: 19, $19: 19,
  $s4: 20, $20: 20, $s5: 21, $21: 21, $s6: 22, $22: 22, $s7: 23, $23: 23,
  $t8: 24, $24: 24, $t9: 25, $25: 25,
  $k0: 26, $26: 26, $k1: 27, $27: 27,
  $gp: 28, $28: 28,
  $sp: 29, $29: 29,
  $fp: 30, $30: 30,
  $ra: 31, $31: 31,
};

export class CPU {
  /** Memory, byte-addressed. */
  mem = new Uint8Array(MEM_BYTES);
  /** 32 GP registers, signed 32-bit (use Int32Array so arithmetic is signed). */
  reg = new Int32Array(32);
  pc = TEXT_BASE;
  halted = false;
  steps = 0;

  onPrint: ((s: string) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    this.reg.fill(0);
    this.pc = TEXT_BASE;
    this.halted = false;
    this.steps = 0;
  }

  // --- memory helpers (32-bit, little-endian for predictable byte access) ---

  private view(): DataView {
    return new DataView(this.mem.buffer);
  }
  read32(addr: number): number {
    return this.view().getInt32(addr & 0xffff, true);
  }
  write32(addr: number, value: number): void {
    this.view().setInt32(addr & 0xffff, value | 0, true);
  }

  /** $0 is hardwired to zero; writes are silently ignored. */
  private set(rd: number, value: number): void {
    if (rd !== 0) this.reg[rd] = value | 0;
  }

  step(): void {
    if (this.halted) return;
    const instr = this.read32(this.pc) >>> 0;
    this.pc = (this.pc + 4) & 0xffff;
    this.steps++;

    const op = (instr >>> 26) & 0x3f;
    const rs = (instr >>> 21) & 0x1f;
    const rt = (instr >>> 16) & 0x1f;
    const rd = (instr >>> 11) & 0x1f;
    const shamt = (instr >>> 6) & 0x1f;
    const funct = instr & 0x3f;
    const imm16 = instr & 0xffff;
    const sImm = (imm16 << 16) >> 16; // sign-extended
    const target = instr & 0x03ffffff;

    if (op === 0x00) {
      // R-type
      switch (funct) {
        case 0x20: this.set(rd, this.reg[rs] + this.reg[rt]); break;            // ADD
        case 0x22: this.set(rd, this.reg[rs] - this.reg[rt]); break;            // SUB
        case 0x24: this.set(rd, this.reg[rs] & this.reg[rt]); break;            // AND
        case 0x25: this.set(rd, this.reg[rs] | this.reg[rt]); break;            // OR
        case 0x26: this.set(rd, this.reg[rs] ^ this.reg[rt]); break;            // XOR
        case 0x2a: this.set(rd, this.reg[rs] < this.reg[rt] ? 1 : 0); break;    // SLT
        case 0x00: this.set(rd, (this.reg[rt] << shamt) | 0); break;            // SLL
        case 0x02: this.set(rd, this.reg[rt] >>> shamt); break;                 // SRL
        case 0x0c: this.syscall(); break;                                       // SYSCALL
        case 0x08: this.pc = this.reg[rs] & 0xffff; break;                      // JR
        default: this.halted = true; break;
      }
      return;
    }

    switch (op) {
      case 0x08: this.set(rt, this.reg[rs] + sImm); break;                      // ADDI
      case 0x0c: this.set(rt, this.reg[rs] & imm16); break;                     // ANDI (zero-ext)
      case 0x0d: this.set(rt, this.reg[rs] | imm16); break;                     // ORI  (zero-ext)
      case 0x0a: this.set(rt, this.reg[rs] < sImm ? 1 : 0); break;              // SLTI
      case 0x0f: this.set(rt, (imm16 << 16) | 0); break;                        // LUI
      case 0x23: this.set(rt, this.read32(this.reg[rs] + sImm)); break;         // LW
      case 0x2b: this.write32(this.reg[rs] + sImm, this.reg[rt]); break;        // SW
      case 0x04: if (this.reg[rs] === this.reg[rt]) this.pc = (this.pc + (sImm << 2)) & 0xffff; break; // BEQ
      case 0x05: if (this.reg[rs] !== this.reg[rt]) this.pc = (this.pc + (sImm << 2)) & 0xffff; break; // BNE
      case 0x02: this.pc = ((this.pc & 0xf0000000) | (target << 2)) & 0xffff; break; // J
      case 0x03: this.set(31, this.pc); this.pc = ((this.pc & 0xf0000000) | (target << 2)) & 0xffff; break; // JAL
      default: this.halted = true; break;
    }
  }

  /** MARS/SPIM-style syscall: $v0 selects the service, $a0 carries the arg. */
  private syscall(): void {
    const v0 = this.reg[REG_NAMES.$v0];
    const a0 = this.reg[REG_NAMES.$a0];
    switch (v0) {
      case 1: this.onPrint?.(String(a0)); break;                  // print int
      case 4: { // print string at $a0
        let addr = a0 & 0xffff;
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
      case 10: this.halted = true; break;                         // exit
      case 11: this.onPrint?.(String.fromCharCode(a0 & 0xff)); break; // print char
      default: break;
    }
  }

  run(maxSteps = 1_000_000): void {
    let i = 0;
    while (!this.halted && i < maxSteps) {
      this.step();
      i++;
    }
    if (!this.halted && i >= maxSteps) this.halted = true;
  }
}
