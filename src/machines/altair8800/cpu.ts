/**
 * Intel 8080 CPU (the brain of the Altair 8800, 1974) — a faithful subset.
 *
 * The 8080 is where the microprocessor grows up: seven 8-bit registers
 * (A, B, C, D, E, H, L) that pair up into 16-bit BC/DE/HL, a real stack with
 * CALL/RET, five condition flags, and memory-mapped everything. The Altair 8800
 * built around it — a $439 mail-order kit on the cover of Popular Electronics in
 * January 1975 — kicked off the personal-computer era (and Microsoft, whose
 * first product was Altair BASIC).
 *
 * Implemented: MOV/MVI/LXI, the 8 ALU ops (reg + immediate), INR/DCR/INX/DCX/
 * DAD, jumps/calls/returns (incl. conditional), PUSH/POP, LDA/STA/LDAX/STAX,
 * OUT/IN, rotates, and the flag ops. Output (OUT) prints the accumulator as a
 * character, standing in for a serial terminal.
 */

export const MEM_SIZE = 0x10000;

// Register file indices match the 8080 encoding: B C D E H L (M) A.
const B = 0, C = 1, D = 2, E = 3, H = 4, L = 5, A = 7;

export class CPU {
  mem = new Uint8Array(MEM_SIZE);
  r = new Uint8Array(8); // B,C,D,E,H,L,(unused 6),A
  sp = 0xffff;
  pc = 0;
  fZ = false;
  fS = false;
  fP = false;
  fCY = false;
  fAC = false;
  halted = false;
  steps = 0;

  onPrint: ((ch: number) => void) | null = null;
  onWrite: ((addr: number, value: number) => void) | null = null;

  reset(): void {
    this.mem.fill(0);
    this.r.fill(0);
    this.sp = 0xffff;
    this.pc = 0;
    this.fZ = this.fS = this.fP = this.fCY = this.fAC = false;
    this.halted = false;
    this.steps = 0;
  }

  get hl(): number { return (this.r[H] << 8) | this.r[L]; }
  get a(): number { return this.r[A]; }

  // --- register / memory access (index 6 == memory at HL) ---
  private getReg(i: number): number {
    return i === 6 ? this.mem[this.hl] : this.r[i];
  }
  private setReg(i: number, v: number): void {
    v &= 0xff;
    if (i === 6) this.write(this.hl, v);
    else this.r[i] = v;
  }
  private write(addr: number, v: number): void {
    addr &= 0xffff;
    this.mem[addr] = v & 0xff;
    this.onWrite?.(addr, v & 0xff);
  }

  private pair(rp: number): number {
    switch (rp) {
      case 0: return (this.r[B] << 8) | this.r[C];
      case 1: return (this.r[D] << 8) | this.r[E];
      case 2: return this.hl;
      default: return this.sp;
    }
  }
  private setPair(rp: number, v: number): void {
    v &= 0xffff;
    switch (rp) {
      case 0: this.r[B] = v >> 8; this.r[C] = v & 0xff; break;
      case 1: this.r[D] = v >> 8; this.r[E] = v & 0xff; break;
      case 2: this.r[H] = v >> 8; this.r[L] = v & 0xff; break;
      default: this.sp = v; break;
    }
  }

  // --- flags ---
  private static parity(v: number): boolean {
    v &= 0xff;
    let p = 0;
    while (v) { p ^= v & 1; v >>= 1; }
    return p === 0; // even parity -> flag set
  }
  private setSZP(v: number): void {
    v &= 0xff;
    this.fZ = v === 0;
    this.fS = (v & 0x80) !== 0;
    this.fP = CPU.parity(v);
  }

  private add(b: number, carry: number): void {
    const a = this.r[A];
    const res = a + b + carry;
    this.fCY = res > 0xff;
    this.fAC = ((a & 0xf) + (b & 0xf) + carry) > 0xf;
    this.r[A] = res & 0xff;
    this.setSZP(this.r[A]);
  }
  private sub(b: number, borrow: number, store: boolean): void {
    const a = this.r[A];
    const res = a - b - borrow;
    this.fCY = res < 0;
    this.fAC = (a & 0xf) - (b & 0xf) - borrow >= 0;
    const r8 = res & 0xff;
    this.setSZP(r8);
    if (store) this.r[A] = r8; // CMP/CPI compare only
  }
  private logic(v: number, op: "and" | "xor" | "or"): void {
    let r = this.r[A];
    if (op === "and") r &= v;
    else if (op === "xor") r ^= v;
    else r |= v;
    this.r[A] = r & 0xff;
    this.fCY = false;
    this.fAC = false;
    this.setSZP(this.r[A]);
  }
  private alu(group: number, v: number): void {
    switch (group) {
      case 0: this.add(v, 0); break; // ADD
      case 1: this.add(v, this.fCY ? 1 : 0); break; // ADC
      case 2: this.sub(v, 0, true); break; // SUB
      case 3: this.sub(v, this.fCY ? 1 : 0, true); break; // SBB
      case 4: this.logic(v, "and"); break; // ANA
      case 5: this.logic(v, "xor"); break; // XRA
      case 6: this.logic(v, "or"); break; // ORA
      case 7: this.sub(v, 0, false); break; // CMP
    }
  }

  private testCC(cc: number): boolean {
    switch (cc) {
      case 0: return !this.fZ; // NZ
      case 1: return this.fZ; // Z
      case 2: return !this.fCY; // NC
      case 3: return this.fCY; // C
      case 4: return !this.fP; // PO
      case 5: return this.fP; // PE
      case 6: return !this.fS; // P
      default: return this.fS; // M
    }
  }

  private next8(): number {
    const v = this.mem[this.pc];
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }
  private next16(): number {
    const lo = this.next8();
    const hi = this.next8();
    return lo | (hi << 8);
  }
  private push16(v: number): void {
    this.sp = (this.sp - 1) & 0xffff;
    this.write(this.sp, (v >> 8) & 0xff);
    this.sp = (this.sp - 1) & 0xffff;
    this.write(this.sp, v & 0xff);
  }
  private pop16(): number {
    const lo = this.mem[this.sp];
    this.sp = (this.sp + 1) & 0xffff;
    const hi = this.mem[this.sp];
    this.sp = (this.sp + 1) & 0xffff;
    return lo | (hi << 8);
  }

  private getPSW(): number {
    let f = 0x02; // bit1 always 1
    if (this.fCY) f |= 0x01;
    if (this.fP) f |= 0x04;
    if (this.fAC) f |= 0x10;
    if (this.fZ) f |= 0x40;
    if (this.fS) f |= 0x80;
    return (this.r[A] << 8) | f;
  }
  private setPSW(v: number): void {
    this.r[A] = (v >> 8) & 0xff;
    const f = v & 0xff;
    this.fCY = (f & 0x01) !== 0;
    this.fP = (f & 0x04) !== 0;
    this.fAC = (f & 0x10) !== 0;
    this.fZ = (f & 0x40) !== 0;
    this.fS = (f & 0x80) !== 0;
  }

  step(): void {
    if (this.halted) return;
    const op = this.next8();
    this.steps++;

    // MOV (0x40-0x7F), except 0x76 = HLT
    if (op >= 0x40 && op <= 0x7f) {
      if (op === 0x76) { this.halted = true; return; }
      const dst = (op >> 3) & 7;
      const src = op & 7;
      this.setReg(dst, this.getReg(src));
      return;
    }
    // ALU register ops (0x80-0xBF)
    if (op >= 0x80 && op <= 0xbf) {
      this.alu((op >> 3) & 7, this.getReg(op & 7));
      return;
    }

    switch (op) {
      case 0x00: break; // NOP
      // MVI r,d8
      case 0x06: case 0x0e: case 0x16: case 0x1e:
      case 0x26: case 0x2e: case 0x36: case 0x3e:
        this.setReg((op >> 3) & 7, this.next8());
        break;
      // LXI rp,d16
      case 0x01: this.setPair(0, this.next16()); break;
      case 0x11: this.setPair(1, this.next16()); break;
      case 0x21: this.setPair(2, this.next16()); break;
      case 0x31: this.setPair(3, this.next16()); break;
      // INR / DCR (flags except CY)
      case 0x04: case 0x0c: case 0x14: case 0x1c:
      case 0x24: case 0x2c: case 0x34: case 0x3c: {
        const i = (op >> 3) & 7;
        const v = (this.getReg(i) + 1) & 0xff;
        this.fAC = (this.getReg(i) & 0xf) === 0xf;
        this.setReg(i, v);
        this.setSZP(v);
        break;
      }
      case 0x05: case 0x0d: case 0x15: case 0x1d:
      case 0x25: case 0x2d: case 0x35: case 0x3d: {
        const i = (op >> 3) & 7;
        const v = (this.getReg(i) - 1) & 0xff;
        this.setReg(i, v);
        this.setSZP(v);
        break;
      }
      // INX / DCX
      case 0x03: this.setPair(0, this.pair(0) + 1); break;
      case 0x13: this.setPair(1, this.pair(1) + 1); break;
      case 0x23: this.setPair(2, this.pair(2) + 1); break;
      case 0x33: this.sp = (this.sp + 1) & 0xffff; break;
      case 0x0b: this.setPair(0, this.pair(0) - 1); break;
      case 0x1b: this.setPair(1, this.pair(1) - 1); break;
      case 0x2b: this.setPair(2, this.pair(2) - 1); break;
      case 0x3b: this.sp = (this.sp - 1) & 0xffff; break;
      // DAD rp -> HL += rp (CY only)
      case 0x09: case 0x19: case 0x29: case 0x39: {
        const rp = (op >> 4) & 3;
        const res = this.hl + this.pair(rp);
        this.fCY = res > 0xffff;
        this.setPair(2, res & 0xffff);
        break;
      }
      // immediate ALU
      case 0xc6: this.alu(0, this.next8()); break;
      case 0xce: this.alu(1, this.next8()); break;
      case 0xd6: this.alu(2, this.next8()); break;
      case 0xde: this.alu(3, this.next8()); break;
      case 0xe6: this.alu(4, this.next8()); break;
      case 0xee: this.alu(5, this.next8()); break;
      case 0xf6: this.alu(6, this.next8()); break;
      case 0xfe: this.alu(7, this.next8()); break;
      // jumps
      case 0xc3: this.pc = this.next16(); break;
      case 0xc2: case 0xca: case 0xd2: case 0xda:
      case 0xe2: case 0xea: case 0xf2: case 0xfa: {
        const t = this.next16();
        if (this.testCC((op >> 3) & 7)) this.pc = t;
        break;
      }
      // calls
      case 0xcd: { const t = this.next16(); this.push16(this.pc); this.pc = t; break; }
      case 0xc4: case 0xcc: case 0xd4: case 0xdc:
      case 0xe4: case 0xec: case 0xf4: case 0xfc: {
        const t = this.next16();
        if (this.testCC((op >> 3) & 7)) { this.push16(this.pc); this.pc = t; }
        break;
      }
      // returns
      case 0xc9: this.pc = this.pop16(); break;
      case 0xc0: case 0xc8: case 0xd0: case 0xd8:
      case 0xe0: case 0xe8: case 0xf0: case 0xf8:
        if (this.testCC((op >> 3) & 7)) this.pc = this.pop16();
        break;
      // stack
      case 0xc5: this.push16(this.pair(0)); break;
      case 0xd5: this.push16(this.pair(1)); break;
      case 0xe5: this.push16(this.hl); break;
      case 0xf5: this.push16(this.getPSW()); break;
      case 0xc1: this.setPair(0, this.pop16()); break;
      case 0xd1: this.setPair(1, this.pop16()); break;
      case 0xe1: this.setPair(2, this.pop16()); break;
      case 0xf1: this.setPSW(this.pop16()); break;
      // direct memory
      case 0x3a: this.r[A] = this.mem[this.next16()]; break; // LDA
      case 0x32: this.write(this.next16(), this.r[A]); break; // STA
      case 0x2a: { const ad = this.next16(); this.r[L] = this.mem[ad]; this.r[H] = this.mem[(ad + 1) & 0xffff]; break; } // LHLD
      case 0x22: { const ad = this.next16(); this.write(ad, this.r[L]); this.write((ad + 1) & 0xffff, this.r[H]); break; } // SHLD
      case 0x0a: this.r[A] = this.mem[this.pair(0)]; break; // LDAX B
      case 0x1a: this.r[A] = this.mem[this.pair(1)]; break; // LDAX D
      case 0x02: this.write(this.pair(0), this.r[A]); break; // STAX B
      case 0x12: this.write(this.pair(1), this.r[A]); break; // STAX D
      // I/O
      case 0xd3: { this.next8(); this.onPrint?.(this.r[A] & 0xff); break; } // OUT port
      case 0xdb: { this.next8(); this.r[A] = 0; break; } // IN port (no input)
      // misc
      case 0xeb: { // XCHG
        const t1 = this.r[H], t2 = this.r[L];
        this.r[H] = this.r[D]; this.r[L] = this.r[E];
        this.r[D] = t1; this.r[E] = t2;
        break;
      }
      case 0x2f: this.r[A] = ~this.r[A] & 0xff; break; // CMA
      case 0x37: this.fCY = true; break; // STC
      case 0x3f: this.fCY = !this.fCY; break; // CMC
      case 0x07: { const a = this.r[A]; this.fCY = (a & 0x80) !== 0; this.r[A] = ((a << 1) | (a >> 7)) & 0xff; break; } // RLC
      case 0x0f: { const a = this.r[A]; this.fCY = (a & 1) !== 0; this.r[A] = ((a >> 1) | (a << 7)) & 0xff; break; } // RRC
      case 0xf3: case 0xfb: break; // DI / EI (no interrupts modelled)
      default:
        // Unsupported opcode — halt honestly.
        this.halted = true;
        break;
    }
  }

  run(maxSteps = 1_000_000): void {
    let i = 0;
    while (!this.halted && i < maxSteps) { this.step(); i++; }
    if (!this.halted && i >= maxSteps) this.halted = true;
  }
}
