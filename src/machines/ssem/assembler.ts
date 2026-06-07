/**
 * A tiny assembler for the SSEM (Manchester Baby).
 *
 * One source line = one store line (0..31). Syntax:
 *   - Comments:   `; ...`
 *   - Labels:     `loop:` (on its own line or leading an instruction/data)
 *   - Data word:  `NUM -7`   (a 32-bit value: decimal, $hex, %binary, negative)
 *   - Instructions: `JMP s` `JRP s` `LDN s` `STO s` `SUB s` `CMP` `STP`
 *     where `s` is a line number (0..31) or a label.
 *
 * Aliases: JPR=JRP, SKN=CMP, STOP/HLT=STP, LDNEG=LDN, STORE=STO, NUMBER=NUM.
 *
 * Output is a 128-byte image (32 words × 4 bytes, little-endian) so it travels
 * through the generic `Machine.load(bytes)` path.
 */

import { AsmError } from "../../engine/machineInterface";
import { FUNC, STORE_WORDS } from "./cpu";

export interface AssembleOutput {
  bytes: Uint8Array;
  origin: number;
  errors: AsmError[];
}

const MNEMONIC_FUNC: Record<string, number> = {
  JMP: FUNC.JMP,
  JRP: FUNC.JRP,
  JPR: FUNC.JRP,
  LDN: FUNC.LDN,
  LDNEG: FUNC.LDN,
  STO: FUNC.STO,
  STORE: FUNC.STO,
  SUB: FUNC.SUB,
  CMP: FUNC.CMP,
  SKN: FUNC.CMP,
  STP: FUNC.STP,
  STOP: FUNC.STP,
  HLT: FUNC.STP,
};

const NO_OPERAND = new Set<number>([FUNC.CMP, FUNC.STP]);
const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface ContentLine {
  lineNo: number;
  index: number; // store line
  mnemonic: string; // "NUM" or an opcode
  operand: string | null;
}

function parseNumber(token: string): number | null {
  const t = token.trim();
  if (t === "") return null;
  let neg = 1;
  let s = t;
  if (s[0] === "-") {
    neg = -1;
    s = s.slice(1);
  }
  let v: number;
  if (s[0] === "$") v = parseInt(s.slice(1), 16);
  else if (s[0] === "%") v = parseInt(s.slice(1), 2);
  else if (/^\d+$/.test(s)) v = parseInt(s, 10);
  else return null;
  return Number.isNaN(v) ? null : neg * v;
}

export function assemble(src: string): AssembleOutput {
  const errors: AsmError[] = [];
  const symbols = new Map<string, number>();
  const content: ContentLine[] = [];

  // --- Pass 1: assign store lines to content, record labels. ---
  let index = 0;
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i].replace(/;.*$/, "").trim();
    if (text === "") continue;

    // Leading label.
    const m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1].toUpperCase();
      if (symbols.has(key)) {
        errors.push({ line: i + 1, message: `Duplicate label '${m[1]}'.` });
      }
      symbols.set(key, index);
      text = m[2].trim();
      if (text === "") continue; // standalone label -> points at next line
    }

    const parts = text.split(/\s+/);
    const mnemonic = parts[0].toUpperCase();
    const operand = parts.slice(1).join(" ").trim() || null;

    if (index >= STORE_WORDS) {
      errors.push({
        line: i + 1,
        message: `Program exceeds the ${STORE_WORDS}-line store.`,
      });
      break;
    }
    content.push({ lineNo: i + 1, index, mnemonic, operand });
    index++;
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin: 0, errors };

  // --- Pass 2: encode each content line into a 32-bit word. ---
  const words = new Int32Array(STORE_WORDS);

  const resolve = (token: string, lineNo: number): number | null => {
    const lit = parseNumber(token);
    if (lit !== null) return lit;
    if (LABEL_RE.test(token)) {
      const v = symbols.get(token.toUpperCase());
      if (v === undefined) {
        errors.push({ line: lineNo, message: `Unknown label '${token}'.` });
        return null;
      }
      return v;
    }
    errors.push({ line: lineNo, message: `Bad operand '${token}'.` });
    return null;
  };

  for (const line of content) {
    if (line.mnemonic === "NUM" || line.mnemonic === "NUMBER") {
      if (line.operand === null) {
        errors.push({ line: line.lineNo, message: "NUM needs a value." });
        continue;
      }
      const v = resolve(line.operand, line.lineNo);
      if (v !== null) words[line.index] = v | 0;
      continue;
    }

    const func = MNEMONIC_FUNC[line.mnemonic];
    if (func === undefined) {
      errors.push({
        line: line.lineNo,
        message: `Unknown instruction '${line.mnemonic}'.`,
      });
      continue;
    }

    if (NO_OPERAND.has(func)) {
      words[line.index] = (func << 13) >> 0;
      continue;
    }

    if (line.operand === null) {
      errors.push({
        line: line.lineNo,
        message: `${line.mnemonic} needs a line-number operand.`,
      });
      continue;
    }
    const operand = resolve(line.operand, line.lineNo);
    if (operand === null) continue;
    if (operand < 0 || operand > 31) {
      errors.push({
        line: line.lineNo,
        message: `Operand ${operand} is out of range (lines are 0–31).`,
      });
      continue;
    }
    words[line.index] = ((operand & 0x1f) | (func << 13)) >> 0;
  }

  if (errors.length) return { bytes: new Uint8Array(0), origin: 0, errors };

  // Pack words little-endian into bytes.
  const bytes = new Uint8Array(STORE_WORDS * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < STORE_WORDS; i++) view.setInt32(i * 4, words[i], true);

  return { bytes, origin: 0, errors };
}
