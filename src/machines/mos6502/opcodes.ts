/**
 * MOS 6502 opcode table — the single source of truth shared by the assembler
 * (mnemonic + mode -> byte) and the CPU (byte -> mnemonic + mode + cycles).
 *
 * Only the 151 documented/legal opcodes are included; undocumented "illegal"
 * opcodes are intentionally omitted (decoding one halts the CPU as an error,
 * which is the pedagogically honest behaviour for a teaching emulator).
 *
 * Reference: the standard 6502 ISA as documented in the easy6502 tutorial
 * (CC BY 4.0, skilldrick/easy6502) and 6502.org. See ATTRIBUTION.md.
 */

export type AddrMode =
  | "imp" // implied
  | "acc" // accumulator
  | "imm" // immediate            #$nn
  | "zp" //  zero page            $nn
  | "zpx" // zero page,X          $nn,X
  | "zpy" // zero page,Y          $nn,Y
  | "abs" // absolute             $nnnn
  | "abx" // absolute,X           $nnnn,X
  | "aby" // absolute,Y           $nnnn,Y
  | "ind" // indirect             ($nnnn)      JMP only
  | "izx" // (indirect,X)         ($nn,X)
  | "izy" // (indirect),Y         ($nn),Y
  | "rel"; // relative            branch target

/** Total instruction length (opcode + operand bytes) for each mode. */
export const MODE_BYTES: Record<AddrMode, number> = {
  imp: 1,
  acc: 1,
  imm: 2,
  zp: 2,
  zpx: 2,
  zpy: 2,
  abs: 3,
  abx: 3,
  aby: 3,
  ind: 3,
  izx: 2,
  izy: 2,
  rel: 2,
};

export interface OpDef {
  mnemonic: string;
  mode: AddrMode;
  opcode: number;
  /** Base cycle count (page-cross / branch-taken penalties added at runtime). */
  cycles: number;
}

// [mnemonic, mode, opcode, cycles]
const TABLE: [string, AddrMode, number, number][] = [
  // ADC
  ["ADC", "imm", 0x69, 2], ["ADC", "zp", 0x65, 3], ["ADC", "zpx", 0x75, 4],
  ["ADC", "abs", 0x6d, 4], ["ADC", "abx", 0x7d, 4], ["ADC", "aby", 0x79, 4],
  ["ADC", "izx", 0x61, 6], ["ADC", "izy", 0x71, 5],
  // AND
  ["AND", "imm", 0x29, 2], ["AND", "zp", 0x25, 3], ["AND", "zpx", 0x35, 4],
  ["AND", "abs", 0x2d, 4], ["AND", "abx", 0x3d, 4], ["AND", "aby", 0x39, 4],
  ["AND", "izx", 0x21, 6], ["AND", "izy", 0x31, 5],
  // ASL
  ["ASL", "acc", 0x0a, 2], ["ASL", "zp", 0x06, 5], ["ASL", "zpx", 0x16, 6],
  ["ASL", "abs", 0x0e, 6], ["ASL", "abx", 0x1e, 7],
  // Branches
  ["BCC", "rel", 0x90, 2], ["BCS", "rel", 0xb0, 2], ["BEQ", "rel", 0xf0, 2],
  ["BMI", "rel", 0x30, 2], ["BNE", "rel", 0xd0, 2], ["BPL", "rel", 0x10, 2],
  ["BVC", "rel", 0x50, 2], ["BVS", "rel", 0x70, 2],
  // BIT
  ["BIT", "zp", 0x24, 3], ["BIT", "abs", 0x2c, 4],
  // BRK
  ["BRK", "imp", 0x00, 7],
  // Clears / sets
  ["CLC", "imp", 0x18, 2], ["CLD", "imp", 0xd8, 2], ["CLI", "imp", 0x58, 2],
  ["CLV", "imp", 0xb8, 2], ["SEC", "imp", 0x38, 2], ["SED", "imp", 0xf8, 2],
  ["SEI", "imp", 0x78, 2],
  // CMP
  ["CMP", "imm", 0xc9, 2], ["CMP", "zp", 0xc5, 3], ["CMP", "zpx", 0xd5, 4],
  ["CMP", "abs", 0xcd, 4], ["CMP", "abx", 0xdd, 4], ["CMP", "aby", 0xd9, 4],
  ["CMP", "izx", 0xc1, 6], ["CMP", "izy", 0xd1, 5],
  // CPX / CPY
  ["CPX", "imm", 0xe0, 2], ["CPX", "zp", 0xe4, 3], ["CPX", "abs", 0xec, 4],
  ["CPY", "imm", 0xc0, 2], ["CPY", "zp", 0xc4, 3], ["CPY", "abs", 0xcc, 4],
  // DEC / DEX / DEY
  ["DEC", "zp", 0xc6, 5], ["DEC", "zpx", 0xd6, 6], ["DEC", "abs", 0xce, 6],
  ["DEC", "abx", 0xde, 7], ["DEX", "imp", 0xca, 2], ["DEY", "imp", 0x88, 2],
  // EOR
  ["EOR", "imm", 0x49, 2], ["EOR", "zp", 0x45, 3], ["EOR", "zpx", 0x55, 4],
  ["EOR", "abs", 0x4d, 4], ["EOR", "abx", 0x5d, 4], ["EOR", "aby", 0x59, 4],
  ["EOR", "izx", 0x41, 6], ["EOR", "izy", 0x51, 5],
  // INC / INX / INY
  ["INC", "zp", 0xe6, 5], ["INC", "zpx", 0xf6, 6], ["INC", "abs", 0xee, 6],
  ["INC", "abx", 0xfe, 7], ["INX", "imp", 0xe8, 2], ["INY", "imp", 0xc8, 2],
  // JMP / JSR
  ["JMP", "abs", 0x4c, 3], ["JMP", "ind", 0x6c, 5], ["JSR", "abs", 0x20, 6],
  // LDA
  ["LDA", "imm", 0xa9, 2], ["LDA", "zp", 0xa5, 3], ["LDA", "zpx", 0xb5, 4],
  ["LDA", "abs", 0xad, 4], ["LDA", "abx", 0xbd, 4], ["LDA", "aby", 0xb9, 4],
  ["LDA", "izx", 0xa1, 6], ["LDA", "izy", 0xb1, 5],
  // LDX
  ["LDX", "imm", 0xa2, 2], ["LDX", "zp", 0xa6, 3], ["LDX", "zpy", 0xb6, 4],
  ["LDX", "abs", 0xae, 4], ["LDX", "aby", 0xbe, 4],
  // LDY
  ["LDY", "imm", 0xa0, 2], ["LDY", "zp", 0xa4, 3], ["LDY", "zpx", 0xb4, 4],
  ["LDY", "abs", 0xac, 4], ["LDY", "abx", 0xbc, 4],
  // LSR
  ["LSR", "acc", 0x4a, 2], ["LSR", "zp", 0x46, 5], ["LSR", "zpx", 0x56, 6],
  ["LSR", "abs", 0x4e, 6], ["LSR", "abx", 0x5e, 7],
  // NOP
  ["NOP", "imp", 0xea, 2],
  // ORA
  ["ORA", "imm", 0x09, 2], ["ORA", "zp", 0x05, 3], ["ORA", "zpx", 0x15, 4],
  ["ORA", "abs", 0x0d, 4], ["ORA", "abx", 0x1d, 4], ["ORA", "aby", 0x19, 4],
  ["ORA", "izx", 0x01, 6], ["ORA", "izy", 0x11, 5],
  // Stack
  ["PHA", "imp", 0x48, 3], ["PHP", "imp", 0x08, 3], ["PLA", "imp", 0x68, 4],
  ["PLP", "imp", 0x28, 4],
  // ROL / ROR
  ["ROL", "acc", 0x2a, 2], ["ROL", "zp", 0x26, 5], ["ROL", "zpx", 0x36, 6],
  ["ROL", "abs", 0x2e, 6], ["ROL", "abx", 0x3e, 7],
  ["ROR", "acc", 0x6a, 2], ["ROR", "zp", 0x66, 5], ["ROR", "zpx", 0x76, 6],
  ["ROR", "abs", 0x6e, 6], ["ROR", "abx", 0x7e, 7],
  // RTI / RTS
  ["RTI", "imp", 0x40, 6], ["RTS", "imp", 0x60, 6],
  // SBC
  ["SBC", "imm", 0xe9, 2], ["SBC", "zp", 0xe5, 3], ["SBC", "zpx", 0xf5, 4],
  ["SBC", "abs", 0xed, 4], ["SBC", "abx", 0xfd, 4], ["SBC", "aby", 0xf9, 4],
  ["SBC", "izx", 0xe1, 6], ["SBC", "izy", 0xf1, 5],
  // STA
  ["STA", "zp", 0x85, 3], ["STA", "zpx", 0x95, 4], ["STA", "abs", 0x8d, 4],
  ["STA", "abx", 0x9d, 5], ["STA", "aby", 0x99, 5], ["STA", "izx", 0x81, 6],
  ["STA", "izy", 0x91, 6],
  // STX / STY
  ["STX", "zp", 0x86, 3], ["STX", "zpy", 0x96, 4], ["STX", "abs", 0x8e, 4],
  ["STY", "zp", 0x84, 3], ["STY", "zpx", 0x94, 4], ["STY", "abs", 0x8c, 4],
  // Transfers
  ["TAX", "imp", 0xaa, 2], ["TAY", "imp", 0xa8, 2], ["TSX", "imp", 0xba, 2],
  ["TXA", "imp", 0x8a, 2], ["TXS", "imp", 0x9a, 2], ["TYA", "imp", 0x98, 2],
];

/** opcode byte (0..255) -> definition; undefined entries are illegal opcodes. */
export const BY_OPCODE: (OpDef | undefined)[] = new Array(256).fill(undefined);

/** "MNEMONIC" -> (mode -> definition), for the assembler. */
export const BY_MNEMONIC: Map<string, Map<AddrMode, OpDef>> = new Map();

for (const [mnemonic, mode, opcode, cycles] of TABLE) {
  const def: OpDef = { mnemonic, mode, opcode, cycles };
  BY_OPCODE[opcode] = def;
  let modes = BY_MNEMONIC.get(mnemonic);
  if (!modes) {
    modes = new Map();
    BY_MNEMONIC.set(mnemonic, modes);
  }
  modes.set(mode, def);
}

/** Set of all recognised mnemonics, for the assembler / syntax highlighting. */
export const MNEMONICS: Set<string> = new Set(BY_MNEMONIC.keys());

/** Branch mnemonics use relative addressing exclusively. */
export const BRANCH_MNEMONICS = new Set([
  "BCC", "BCS", "BEQ", "BMI", "BNE", "BPL", "BVC", "BVS",
]);
