/**
 * A small ARM64-flavored teaching assembler. The syntax matches what students
 * would see in a real AArch64 disassembly: 'mov x0, #5', 'cmp x1, x2',
 * 'b.ne loop', 'bl func', 'svc #0', '.asciz "hi"'.
 *
 * The wire format it emits is our private 32-bit teaching bytecode (see
 * cpu.ts), not real ARM machine code. The goal is recognition of the syntax
 * and the architectural patterns (load/store, condition codes, BL/RET), not
 * bit-exact encoding.
 *
 * Sections:    `.text`, `.data`
 * Data:        `.word N`, `.asciz "..."`
 * Labels:      `name:`
 * Numbers:     `#42`, `#0x2a`, `#-3`, `42` (the # is optional)
 */

import { AsmError } from "../../engine/machineInterface";
import { DATA_BASE, MEM_BYTES, OP, REG_NAMES, TEXT_BASE } from "./cpu";

export { TEXT_BASE };

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

interface SymbolTable {
  text: Map<string, number>;
  data: Map<string, number>;
}

function parseNumber(tok: string): number | null {
  let t = (tok ?? "").trim();
  if (t === "") return null;
  if (t.startsWith("#")) t = t.slice(1).trim();
  const ch = t.match(/^'(.)'$/);
  if (ch) return ch[1].charCodeAt(0);
  if (/^-?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^-?0b[01]+$/i.test(t)) return parseInt(t.replace(/^(-?)0b/i, "$1"), 2);
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

function isImmediate(tok: string): boolean {
  return tok.trim().startsWith("#") || /^-?\d/.test(tok.trim()) || /^-?0x/i.test(tok.trim());
}

function regNum(tok: string, ln: number, errs: AsmError[]): number {
  const n = REG_NAMES[(tok ?? "").trim().toLowerCase()];
  if (n === undefined) {
    errs.push({ line: ln, message: `Unknown register '${tok}'.` });
    return 0;
  }
  return n;
}

function resolveValue(tok: string, sym: SymbolTable, ln: number, errs: AsmError[]): number {
  const v = parseNumber(tok);
  if (v !== null) return v;
  const t = tok.trim();
  if (sym.data.has(t)) return sym.data.get(t)!;
  if (sym.text.has(t)) return sym.text.get(t)!;
  errs.push({ line: ln, message: `Unknown symbol '${t}'.` });
  return 0;
}

/** "[x1]" or "[x1, #4]" → { base, off } */
function parseMemRef(tok: string, ln: number, errs: AsmError[]) {
  const t = tok.trim();
  const m = t.match(/^\[\s*(x\d+|sp|lr)\s*(?:,\s*#?(-?\w+))?\s*\]$/i);
  if (!m) {
    errs.push({ line: ln, message: `Bad memory operand '${tok}', expected [reg] or [reg, #imm].` });
    return { base: 0, off: 0 };
  }
  const base = regNum(m[1], ln, errs);
  const offBytes = m[2] ? (parseNumber("#" + m[2]) ?? 0) : 0;
  return { base, off: offBytes / 4 }; // bytecode encodes offset in 4-byte words
}

/** Pack our private 32-bit instruction: [op][a][b][c]. */
const enc4 = (op: number, a: number, b: number, c: number): number =>
  ((op & 0xff) << 24) | ((a & 0xff) << 16) | ((b & 0xff) << 8) | (c & 0xff);

/** Pack op + dst + 16-bit signed immediate in the low half. */
const encImm16 = (op: number, dst: number, imm: number): number =>
  ((op & 0xff) << 24) | ((dst & 0xff) << 16) | (imm & 0xffff);

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const sym: SymbolTable = { text: new Map(), data: new Map() };

  type Line = { lineNo: number; section: "text" | "data"; label: string | null; body: string };
  const lines: Line[] = [];
  let section: "text" | "data" = "text";
  const raw = src.split(/\r?\n/);
  for (let i = 0; i < raw.length; i++) {
    let text = raw[i].replace(/\/\/.*$|;.*$/, "").trim();
    if (text === "") continue;
    if (text === ".text") { section = "text"; continue; }
    if (text === ".data") { section = "data"; continue; }
    let m: RegExpMatchArray | null;
    while ((m = text.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/))) {
      lines.push({ lineNo: i + 1, section, label: m[1], body: "" });
      text = m[2];
      if (text === "") break;
    }
    if (text !== "") lines.push({ lineNo: i + 1, section, label: null, body: text });
  }

  // Pass 1: addresses
  let textPc = TEXT_BASE;
  let dataPc = DATA_BASE;
  for (const ln of lines) {
    if (ln.label) {
      if (ln.section === "text") sym.text.set(ln.label, textPc);
      else sym.data.set(ln.label, dataPc);
      continue;
    }
    if (ln.section === "data") {
      dataPc += dataSize(ln.body, ln.lineNo, errors);
    } else {
      textPc += 4; // every text-section instruction is one 32-bit word
    }
  }
  if (errors.length) return { bytes: new Uint8Array(0), origin: TEXT_BASE, errors };

  // Pass 2: emit
  const mem = new Uint8Array(MEM_BYTES);
  const dv = new DataView(mem.buffer);
  let minWritten = MEM_BYTES;
  let maxWritten = 0;
  const note = (addr: number, n: number) => {
    minWritten = Math.min(minWritten, addr);
    maxWritten = Math.max(maxWritten, addr + n);
  };

  textPc = TEXT_BASE;
  dataPc = DATA_BASE;
  for (const ln of lines) {
    if (ln.label) continue;
    if (ln.section === "data") {
      dataPc = emitData(ln.body, dataPc, dv, mem, ln.lineNo, sym, errors, note);
    } else {
      const word = encodeInstr(ln.body, textPc, sym, ln.lineNo, errors);
      dv.setUint32(textPc, word >>> 0, true);
      note(textPc, 4);
      textPc += 4;
    }
  }
  if (errors.length) return { bytes: new Uint8Array(0), origin: TEXT_BASE, errors };

  const origin = TEXT_BASE;
  const end = Math.max(maxWritten, textPc);
  return { bytes: mem.slice(origin, end), origin, errors };
}

function dataSize(body: string, ln: number, errs: AsmError[]): number {
  if (body.startsWith(".word")) {
    const items = body.slice(5).split(",").filter((s) => s.trim() !== "");
    return items.length * 4;
  }
  if (body.startsWith(".asciz") || body.startsWith(".asciiz")) {
    const m = body.match(/^\.(?:asciz|asciiz)\s+"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) { errs.push({ line: ln, message: "Bad .asciz literal." }); return 0; }
    return parseStringBytes(m[1]).length + 1;
  }
  if (body.startsWith(".ascii")) {
    const m = body.match(/^\.ascii\s+"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) { errs.push({ line: ln, message: "Bad .ascii literal." }); return 0; }
    return parseStringBytes(m[1]).length;
  }
  errs.push({ line: ln, message: `Unknown data directive '${body}'.` });
  return 0;
}

function parseStringBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      const c = s[++i];
      out.push(c === "n" ? 10 : c === "t" ? 9 : c === "0" ? 0 : c.charCodeAt(0));
    } else out.push(s.charCodeAt(i));
  }
  return out;
}

function emitData(
  body: string,
  pc: number,
  dv: DataView,
  mem: Uint8Array,
  ln: number,
  sym: SymbolTable,
  errs: AsmError[],
  note: (addr: number, n: number) => void,
): number {
  if (body.startsWith(".word")) {
    const items = body.slice(5).split(",").map((s) => s.trim()).filter(Boolean);
    for (const it of items) {
      dv.setInt32(pc, resolveValue(it, sym, ln, errs), true);
      note(pc, 4);
      pc += 4;
    }
    return pc;
  }
  if (body.startsWith(".asciz") || body.startsWith(".asciiz") || body.startsWith(".ascii")) {
    const m = body.match(/^\.(?:ascii|asciz|asciiz)\s+"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) return pc;
    const bytes = parseStringBytes(m[1]);
    for (const b of bytes) { mem[pc] = b; note(pc, 1); pc++; }
    if (body.startsWith(".asciz") || body.startsWith(".asciiz")) {
      mem[pc] = 0; note(pc, 1); pc++;
    }
    return pc;
  }
  return pc;
}

function encodeInstr(body: string, pc: number, sym: SymbolTable, ln: number, errs: AsmError[]): number {
  // Tokenize: opcode + comma-separated operands. Memory operand `[x1, #4]`
  // contains a comma inside brackets, so we split carefully.
  const headSpace = body.indexOf(" ");
  const op = (headSpace < 0 ? body : body.slice(0, headSpace)).toLowerCase();
  const rest = headSpace < 0 ? "" : body.slice(headSpace + 1).trim();
  const operands = splitOperandsRespectingBrackets(rest);

  const branchOffset = (target: number) => {
    const off = (target - pc - 4) >> 2;
    if (off < -0x8000 || off > 0x7fff) errs.push({ line: ln, message: "Branch out of range." });
    return off & 0xffff;
  };

  switch (op) {
    case "mov": {
      const rd = regNum(operands[0], ln, errs);
      if (isImmediate(operands[1])) return encImm16(OP.MOV_IMM, rd, parseNumber(operands[1]) ?? 0);
      return enc4(OP.MOV_REG, rd, regNum(operands[1], ln, errs), 0);
    }
    case "add": case "sub": case "and": case "orr": case "eor": {
      const opImmMap = { add: OP.ADD_IMM, sub: OP.SUB_IMM, and: OP.AND_IMM, orr: OP.ORR_IMM, eor: OP.EOR_IMM };
      const opRegMap = { add: OP.ADD_REG, sub: OP.SUB_REG, and: OP.AND_REG, orr: OP.ORR_REG, eor: OP.EOR_REG };
      const rd = regNum(operands[0], ln, errs);
      const rs = regNum(operands[1], ln, errs);
      if (isImmediate(operands[2])) {
        const imm = parseNumber(operands[2]) ?? 0;
        if (imm < 0 || imm > 255) errs.push({ line: ln, message: `${op} immediate must be 0..255 here (small teaching subset).` });
        return enc4(opImmMap[op as keyof typeof opImmMap], rd, rs, imm & 0xff);
      }
      return enc4(opRegMap[op as keyof typeof opRegMap], rd, rs, regNum(operands[2], ln, errs));
    }
    case "ldr": {
      const rt = regNum(operands[0], ln, errs);
      const { base, off } = parseMemRef(operands[1], ln, errs);
      return enc4(OP.LDR, rt, base, off & 0xff);
    }
    case "str": {
      const rt = regNum(operands[0], ln, errs);
      const { base, off } = parseMemRef(operands[1], ln, errs);
      return enc4(OP.STR, rt, base, off & 0xff);
    }
    case "cmp": {
      const ra = regNum(operands[0], ln, errs);
      if (isImmediate(operands[1])) return encImm16(OP.CMP_IMM, ra, parseNumber(operands[1]) ?? 0);
      return enc4(OP.CMP_REG, ra, regNum(operands[1], ln, errs), 0);
    }
    case "b":     return encImm16(OP.B,    0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.eq":  return encImm16(OP.B_EQ, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.ne":  return encImm16(OP.B_NE, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.lt":  return encImm16(OP.B_LT, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.gt":  return encImm16(OP.B_GT, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.le":  return encImm16(OP.B_LE, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "b.ge":  return encImm16(OP.B_GE, 0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "bl":    return encImm16(OP.BL,   0, branchOffset(resolveValue(operands[0], sym, ln, errs)));
    case "ret":   return enc4(OP.RET, 0, 0, 0);
    case "svc":   return enc4(OP.SVC, 0, 0, 0);
    case "nop":   return 0;
    case "halt":  return enc4(OP.HALT, 0, 0, 0);
    default:
      errs.push({ line: ln, message: `Unknown instruction '${op}'.` });
      return 0;
  }
}

/** Split commas, but skip commas inside [...] brackets. */
function splitOperandsRespectingBrackets(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}
