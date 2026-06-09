/**
 * A teaching MIPS assembler (SPIM/MARS-flavored), a practical subset.
 *
 * Syntax:
 *   - Comments:  `# ...`
 *   - Sections:  `.text`, `.data`
 *   - Labels:    `name:`  on its own line or leading an instruction
 *   - Data:      `.word 1, 2, 3`,  `.asciiz "hello\n"`
 *   - Numbers:   `42`  `0x2a`  `0b101`  `'A'`  `-3`
 *   - Registers: `$zero`, `$at`, `$v0`–`$v1`, `$a0`–`$a3`, `$t0`–`$t9`,
 *                `$s0`–`$s7`, `$k0`–`$k1`, `$gp`, `$sp`, `$fp`, `$ra`,
 *                or the numeric form `$0`–`$31`.
 *   - Pseudo-ops: `li`, `la`, `move`, `nop` (expanded by the assembler).
 *
 * Output is a contiguous byte image starting at the .text base (0x0400).
 * Any .data words land at the .data base (0x1000). They are baked into the
 * image so a single .load() call sets everything up.
 */

import { AsmError } from "../../engine/machineInterface";
import { DATA_BASE, MEM_BYTES, REG_NAMES, TEXT_BASE } from "./cpu";

export { TEXT_BASE };

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

/** Mnemonic → instruction descriptor (encoder). */
type Encoder = (operands: string[], pc: number, sym: SymbolTable, ln: number, errs: AsmError[]) => number;

interface InstrDef {
  /** How many machine words this instruction expands to (1 unless pseudo-op). */
  size: number;
  /** Encoder for word i (0-based). */
  encode: Encoder;
}

interface SymbolTable {
  text: Map<string, number>; // label → text-section address
  data: Map<string, number>; // label → data-section address
}

function parseNumber(tok: string): number | null {
  const t = tok.trim();
  if (t === "") return null;
  const ch = t.match(/^'(.)'$/);
  if (ch) return ch[1].charCodeAt(0);
  if (/^-?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^-?0b[01]+$/i.test(t)) return parseInt(t.replace(/^(-?)0b/i, "$1"), 2);
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  return null;
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

/** "8(\$t0)" → { offset: 8, base: $t0 } */
function parseMemRef(tok: string, sym: SymbolTable, ln: number, errs: AsmError[]) {
  const m = tok.match(/^(-?\w+)?\s*\(\s*(\$\w+)\s*\)$/);
  if (!m) {
    errs.push({ line: ln, message: `Bad memory operand '${tok}', expected offset($reg).` });
    return { offset: 0, base: 0 };
  }
  const offset = m[1] ? resolveValue(m[1], sym, ln, errs) : 0;
  const base = regNum(m[2], ln, errs);
  return { offset, base };
}

// --- field packers --------------------------------------------------------

const rType = (rs: number, rt: number, rd: number, shamt: number, funct: number): number =>
  (0 << 26) | ((rs & 31) << 21) | ((rt & 31) << 16) | ((rd & 31) << 11) | ((shamt & 31) << 6) | (funct & 63);

const iType = (op: number, rs: number, rt: number, imm: number): number =>
  ((op & 63) << 26) | ((rs & 31) << 21) | ((rt & 31) << 16) | (imm & 0xffff);

const jType = (op: number, target: number): number =>
  ((op & 63) << 26) | (target & 0x03ffffff);

// --- instruction table ---------------------------------------------------

function makeRRR(funct: number): InstrDef {
  return {
    size: 1,
    encode: (o, _pc, _sym, ln, errs) =>
      rType(regNum(o[1], ln, errs), regNum(o[2], ln, errs), regNum(o[0], ln, errs), 0, funct),
  };
}

function makeShift(funct: number): InstrDef {
  // `sll $rd, $rt, shamt`
  return {
    size: 1,
    encode: (o, _pc, sym, ln, errs) =>
      rType(0, regNum(o[1], ln, errs), regNum(o[0], ln, errs), resolveValue(o[2], sym, ln, errs) & 31, funct),
  };
}

function makeImm(op: number): InstrDef {
  // `addi $rt, $rs, imm`
  return {
    size: 1,
    encode: (o, _pc, sym, ln, errs) =>
      iType(op, regNum(o[1], ln, errs), regNum(o[0], ln, errs), resolveValue(o[2], sym, ln, errs) & 0xffff),
  };
}

function makeLoadStore(op: number): InstrDef {
  // `lw $rt, offset($rs)`
  return {
    size: 1,
    encode: (o, _pc, sym, ln, errs) => {
      const rt = regNum(o[0], ln, errs);
      const { offset, base } = parseMemRef(o[1], sym, ln, errs);
      return iType(op, base, rt, offset & 0xffff);
    },
  };
}

function makeBranch(op: number): InstrDef {
  // `beq $rs, $rt, label`
  return {
    size: 1,
    encode: (o, pc, sym, ln, errs) => {
      const rs = regNum(o[0], ln, errs);
      const rt = regNum(o[1], ln, errs);
      const target = resolveValue(o[2], sym, ln, errs);
      // 16-bit signed word offset from the instruction *after* this one
      const offsetWords = (target - (pc + 4)) >> 2;
      if (offsetWords < -0x8000 || offsetWords > 0x7fff) {
        errs.push({ line: ln, message: `Branch out of range.` });
      }
      return iType(op, rs, rt, offsetWords & 0xffff);
    },
  };
}

const ISA: Record<string, InstrDef> = {
  add: makeRRR(0x20),
  sub: makeRRR(0x22),
  and: makeRRR(0x24),
  or: makeRRR(0x25),
  xor: makeRRR(0x26),
  slt: makeRRR(0x2a),
  sll: makeShift(0x00),
  srl: makeShift(0x02),
  addi: makeImm(0x08),
  andi: makeImm(0x0c),
  ori: makeImm(0x0d),
  slti: makeImm(0x0a),
  lui: {
    size: 1,
    encode: (o, _pc, sym, ln, errs) =>
      iType(0x0f, 0, regNum(o[0], ln, errs), resolveValue(o[1], sym, ln, errs) & 0xffff),
  },
  lw: makeLoadStore(0x23),
  sw: makeLoadStore(0x2b),
  beq: makeBranch(0x04),
  bne: makeBranch(0x05),
  j: {
    size: 1,
    encode: (o, _pc, sym, ln, errs) =>
      jType(0x02, (resolveValue(o[0], sym, ln, errs) >>> 2) & 0x03ffffff),
  },
  jal: {
    size: 1,
    encode: (o, _pc, sym, ln, errs) =>
      jType(0x03, (resolveValue(o[0], sym, ln, errs) >>> 2) & 0x03ffffff),
  },
  jr: {
    size: 1,
    encode: (o, _pc, _sym, ln, errs) => rType(regNum(o[0], ln, errs), 0, 0, 0, 0x08),
  },
  syscall: { size: 1, encode: () => rType(0, 0, 0, 0, 0x0c) },
  nop: { size: 1, encode: () => 0 },
  // Pseudo-ops: lui+ori for big immediates, addiu-from-zero for small ones.
  // We use the 'addi+lui' decomposition for `li` and `la`.
  li: {
    size: 2,
    encode: (o, _pc, sym, ln, errs) => {
      // Always emit lui + ori for simplicity (covers full 32-bit range).
      const rt = regNum(o[0], ln, errs);
      const v = resolveValue(o[1], sym, ln, errs) >>> 0;
      const upper = (v >>> 16) & 0xffff;
      const lower = v & 0xffff;
      // word 0: lui $rt, upper
      // word 1: ori $rt, $rt, lower
      // (encode() is called twice with different pc; we use a closure.)
      return iType(0x0f, 0, rt, upper) | 0 | (lower << 0) * 0; // ignored; we override below
    },
  },
  la: {
    size: 2,
    encode: (o, _pc, sym, ln, errs) => {
      const rt = regNum(o[0], ln, errs);
      const addr = resolveValue(o[1], sym, ln, errs) >>> 0;
      const upper = (addr >>> 16) & 0xffff;
      void rt; void upper;
      return 0; // placeholder, overridden by special-case path below
    },
  },
  move: {
    size: 1,
    // move $rd, $rs  →  add $rd, $0, $rs
    encode: (o, _pc, _sym, ln, errs) =>
      rType(0, regNum(o[1], ln, errs), regNum(o[0], ln, errs), 0, 0x20),
  },
};

/**
 * The two-pass assembler. Pass 1 collects labels with their text/data
 * addresses; pass 2 emits bytes.
 */
export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const sym: SymbolTable = { text: new Map(), data: new Map() };

  // Split into lines, strip comments, classify.
  type RawLine = { lineNo: number; section: "text" | "data"; raw: string; label: string | null; body: string };
  const lines: RawLine[] = [];
  let section: "text" | "data" = "text";

  const rawSrc = src.split(/\r?\n/);
  for (let i = 0; i < rawSrc.length; i++) {
    let text = rawSrc[i].replace(/#.*$/, "").trim();
    if (text === "") continue;
    if (text === ".text") { section = "text"; continue; }
    if (text === ".data") { section = "data"; continue; }
    // peel one or more leading labels: `foo:` `bar:` ...
    let label: string | null = null;
    let m: RegExpMatchArray | null;
    while ((m = text.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/))) {
      label = m[1];
      const rest = m[2];
      lines.push({ lineNo: i + 1, section, raw: rawSrc[i], label, body: "" });
      label = null;
      text = rest;
      if (text === "") break;
    }
    if (text !== "") {
      lines.push({ lineNo: i + 1, section, raw: rawSrc[i], label: null, body: text });
    }
  }

  // --- Pass 1: assign label addresses ---
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
      textPc += textSize(ln.body, ln.lineNo, errors) * 4;
    }
  }
  if (errors.length) return { bytes: new Uint8Array(0), origin: TEXT_BASE, errors };

  // --- Pass 2: emit ---
  const mem = new Uint8Array(MEM_BYTES);
  const dv = new DataView(mem.buffer);
  textPc = TEXT_BASE;
  dataPc = DATA_BASE;
  let minWritten = MEM_BYTES;
  let maxWritten = 0;
  const note = (addr: number, bytes: number) => {
    minWritten = Math.min(minWritten, addr);
    maxWritten = Math.max(maxWritten, addr + bytes);
  };

  for (const ln of lines) {
    if (ln.label) continue;
    if (ln.section === "data") {
      dataPc = emitData(ln.body, dataPc, dv, mem, ln.lineNo, sym, errors, note);
    } else {
      textPc = emitText(ln.body, textPc, dv, sym, ln.lineNo, errors, note);
    }
  }
  if (errors.length) return { bytes: new Uint8Array(0), origin: TEXT_BASE, errors };

  // Build a contiguous image from the lowest written byte to the highest.
  // We always start at TEXT_BASE so the loader points PC there.
  const origin = TEXT_BASE;
  const end = Math.max(maxWritten, textPc);
  const out = mem.slice(origin, end);
  return { bytes: out, origin, errors };
}

// --- helpers --------------------------------------------------------------

function textSize(body: string, ln: number, errs: AsmError[]): number {
  const op = body.split(/[\s,]+/)[0]?.toLowerCase();
  const def = op ? ISA[op] : undefined;
  if (!def) {
    errs.push({ line: ln, message: `Unknown instruction '${body.split(/\s+/)[0]}'.` });
    return 0;
  }
  return def.size;
}

function dataSize(body: string, ln: number, errs: AsmError[]): number {
  if (body.startsWith(".word")) {
    const items = body.slice(5).split(",").filter((s) => s.trim() !== "");
    return items.length * 4;
  }
  if (body.startsWith(".asciiz")) {
    const m = body.match(/^\.asciiz\s+"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) { errs.push({ line: ln, message: "Bad .asciiz literal." }); return 0; }
    return parseStringBytes(m[1]).length + 1; // + zero terminator
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
    } else {
      out.push(s.charCodeAt(i));
    }
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
  note: (addr: number, bytes: number) => void,
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
  if (body.startsWith(".asciiz") || body.startsWith(".ascii")) {
    const m = body.match(/^\.(?:ascii|asciiz)\s+"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) return pc;
    const bytes = parseStringBytes(m[1]);
    for (const b of bytes) { mem[pc] = b; note(pc, 1); pc++; }
    if (body.startsWith(".asciiz")) { mem[pc] = 0; note(pc, 1); pc++; }
    return pc;
  }
  return pc;
}

function emitText(
  body: string,
  pc: number,
  dv: DataView,
  sym: SymbolTable,
  ln: number,
  errs: AsmError[],
  note: (addr: number, bytes: number) => void,
): number {
  // Tokenize: opcode + comma-separated operands. Memory-ref `8($t0)` is
  // already a single token because it has no top-level comma.
  const head = body.split(/\s+/, 2);
  const op = head[0].toLowerCase();
  const operandStr = body.slice(head[0].length).trim();
  const operands = operandStr === "" ? [] : splitOperands(operandStr);
  const def = ISA[op];
  if (!def) { errs.push({ line: ln, message: `Unknown instruction '${head[0]}'.` }); return pc; }

  // Special-case the two-word pseudo-ops so we can emit BOTH words correctly.
  if (op === "li") {
    const rt = regNum(operands[0], ln, errs);
    const v = resolveValue(operands[1], sym, ln, errs) >>> 0;
    const upper = (v >>> 16) & 0xffff;
    const lower = v & 0xffff;
    dv.setUint32(pc, iType(0x0f, 0, rt, upper) >>> 0, true); note(pc, 4); pc += 4;
    dv.setUint32(pc, iType(0x0d, rt, rt, lower) >>> 0, true); note(pc, 4); pc += 4;
    return pc;
  }
  if (op === "la") {
    const rt = regNum(operands[0], ln, errs);
    const addr = resolveValue(operands[1], sym, ln, errs) >>> 0;
    const upper = (addr >>> 16) & 0xffff;
    const lower = addr & 0xffff;
    dv.setUint32(pc, iType(0x0f, 0, rt, upper) >>> 0, true); note(pc, 4); pc += 4;
    dv.setUint32(pc, iType(0x0d, rt, rt, lower) >>> 0, true); note(pc, 4); pc += 4;
    return pc;
  }

  // Standard one-word instructions.
  const word = def.encode(operands, pc, sym, ln, errs);
  dv.setUint32(pc, word >>> 0, true);
  note(pc, 4);
  return pc + 4;
}

/**
 * Split operands on commas, but treat `offset($reg)` as a single operand so we
 * don't break on the comma-less paren group.
 */
function splitOperands(s: string): string[] {
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}
