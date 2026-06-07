/**
 * The LC-3 — the teaching computer designed by Yale Patt (UT Austin) and Sanjay
 * Patel, the ISA at the heart of EE 306 and the textbook "Introduction to
 * Computing Systems." It's the bridge from these historic machines to the way
 * architecture is taught today.
 *
 * 16-bit words, 8 general registers (R0–R7), a 16-bit PC, and N/Z/P condition
 * codes set whenever a register is written. Fifteen clean, regular opcodes. No
 * physical hardware ever existed — the LC-3 is an idealized machine built purely
 * for learning, which is exactly why it's the perfect capstone.
 *
 * Faithful to the textbook ISA. Simplifications (documented): the service traps
 * (OUT/PUTS/GETC/IN/HALT) are executed directly and do NOT clobber R7, and LEA
 * does not set condition codes (matching current LC-3 tools).
 */

export const MEM_WORDS = 0x10000;
export const DEFAULT_ORIGIN = 0x3000;

function sext(value: number, bits: number): number {
  const m = 1 << (bits - 1);
  return (value ^ m) - m;
}

export class CPU {
  mem = new Int16Array(MEM_WORDS);
  reg = new Int16Array(8);
  pc = DEFAULT_ORIGIN;
  n = false;
  z = true;
  p = false;
  halted = false;
  steps = 0;

  onPrint: ((ch: number) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    this.reg.fill(0);
    this.pc = DEFAULT_ORIGIN;
    this.n = false;
    this.z = true;
    this.p = false;
    this.halted = false;
    this.steps = 0;
  }

  private setcc(v: number): void {
    const s = (v << 16) >> 16; // as signed 16-bit
    this.n = s < 0;
    this.z = s === 0;
    this.p = s > 0;
  }

  step(): void {
    if (this.halted) return;
    const u = this.mem[this.pc] & 0xffff;
    this.pc = (this.pc + 1) & 0xffff;
    this.steps++;
    const op = (u >> 12) & 0xf;

    switch (op) {
      case 0b0001: { // ADD
        const dr = (u >> 9) & 7;
        const sr1 = (u >> 6) & 7;
        const b = (u >> 5) & 1 ? sext(u & 0x1f, 5) : this.reg[u & 7];
        this.reg[dr] = this.reg[sr1] + b;
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b0101: { // AND
        const dr = (u >> 9) & 7;
        const sr1 = (u >> 6) & 7;
        const b = (u >> 5) & 1 ? sext(u & 0x1f, 5) : this.reg[u & 7];
        this.reg[dr] = this.reg[sr1] & b;
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b1001: { // NOT
        const dr = (u >> 9) & 7;
        const sr = (u >> 6) & 7;
        this.reg[dr] = ~this.reg[sr];
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b0000: { // BR
        const nn = (u >> 11) & 1, zz = (u >> 10) & 1, pp = (u >> 9) & 1;
        if ((nn && this.n) || (zz && this.z) || (pp && this.p)) {
          this.pc = (this.pc + sext(u & 0x1ff, 9)) & 0xffff;
        }
        break;
      }
      case 0b1100: // JMP / RET
        this.pc = this.reg[(u >> 6) & 7] & 0xffff;
        break;
      case 0b0100: { // JSR / JSRR
        const temp = this.pc;
        if ((u >> 11) & 1) this.pc = (this.pc + sext(u & 0x7ff, 11)) & 0xffff;
        else this.pc = this.reg[(u >> 6) & 7] & 0xffff;
        this.reg[7] = temp;
        break;
      }
      case 0b0010: { // LD
        const dr = (u >> 9) & 7;
        const ea = (this.pc + sext(u & 0x1ff, 9)) & 0xffff;
        this.reg[dr] = this.mem[ea];
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b1010: { // LDI
        const dr = (u >> 9) & 7;
        const ea = this.mem[(this.pc + sext(u & 0x1ff, 9)) & 0xffff] & 0xffff;
        this.reg[dr] = this.mem[ea];
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b0110: { // LDR
        const dr = (u >> 9) & 7;
        const base = (u >> 6) & 7;
        const ea = (this.reg[base] + sext(u & 0x3f, 6)) & 0xffff;
        this.reg[dr] = this.mem[ea];
        this.setcc(this.reg[dr]);
        break;
      }
      case 0b1110: { // LEA (no CC, per current spec)
        const dr = (u >> 9) & 7;
        this.reg[dr] = (this.pc + sext(u & 0x1ff, 9)) & 0xffff;
        break;
      }
      case 0b0011: { // ST
        const sr = (u >> 9) & 7;
        const ea = (this.pc + sext(u & 0x1ff, 9)) & 0xffff;
        this.mem[ea] = this.reg[sr];
        break;
      }
      case 0b1011: { // STI
        const sr = (u >> 9) & 7;
        const ea = this.mem[(this.pc + sext(u & 0x1ff, 9)) & 0xffff] & 0xffff;
        this.mem[ea] = this.reg[sr];
        break;
      }
      case 0b0111: { // STR
        const sr = (u >> 9) & 7;
        const base = (u >> 6) & 7;
        const ea = (this.reg[base] + sext(u & 0x3f, 6)) & 0xffff;
        this.mem[ea] = this.reg[sr];
        break;
      }
      case 0b1111: // TRAP
        this.trap(u & 0xff);
        break;
      default: // RTI (8) and anything else: unsupported -> halt
        this.halted = true;
        break;
    }
  }

  private trap(vec: number): void {
    switch (vec) {
      case 0x20: // GETC — no input available in this model
      case 0x23: // IN
        this.reg[0] = 0;
        break;
      case 0x21: // OUT
        this.onPrint?.(this.reg[0] & 0xff);
        break;
      case 0x22: { // PUTS — print zero-terminated string at R0
        let a = this.reg[0] & 0xffff;
        let guard = 0;
        while ((this.mem[a] & 0xffff) !== 0 && guard++ < 0x10000) {
          this.onPrint?.(this.mem[a] & 0xff);
          a = (a + 1) & 0xffff;
        }
        break;
      }
      case 0x25: // HALT
        this.halted = true;
        break;
      default:
        break;
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
