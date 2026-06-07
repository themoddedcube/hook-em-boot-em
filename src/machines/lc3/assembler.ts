/**
 * An LC-3 assembler (the standard textbook assembly language).
 *
 * Directives: .ORIG, .END, .FILL, .BLKW, .STRINGZ
 * Numbers:    #10 (decimal), x3000 (hex), b1010 (binary)
 * Registers:  R0..R7
 * Labels:     a leading symbol that isn't an opcode/directive
 * Comments:   ; ...
 * Branches:   BR, BRn, BRz, BRp, BRnz, BRnp, BRzp, BRnzp
 * Traps:      TRAP xNN, plus GETC/OUT/PUTS/IN/PUTSP/HALT
 */

import { AsmError } from "../../engine/machineInterface";
import { DEFAULT_ORIGIN } from "./cpu";

export { DEFAULT_ORIGIN };

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

const REGS: Record<string, number> = {
  R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5, R6: 6, R7: 7,
};
const TRAPS: Record<string, number> = {
  GETC: 0x20, OUT: 0x21, PUTS: 0x22, IN: 0x23, PUTSP: 0x24, HALT: 0x25,
};
const OPCODES = new Set([
  "ADD", "AND", "NOT", "BR", "BRN", "BRZ", "BRP", "BRNZ", "BRNP", "BRZP",
  "BRNZP", "JMP", "RET", "JSR", "JSRR", "LD", "LDI", "LDR", "LEA", "ST",
  "STI", "STR", "TRAP", "RTI", "GETC", "OUT", "PUTS", "IN", "PUTSP", "HALT",
]);
const DIRECTIVES = new Set([".ORIG", ".END", ".FILL", ".BLKW", ".STRINGZ"]);

function parseLiteral(tok: string): number | null {
  const t = tok.trim();
  if (t === "") return null;
  if (t[0] === "#") {
    const v = parseInt(t.slice(1), 10);
    return Number.isNaN(v) ? null : v;
  }
  if (t[0] === "x" || t[0] === "X") {
    const v = parseInt(t.slice(1), 16);
    return Number.isNaN(v) ? null : v;
  }
  if (t[0] === "b" || t[0] === "B") {
    const v = parseInt(t.slice(1), 2);
    return Number.isNaN(v) ? null : v;
  }
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

function parseString(rest: string): number[] | null {
  const m = rest.match(/^"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  const out: number[] = [];
  const s = m[1];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      const c = s[++i];
      out.push(c === "n" ? 10 : c === "t" ? 9 : c === "0" ? 0 : c.charCodeAt(0));
    } else out.push(s.charCodeAt(i));
  }
  out.push(0);
  return out;
}

interface Stmt {
  addr: number;
  op: string;
  operands: string[];
  rawOperand: string;
  data?: number[]; // for .STRINGZ / .BLKW
  lineNo: number;
}

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const symbols = new Map<string, number>();
  const stmts: Stmt[] = [];
  let lc = -1;
  let origin = DEFAULT_ORIGIN;
  let originSet = false;

  const lines = src.split(/\r?\n/);

  // --- Pass 1: locations, labels, and data sizes. ---
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/;.*$/, "").trim();
    if (raw === "") continue;

    const tokens = raw.split(/\s+/);
    let idx = 0;
    const first = tokens[0].toUpperCase();
    if (!OPCODES.has(first) && !DIRECTIVES.has(first)) {
      const key = tokens[0].toUpperCase();
      if (symbols.has(key)) {
        errors.push({ line: i + 1, message: `Duplicate label '${tokens[0]}'.` });
      }
      symbols.set(key, lc < 0 ? origin : lc);
      idx = 1;
      if (idx >= tokens.length) continue;
    }

    const op = tokens[idx].toUpperCase();
    const rawOperand = raw
      .slice(raw.indexOf(tokens[idx]) + tokens[idx].length)
      .trim();

    if (op === ".ORIG") {
      const v = parseLiteral(tokens[idx + 1] ?? "");
      if (v === null) errors.push({ line: i + 1, message: "Bad .ORIG address." });
      else { origin = v & 0xffff; lc = origin; originSet = true; }
      continue;
    }
    if (op === ".END") break;
    if (lc < 0) { errors.push({ line: i + 1, message: "Code before .ORIG." }); continue; }

    if (op === ".STRINGZ") {
      const data = parseString(rawOperand);
      if (!data) { errors.push({ line: i + 1, message: "Bad .STRINGZ literal." }); continue; }
      stmts.push({ addr: lc, op, operands: [], rawOperand, data, lineNo: i + 1 });
      lc = (lc + data.length) & 0xffff;
      continue;
    }
    if (op === ".BLKW") {
      const n = parseLiteral(tokens[idx + 1] ?? "");
      if (n === null || n < 0) { errors.push({ line: i + 1, message: "Bad .BLKW count." }); continue; }
      stmts.push({ addr: lc, op, operands: [], rawOperand, data: new Array(n).fill(0), lineNo: i + 1 });
      lc = (lc + n) & 0xffff;
      continue;
    }
    if (op === ".FILL") {
      stmts.push({ addr: lc, op, operands: [rawOperand], rawOperand, lineNo: i + 1 });
      lc = (lc + 1) & 0xffff;
      continue;
    }
    if (!OPCODES.has(op)) {
      errors.push({ line: i + 1, message: `Unknown instruction '${tokens[idx]}'.` });
      continue;
    }

    const operands = rawOperand ? rawOperand.split(",").map((s) => s.trim()) : [];
    stmts.push({ addr: lc, op, operands, rawOperand, lineNo: i + 1 });
    lc = (lc + 1) & 0xffff;
  }

  if (!originSet) errors.push({ line: 1, message: "Program needs a .ORIG directive." });
  if (errors.length) return { bytes: new Uint8Array(0), origin, errors };

  const image = new Map<number, number>();
  let minAddr = Infinity;
  let maxAddr = -Infinity;
  const emit = (addr: number, word: number) => {
    image.set(addr & 0xffff, word & 0xffff);
    minAddr = Math.min(minAddr, addr);
    maxAddr = Math.max(maxAddr, addr);
  };

  const reg = (tok: string, ln: number): number => {
    const r = REGS[(tok ?? "").toUpperCase()];
    if (r === undefined) {
      errors.push({ line: ln, message: `Expected a register (R0–R7), got '${tok}'.` });
      return 0;
    }
    return r;
  };
  const value = (tok: string, ln: number): number => {
    const lit = parseLiteral(tok);
    if (lit !== null) return lit;
    const v = symbols.get((tok ?? "").toUpperCase());
    if (v === undefined) { errors.push({ line: ln, message: `Unknown symbol '${tok}'.` }); return 0; }
    return v;
  };
  const pcoffset = (target: number, addr: number, bits: number, ln: number): number => {
    const off = target - ((addr + 1) & 0xffff);
    const lim = 1 << (bits - 1);
    if (off < -lim || off >= lim) {
      errors.push({ line: ln, message: `Target too far for a ${bits}-bit offset (${off}).` });
      return 0;
    }
    return off & ((1 << bits) - 1);
  };

  // --- Pass 2: encode. ---
  for (const st of stmts) {
    const { op, operands: o, addr, lineNo: ln } = st;

    if (op === ".FILL") { emit(addr, value(st.rawOperand, ln) & 0xffff); continue; }
    if (op === ".STRINGZ" || op === ".BLKW") {
      st.data!.forEach((w, k) => emit((addr + k) & 0xffff, w));
      continue;
    }
    if (op === "ADD" || op === "AND") {
      const base = op === "ADD" ? 0x1000 : 0x5000;
      const dr = reg(o[0], ln), sr1 = reg(o[1], ln), third = o[2] ?? "";
      if (/^R[0-7]$/i.test(third)) emit(addr, base | (dr << 9) | (sr1 << 6) | reg(third, ln));
      else emit(addr, base | (dr << 9) | (sr1 << 6) | 0x20 | (value(third, ln) & 0x1f));
      continue;
    }
    if (op === "NOT") { emit(addr, 0x9000 | (reg(o[0], ln) << 9) | (reg(o[1], ln) << 6) | 0x3f); continue; }
    if (op.startsWith("BR")) {
      const flags = op.slice(2) || "NZP";
      const nzp = (flags.includes("N") ? 4 : 0) | (flags.includes("Z") ? 2 : 0) | (flags.includes("P") ? 1 : 0);
      emit(addr, (nzp << 9) | pcoffset(value(o[0], ln), addr, 9, ln));
      continue;
    }
    if (op === "JMP") { emit(addr, 0xc000 | (reg(o[0], ln) << 6)); continue; }
    if (op === "RET") { emit(addr, 0xc000 | (7 << 6)); continue; }
    if (op === "JSR") { emit(addr, 0x4000 | 0x800 | pcoffset(value(o[0], ln), addr, 11, ln)); continue; }
    if (op === "JSRR") { emit(addr, 0x4000 | (reg(o[0], ln) << 6)); continue; }
    if (op === "LD" || op === "LDI" || op === "LEA" || op === "ST" || op === "STI") {
      const code = { LD: 0x2000, LDI: 0xa000, LEA: 0xe000, ST: 0x3000, STI: 0xb000 }[op]!;
      emit(addr, code | (reg(o[0], ln) << 9) | pcoffset(value(o[1], ln), addr, 9, ln));
      continue;
    }
    if (op === "LDR" || op === "STR") {
      const code = op === "LDR" ? 0x6000 : 0x7000;
      emit(addr, code | (reg(o[0], ln) << 9) | (reg(o[1], ln) << 6) | (value(o[2], ln) & 0x3f));
      continue;
    }
    if (op === "TRAP") { emit(addr, 0xf000 | (value(o[0], ln) & 0xff)); continue; }
    if (op in TRAPS) { emit(addr, 0xf000 | TRAPS[op]); continue; }
    if (op === "RTI") { emit(addr, 0x8000); continue; }

    errors.push({ line: ln, message: `Cannot encode '${op}'.` });
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin, errors };
  if (!isFinite(minAddr)) return { bytes: new Uint8Array(0), origin, errors };

  const count = maxAddr - minAddr + 1;
  const bytes = new Uint8Array(count * 2);
  const view = new DataView(bytes.buffer);
  for (let a = minAddr; a <= maxAddr; a++) {
    view.setUint16((a - minAddr) * 2, image.get(a) ?? 0, true);
  }
  return { bytes, origin: minAddr, errors };
}
