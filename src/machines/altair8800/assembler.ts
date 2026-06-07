/**
 * An Intel 8080 assembler (classic Intel mnemonics), a practical subset.
 *
 *   - Labels:   `LABEL:`
 *   - Origin:   `ORG 100`     (default 0)
 *   - Data:     `DB 1, 2, 'A'`
 *   - Numbers:  decimal, `0xFF`/`$FF`/`0FFH` (hex), `'A'` (char)
 *   - Comments: `;`
 *
 * Registers B C D E H L M A; pairs B D H SP (and PSW for PUSH/POP).
 */

import { AsmError } from "../../engine/machineInterface";

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

const REG: Record<string, number> = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, M: 6, A: 7 };
const RP_SP: Record<string, number> = { B: 0, D: 1, H: 2, SP: 3 };
const RP_PSW: Record<string, number> = { B: 0, D: 1, H: 2, PSW: 3 };

const NO_OPERAND: Record<string, number> = {
  NOP: 0x00, HLT: 0x76, RET: 0xc9, RNZ: 0xc0, RZ: 0xc8, RNC: 0xd0, RC: 0xd8,
  RPO: 0xe0, RPE: 0xe8, RP: 0xf0, RM: 0xf8, XCHG: 0xeb, STC: 0x37, CMC: 0x3f,
  CMA: 0x2f, RLC: 0x07, RRC: 0x0f, RAL: 0x17, RAR: 0x1f, EI: 0xfb, DI: 0xf3,
  PCHL: 0xe9, SPHL: 0xf9, XTHL: 0xe3,
};
const ALU_REG: Record<string, number> = {
  ADD: 0x80, ADC: 0x88, SUB: 0x90, SBB: 0x98, ANA: 0xa0, XRA: 0xa8, ORA: 0xb0, CMP: 0xb8,
};
const ALU_IMM: Record<string, number> = {
  ADI: 0xc6, ACI: 0xce, SUI: 0xd6, SBI: 0xde, ANI: 0xe6, XRI: 0xee, ORI: 0xf6, CPI: 0xfe,
};
const JMP: Record<string, number> = {
  JMP: 0xc3, JNZ: 0xc2, JZ: 0xca, JNC: 0xd2, JC: 0xda, JPO: 0xe2, JPE: 0xea, JP: 0xf2, JM: 0xfa,
};
const CALL: Record<string, number> = {
  CALL: 0xcd, CNZ: 0xc4, CZ: 0xcc, CNC: 0xd4, CC: 0xdc, CPO: 0xe4, CPE: 0xec, CP: 0xf4, CM: 0xfc,
};
const DIRECT: Record<string, number> = { LDA: 0x3a, STA: 0x32, LHLD: 0x2a, SHLD: 0x22 };

function parseNum(tok: string): number | null {
  const t = tok.trim();
  if (t === "") return null;
  const ch = t.match(/^'(.)'$/);
  if (ch) return ch[1].charCodeAt(0);
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^\$[0-9a-f]+$/i.test(t)) return parseInt(t.slice(1), 16);
  if (/^[0-9][0-9a-f]*[hH]$/.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[01]+[bB]$/.test(t)) return parseInt(t.slice(0, -1), 2);
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

const ONE = new Set([
  ...Object.keys(NO_OPERAND), ...Object.keys(ALU_REG), "MOV", "INR", "DCR",
  "INX", "DCX", "DAD", "PUSH", "POP", "LDAX", "STAX",
]);
const TWO = new Set([...Object.keys(ALU_IMM), "MVI", "OUT", "IN"]);
const THREE = new Set([...Object.keys(JMP), ...Object.keys(CALL), ...Object.keys(DIRECT), "LXI"]);

interface Stmt { addr: number; op: string; ops: string[]; lineNo: number; }

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const symbols = new Map<string, number>();
  const stmts: Stmt[] = [];
  let lc = 0;
  let originSet = false;
  let origin = 0;
  let minAddr = Infinity, maxAddr = -Infinity;

  const lines = src.split(/\r?\n/);

  const sizeOf = (op: string, ops: string[]): number => {
    if (op === "DB") return ops.length || 1;
    if (ONE.has(op)) return 1;
    if (TWO.has(op)) return 2;
    if (THREE.has(op)) return 3;
    return 0;
  };

  // --- Pass 1 ---
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i].replace(/;.*$/, "").trim();
    if (text === "") continue;

    const lab = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (lab) {
      const key = lab[1].toUpperCase();
      if (symbols.has(key)) errors.push({ line: i + 1, message: `Duplicate label '${lab[1]}'.` });
      symbols.set(key, lc);
      text = lab[2].trim();
      if (text === "") continue;
    }

    const parts = text.split(/\s+/);
    const op = parts[0].toUpperCase();
    const rest = text.slice(text.indexOf(parts[0]) + parts[0].length).trim();
    const ops = rest ? rest.split(",").map((s) => s.trim()) : [];

    if (op === "ORG") {
      const v = parseNum(ops[0] ?? "");
      if (v === null) errors.push({ line: i + 1, message: "Bad ORG." });
      else { lc = v & 0xffff; origin = lc; originSet = true; }
      continue;
    }
    const size = sizeOf(op, ops);
    if (size === 0) { errors.push({ line: i + 1, message: `Unknown instruction '${parts[0]}'.` }); continue; }
    stmts.push({ addr: lc, op, ops, lineNo: i + 1 });
    lc = (lc + size) & 0xffff;
  }

  void originSet;
  if (errors.length) return { bytes: new Uint8Array(0), origin, errors };

  const image = new Map<number, number>();
  const emit = (addr: number, ...bytes: number[]) => {
    bytes.forEach((b, k) => {
      image.set((addr + k) & 0xffff, b & 0xff);
      minAddr = Math.min(minAddr, addr + k);
      maxAddr = Math.max(maxAddr, addr + k);
    });
  };

  const reg = (t: string, ln: number): number => {
    const r = REG[(t ?? "").toUpperCase()];
    if (r === undefined) { errors.push({ line: ln, message: `Expected register, got '${t}'.` }); return 0; }
    return r;
  };
  const rp = (t: string, table: Record<string, number>, ln: number): number => {
    const r = table[(t ?? "").toUpperCase()];
    if (r === undefined) { errors.push({ line: ln, message: `Bad register pair '${t}'.` }); return 0; }
    return r;
  };
  const val = (t: string, ln: number): number => {
    const n = parseNum(t);
    if (n !== null) return n;
    const s = symbols.get((t ?? "").toUpperCase());
    if (s === undefined) { errors.push({ line: ln, message: `Unknown symbol '${t}'.` }); return 0; }
    return s;
  };

  // --- Pass 2 ---
  for (const st of stmts) {
    const { op, ops: o, addr, lineNo: ln } = st;
    if (op === "DB") { emit(addr, ...o.map((t) => val(t, ln) & 0xff)); continue; }
    if (op in NO_OPERAND) { emit(addr, NO_OPERAND[op]); continue; }
    if (op === "MOV") { emit(addr, 0x40 | (reg(o[0], ln) << 3) | reg(o[1], ln)); continue; }
    if (op in ALU_REG) { emit(addr, ALU_REG[op] | reg(o[0], ln)); continue; }
    if (op in ALU_IMM) { emit(addr, ALU_IMM[op], val(o[0], ln) & 0xff); continue; }
    if (op === "MVI") { emit(addr, 0x06 | (reg(o[0], ln) << 3), val(o[1], ln) & 0xff); continue; }
    if (op === "LXI") { const v = val(o[1], ln) & 0xffff; emit(addr, 0x01 | (rp(o[0], RP_SP, ln) << 4), v & 0xff, v >> 8); continue; }
    if (op === "INR") { emit(addr, 0x04 | (reg(o[0], ln) << 3)); continue; }
    if (op === "DCR") { emit(addr, 0x05 | (reg(o[0], ln) << 3)); continue; }
    if (op === "INX") { emit(addr, 0x03 | (rp(o[0], RP_SP, ln) << 4)); continue; }
    if (op === "DCX") { emit(addr, 0x0b | (rp(o[0], RP_SP, ln) << 4)); continue; }
    if (op === "DAD") { emit(addr, 0x09 | (rp(o[0], RP_SP, ln) << 4)); continue; }
    if (op === "PUSH") { emit(addr, 0xc5 | (rp(o[0], RP_PSW, ln) << 4)); continue; }
    if (op === "POP") { emit(addr, 0xc1 | (rp(o[0], RP_PSW, ln) << 4)); continue; }
    if (op === "LDAX") { emit(addr, rp(o[0], RP_SP, ln) === 0 ? 0x0a : 0x1a); continue; }
    if (op === "STAX") { emit(addr, rp(o[0], RP_SP, ln) === 0 ? 0x02 : 0x12); continue; }
    if (op === "OUT") { emit(addr, 0xd3, val(o[0], ln) & 0xff); continue; }
    if (op === "IN") { emit(addr, 0xdb, val(o[0], ln) & 0xff); continue; }
    if (op in JMP) { const a = val(o[0], ln) & 0xffff; emit(addr, JMP[op], a & 0xff, a >> 8); continue; }
    if (op in CALL) { const a = val(o[0], ln) & 0xffff; emit(addr, CALL[op], a & 0xff, a >> 8); continue; }
    if (op in DIRECT) { const a = val(o[0], ln) & 0xffff; emit(addr, DIRECT[op], a & 0xff, a >> 8); continue; }
    errors.push({ line: ln, message: `Cannot encode '${op}'.` });
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin, errors };
  if (!isFinite(minAddr)) return { bytes: new Uint8Array(0), origin, errors };

  const count = maxAddr - minAddr + 1;
  const bytes = new Uint8Array(count);
  for (let a = minAddr; a <= maxAddr; a++) bytes[a - minAddr] = image.get(a) ?? 0;
  return { bytes, origin: minAddr, errors };
}
