/**
 * A PAL-style assembler for the PDP-8 (a practical subset).
 *
 * Syntax:
 *   - Comments:   `/ ...`  or  `; ...`
 *   - Origin:     `*200`           (sets the location counter; programs start here)
 *   - Labels:     `LOOP,`  or  `LOOP:`   (PAL uses a trailing comma)
 *   - Symbols:    `COUNT=7`
 *   - Memory ref: `TAD VAL`  `DCA I PTR`  `JMP LOOP`   (I = indirect)
 *                 page/indirect bits are chosen automatically by address.
 *   - Micro-ops:  `CLA`, `CLA CLL`, `CMA IAC`, `RAR`, `HLT`, ... (OR-combined)
 *   - Teletype:   `TLS` `TSF` `TCF` `KSF` `KCC`
 *   - Data word:  a bare number or label on its own line.
 *
 * Numbers are DECIMAL by default for clarity (the real PDP-8 world was octal —
 * mentioned in the lessons). Prefixes: `0o` octal, `$` hex, `%` binary, `-` neg.
 * The program must be contiguous from its origin (code first, data after).
 */

import { AsmError } from "../../engine/machineInterface";
import { MASK } from "./cpu";

export const DEFAULT_ORIGIN = 0o200; // 128

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

// Memory-reference base opcodes (op << 9).
const MEMREF: Record<string, number> = {
  AND: 0o0000,
  TAD: 0o1000,
  ISZ: 0o2000,
  DCA: 0o3000,
  JMS: 0o4000,
  JMP: 0o5000,
};

// Micro-ops & IOTs as complete opcodes (OR-combined when written together).
const MICRO: Record<string, number> = {
  NOP: 0o7000,
  // Group 1
  CLA: 0o7200, CLL: 0o7100, CMA: 0o7040, CML: 0o7020, IAC: 0o7001,
  RAR: 0o7010, RAL: 0o7004, RTR: 0o7012, RTL: 0o7006, BSW: 0o7002,
  CIA: 0o7041, // CMA + IAC (negate)
  // Group 2 (skips)
  SMA: 0o7500, SZA: 0o7440, SNL: 0o7420, SKP: 0o7410,
  SPA: 0o7510, SNA: 0o7450, SZL: 0o7430,
  OSR: 0o7404, HLT: 0o7402,
  CLAG2: 0o7600,
  // IOT (Teletype)
  TSF: 0o6041, TCF: 0o6042, TPC: 0o6044, TLS: 0o6046,
  KSF: 0o6031, KCC: 0o6032, KRS: 0o6034, KRB: 0o6036,
};

const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseNumber(tok: string): number | null {
  let t = tok.trim();
  if (t === "") return null;
  let neg = 1;
  if (t[0] === "-") { neg = -1; t = t.slice(1); }
  let v: number;
  if (t.startsWith("0o")) v = parseInt(t.slice(2), 8);
  else if (t[0] === "$") v = parseInt(t.slice(1), 16);
  else if (t[0] === "%") v = parseInt(t.slice(1), 2);
  else if (/^\d+$/.test(t)) v = parseInt(t, 10);
  else return null;
  return Number.isNaN(v) ? null : neg * v;
}

interface Stmt {
  addr: number;
  tokens: string[];
  lineNo: number;
}

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const symbols = new Map<string, number>();
  const stmts: Stmt[] = [];
  let lc = DEFAULT_ORIGIN;
  let minAddr = Infinity;
  let maxAddr = -Infinity;

  const lines = src.split(/\r?\n/);

  // --- Pass 1: location counter, labels, symbols. ---
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i].replace(/[/;].*$/, "").trim();
    if (text === "") continue;

    // Origin.
    if (text[0] === "*") {
      const v = parseNumber(text.slice(1).trim());
      if (v === null) errors.push({ line: i + 1, message: "Bad origin." });
      else lc = v & MASK;
      continue;
    }

    // Symbol definition NAME=expr.
    const eq = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (eq) {
      const v = parseNumber(eq[2].trim());
      if (v === null) errors.push({ line: i + 1, message: `Bad value for ${eq[1]}.` });
      else symbols.set(eq[1].toUpperCase(), v & MASK);
      continue;
    }

    // Leading label(s): NAME, or NAME:
    let m: RegExpMatchArray | null;
    while ((m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[,:]\s*(.*)$/))) {
      const key = m[1].toUpperCase();
      if (symbols.has(key)) {
        errors.push({ line: i + 1, message: `Duplicate label '${m[1]}'.` });
      }
      symbols.set(key, lc);
      text = m[2].trim();
      if (text === "") break;
    }
    if (text === "") continue;

    const tokens = text.split(/\s+/);
    stmts.push({ addr: lc, tokens, lineNo: i + 1 });
    minAddr = Math.min(minAddr, lc);
    maxAddr = Math.max(maxAddr, lc);
    lc = (lc + 1) & MASK;
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin: DEFAULT_ORIGIN, errors };
  if (stmts.length === 0) {
    return { bytes: new Uint8Array(0), origin: DEFAULT_ORIGIN, errors };
  }

  const resolve = (tok: string, lineNo: number): number | null => {
    const lit = parseNumber(tok);
    if (lit !== null) return lit;
    if (LABEL_RE.test(tok)) {
      const v = symbols.get(tok.toUpperCase());
      if (v === undefined) {
        errors.push({ line: lineNo, message: `Unknown symbol '${tok}'.` });
        return null;
      }
      return v;
    }
    errors.push({ line: lineNo, message: `Bad operand '${tok}'.` });
    return null;
  };

  // --- Pass 2: encode. ---
  const image = new Map<number, number>();

  for (const st of stmts) {
    const head = st.tokens[0].toUpperCase();

    if (head in MEMREF) {
      let idx = 1;
      let indirect = false;
      if (st.tokens[idx] && st.tokens[idx].toUpperCase() === "I") {
        indirect = true;
        idx++;
      }
      const operandTok = st.tokens[idx];
      if (!operandTok) {
        errors.push({ line: st.lineNo, message: `${head} needs an operand.` });
        continue;
      }
      const target = resolve(operandTok, st.lineNo);
      if (target === null) continue;

      let pageBit = 0;
      let offset: number;
      if (target >= 0 && target <= 0o177) {
        pageBit = 0;
        offset = target;
      } else if ((target & 0o7600) === (st.addr & 0o7600)) {
        pageBit = 1;
        offset = target & 0o177;
      } else {
        errors.push({
          line: st.lineNo,
          message: `Address ${target} isn't on page 0 or this page — use an indirect pointer.`,
        });
        continue;
      }
      image.set(
        st.addr,
        (MEMREF[head] | (indirect ? 0o400 : 0) | (pageBit ? 0o200 : 0) | offset) & MASK
      );
      continue;
    }

    // Micro-op / IOT: OR all recognised mnemonics on the line.
    if (head in MICRO) {
      let word = 0;
      let ok = true;
      for (const tk of st.tokens) {
        const up = tk.toUpperCase();
        if (!(up in MICRO)) {
          errors.push({ line: st.lineNo, message: `Unknown mnemonic '${tk}'.` });
          ok = false;
          break;
        }
        word |= MICRO[up];
      }
      if (ok) image.set(st.addr, word & MASK);
      continue;
    }

    // Otherwise: a data word (single number or label).
    if (st.tokens.length === 1) {
      const v = resolve(st.tokens[0], st.lineNo);
      if (v !== null) image.set(st.addr, v & MASK);
      continue;
    }

    errors.push({ line: st.lineNo, message: `Unknown instruction '${st.tokens[0]}'.` });
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin: DEFAULT_ORIGIN, errors };

  // Pack a contiguous block [minAddr, maxAddr] as little-endian 16-bit words.
  const origin = minAddr;
  const count = maxAddr - minAddr + 1;
  const bytes = new Uint8Array(count * 2);
  const view = new DataView(bytes.buffer);
  for (let a = minAddr; a <= maxAddr; a++) {
    view.setUint16((a - minAddr) * 2, image.get(a) ?? 0, true);
  }

  return { bytes, origin, errors };
}
