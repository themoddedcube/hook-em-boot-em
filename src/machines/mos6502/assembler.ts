/**
 * A two-pass MOS 6502 assembler.
 *
 * Supported syntax (a practical subset compatible with easy6502 programs):
 *   - Comments:        `; ...`
 *   - Labels:          `loop:`  or  `loop`  at the start of a line
 *   - Constants:       `define NAME value`
 *   - Origin:          `*= $0600`   (sets the assembly/load address)
 *   - Inline data:     `dcb 1, 2, $03, %1010`   (define constant bytes)
 *   - All 13 addressing modes, with zp/abs auto-selection by operand value.
 *   - Number formats:  `$1f` (hex), `%1010` (binary), `42` (decimal).
 *   - Lo/hi byte:      `#<label`, `#>label`.
 *   - Simple offsets:  `label+2`, `$0200-1`.
 *
 * Pass 1 assigns addresses to labels (sizing symbol-typed operands as absolute,
 * numeric operands by value); pass 2 emits bytes and resolves branch targets.
 */

import { AsmError } from "../../engine/machineInterface";
import {
  AddrMode,
  BRANCH_MNEMONICS,
  BY_MNEMONIC,
  MNEMONICS,
  MODE_BYTES,
} from "./opcodes";

export const DEFAULT_ORIGIN = 0x0600;

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

interface ParsedLine {
  lineNo: number;
  label: string | null;
  mnemonic: string | null; // uppercase opcode, or a directive like "DEFINE"
  operand: string | null;
}

interface OperandForm {
  /** Candidate addressing mode(s); zp/abs resolved later by value. */
  kind:
    | "none" // implied
    | "acc" // accumulator (A)
    | "imm" // #expr
    | "izx" // (expr,X)
    | "izy" // (expr),Y
    | "ind" // (expr)
    | "idxX" // expr,X  -> zpx | abx
    | "idxY" // expr,Y  -> zpy | aby
    | "mem"; // expr    -> zp | abs | rel
  expr: string; // the value expression (empty for none/acc)
}

const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Strip a trailing comment and surrounding whitespace from a raw line. */
function stripComment(line: string): string {
  const idx = line.indexOf(";");
  return (idx >= 0 ? line.slice(0, idx) : line).trim();
}

/** Split a logical line into { label, mnemonic, operand }. */
function parseLine(raw: string, lineNo: number): ParsedLine | AsmError {
  let text = stripComment(raw);
  if (text === "") {
    return { lineNo, label: null, mnemonic: null, operand: null };
  }

  let label: string | null = null;

  // Label with explicit colon, anywhere it leads the line.
  const colon = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (colon) {
    label = colon[1];
    text = colon[2].trim();
  }

  if (text === "") {
    return { lineNo, label, mnemonic: null, operand: null };
  }

  // `*= $0600` origin directive.
  const org = text.match(/^\*\s*=\s*(.+)$/);
  if (org) {
    return { lineNo, label, mnemonic: "*=", operand: org[1].trim() };
  }

  const parts = text.split(/\s+/);
  const first = parts[0];

  // A bare leading word that isn't a mnemonic/directive is a colon-less label.
  const upperFirst = first.toUpperCase();
  const isMnemonic = MNEMONICS.has(upperFirst);
  const isDirective = upperFirst === "DEFINE" || upperFirst === "DCB";

  if (!label && !isMnemonic && !isDirective && LABEL_RE.test(first)) {
    label = first;
    const rest = parts.slice(1);
    if (rest.length === 0) {
      return { lineNo, label, mnemonic: null, operand: null };
    }
    const m = rest[0].toUpperCase();
    return {
      lineNo,
      label,
      mnemonic: m,
      operand: rest.slice(1).join(" ").trim() || null,
    };
  }

  const mnemonic = upperFirst;
  const operand = parts.slice(1).join(" ").trim() || null;
  return { lineNo, label, mnemonic, operand };
}

/** Classify operand text into an addressing-mode form + value expression. */
function classifyOperand(operand: string | null): OperandForm {
  if (operand == null || operand === "") return { kind: "none", expr: "" };
  const op = operand.trim();

  if (op.toUpperCase() === "A") return { kind: "acc", expr: "" };

  if (op.startsWith("#")) return { kind: "imm", expr: op.slice(1).trim() };

  // (expr,X)
  let m = op.match(/^\(\s*(.+?)\s*,\s*[Xx]\s*\)$/);
  if (m) return { kind: "izx", expr: m[1] };

  // (expr),Y
  m = op.match(/^\(\s*(.+?)\s*\)\s*,\s*[Yy]$/);
  if (m) return { kind: "izy", expr: m[1] };

  // (expr)
  m = op.match(/^\(\s*(.+?)\s*\)$/);
  if (m) return { kind: "ind", expr: m[1] };

  // expr,X
  m = op.match(/^(.+?)\s*,\s*[Xx]$/);
  if (m) return { kind: "idxX", expr: m[1] };

  // expr,Y
  m = op.match(/^(.+?)\s*,\s*[Yy]$/);
  if (m) return { kind: "idxY", expr: m[1] };

  return { kind: "mem", expr: op };
}

/** Parse a numeric literal ($hex, %bin, decimal). Returns null if not a literal. */
function parseLiteral(token: string): number | null {
  const t = token.trim();
  if (t === "") return null;
  if (t[0] === "$") {
    const v = parseInt(t.slice(1), 16);
    return Number.isNaN(v) ? null : v;
  }
  if (t[0] === "%") {
    const v = parseInt(t.slice(1), 2);
    return Number.isNaN(v) ? null : v;
  }
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

/**
 * Evaluate a value expression against the symbol table. Supports a lo/hi byte
 * prefix (`<`/`>`), a primary term (literal or symbol), and an optional
 * `+`/`-` integer offset. Returns null if a symbol is still unresolved.
 */
function evalExpr(expr: string, symbols: Map<string, number>): number | null {
  let e = expr.trim();
  let byteSel: "lo" | "hi" | null = null;
  if (e.startsWith("<")) {
    byteSel = "lo";
    e = e.slice(1).trim();
  } else if (e.startsWith(">")) {
    byteSel = "hi";
    e = e.slice(1).trim();
  }

  // Split off a trailing +N / -N offset, if present. The primary term must be
  // non-empty (so a bare negative literal like `-5` is not mistaken for one).
  let offset = 0;
  let primary = e;
  const opMatch = e.match(/^(.+?)\s*([+\-])\s*(\$?%?[0-9A-Fa-f]+)$/);
  if (opMatch) {
    const tail = parseLiteral(opMatch[3]);
    if (tail != null) {
      primary = opMatch[1].trim();
      offset = opMatch[2] === "-" ? -tail : tail;
    }
  }

  let base: number | null = parseLiteral(primary);
  if (base == null) {
    const sym = symbols.get(primary.toUpperCase());
    base = sym == null ? null : sym;
  }
  if (base == null) return null;

  let value = base + offset;
  if (byteSel === "lo") value = value & 0xff;
  else if (byteSel === "hi") value = (value >> 8) & 0xff;
  return value;
}

/** Choose the concrete addressing mode for a form, given (maybe) a value. */
function resolveMode(
  mnemonic: string,
  form: OperandForm,
  value: number | null
): AddrMode | null {
  const modes = BY_MNEMONIC.get(mnemonic);
  if (!modes) return null;
  const has = (m: AddrMode) => modes.has(m);

  if (BRANCH_MNEMONICS.has(mnemonic)) return "rel";

  switch (form.kind) {
    case "none":
      return has("imp") ? "imp" : has("acc") ? "acc" : null;
    case "acc":
      return has("acc") ? "acc" : null;
    case "imm":
      return has("imm") ? "imm" : null;
    case "izx":
      return has("izx") ? "izx" : null;
    case "izy":
      return has("izy") ? "izy" : null;
    case "ind":
      return has("ind") ? "ind" : null;
    case "idxX": {
      const zpFits = value != null && value >= 0 && value <= 0xff;
      if (zpFits && has("zpx")) return "zpx";
      if (has("abx")) return "abx";
      return has("zpx") ? "zpx" : null;
    }
    case "idxY": {
      const zpFits = value != null && value >= 0 && value <= 0xff;
      if (zpFits && has("zpy")) return "zpy";
      if (has("aby")) return "aby";
      return has("zpy") ? "zpy" : null;
    }
    case "mem": {
      const zpFits = value != null && value >= 0 && value <= 0xff;
      if (zpFits && has("zp")) return "zp";
      if (has("abs")) return "abs";
      return has("zp") ? "zp" : null;
    }
  }
}

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const rawLines = src.split(/\r?\n/);
  const parsed: ParsedLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const p = parseLine(rawLines[i], i + 1);
    if ("message" in p) {
      errors.push(p);
    } else {
      parsed.push(p);
    }
  }

  const symbols = new Map<string, number>();
  let origin = DEFAULT_ORIGIN;
  let originSet = false;

  // --- Pass 1: process defines/origin, assign label addresses, size code. ---
  // We must process `*=` and `define` in order, so do a single forward pass.
  let pc = origin;
  let pcInitialized = false;

  const ensurePc = () => {
    if (!pcInitialized) {
      pc = origin;
      pcInitialized = true;
    }
  };

  for (const line of parsed) {
    if (line.mnemonic === "*=") {
      const v = evalExpr(line.operand ?? "", symbols);
      if (v == null) {
        errors.push({ line: line.lineNo, message: "Invalid origin address." });
      } else {
        origin = v & 0xffff;
        pc = origin;
        pcInitialized = true;
        originSet = true;
      }
      continue;
    }

    if (line.mnemonic === "DEFINE") {
      const m = (line.operand ?? "").match(/^(\S+)\s+(.+)$/);
      if (!m) {
        errors.push({ line: line.lineNo, message: "Malformed 'define'." });
      } else {
        const val = evalExpr(m[2], symbols);
        if (val == null) {
          errors.push({
            line: line.lineNo,
            message: `Cannot resolve define value '${m[2]}'.`,
          });
        } else {
          symbols.set(m[1].toUpperCase(), val);
        }
      }
      continue;
    }

    ensurePc();

    if (line.label) {
      const key = line.label.toUpperCase();
      if (symbols.has(key)) {
        errors.push({
          line: line.lineNo,
          message: `Duplicate label '${line.label}'.`,
        });
      }
      symbols.set(key, pc);
    }

    if (!line.mnemonic) continue;

    if (line.mnemonic === "DCB") {
      const items = (line.operand ?? "").split(",").filter((s) => s.trim() !== "");
      pc += items.length;
      continue;
    }

    if (!MNEMONICS.has(line.mnemonic)) {
      errors.push({
        line: line.lineNo,
        message: `Unknown instruction '${line.mnemonic}'.`,
      });
      continue;
    }

    const form = classifyOperand(line.operand);
    const value = evalExpr(form.expr, symbols); // may be null for forward labels
    const mode = resolveMode(line.mnemonic, form, value);
    if (!mode) {
      errors.push({
        line: line.lineNo,
        message: `Invalid addressing mode for ${line.mnemonic}.`,
      });
      continue;
    }
    pc += MODE_BYTES[mode];
  }

  void origin;
  void originSet;

  if (errors.some((e) => e.severity !== "warning")) {
    return { bytes: new Uint8Array(0), origin, errors };
  }

  // --- Pass 2: emit bytes. ---
  const out: number[] = [];
  pc = origin;
  pcInitialized = false;

  const emit = (b: number) => out.push(b & 0xff);

  for (const line of parsed) {
    if (line.mnemonic === "*=" || line.mnemonic === "DEFINE") continue;
    if (!pcInitialized) {
      pc = origin;
      pcInitialized = true;
    }
    if (!line.mnemonic) continue;

    if (line.mnemonic === "DCB") {
      const items = (line.operand ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const it of items) {
        const v = evalExpr(it, symbols);
        if (v == null) {
          errors.push({ line: line.lineNo, message: `Bad data byte '${it}'.` });
          emit(0);
        } else {
          emit(v);
        }
        pc += 1;
      }
      continue;
    }

    const form = classifyOperand(line.operand);
    const value = evalExpr(form.expr, symbols);
    const mode = resolveMode(line.mnemonic, form, value);
    if (!mode) {
      errors.push({
        line: line.lineNo,
        message: `Invalid addressing mode for ${line.mnemonic}.`,
      });
      continue;
    }

    const def = BY_MNEMONIC.get(line.mnemonic)!.get(mode)!;
    const size = MODE_BYTES[mode];
    emit(def.opcode);

    if (mode === "imp" || mode === "acc") {
      pc += size;
      continue;
    }

    if (mode === "rel") {
      if (value == null) {
        errors.push({
          line: line.lineNo,
          message: `Unresolved branch target '${form.expr}'.`,
        });
        emit(0);
        pc += size;
        continue;
      }
      const next = pc + size;
      const delta = value - next;
      if (delta < -128 || delta > 127) {
        errors.push({
          line: line.lineNo,
          message: `Branch out of range (${delta} bytes).`,
        });
        emit(0);
      } else {
        emit(delta & 0xff);
      }
      pc += size;
      continue;
    }

    if (value == null) {
      errors.push({
        line: line.lineNo,
        message: `Unresolved operand '${form.expr}'.`,
      });
      emit(0);
      if (size === 3) emit(0);
      pc += size;
      continue;
    }

    if (size === 2) {
      emit(value & 0xff);
    } else {
      emit(value & 0xff);
      emit((value >> 8) & 0xff);
    }
    pc += size;
  }

  if (errors.some((e) => e.severity !== "warning")) {
    return { bytes: new Uint8Array(0), origin, errors };
  }

  return { bytes: Uint8Array.from(out), origin, errors };
}
