import { describe, it, expect } from "vitest";
import { createMos6502 } from "./index";
import { assemble } from "./assembler";
import { DISPLAY_BASE } from "./display";

/** Assemble + run a program to completion, returning the final state. */
function runProgram(src: string) {
  const m = createMos6502();
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return m.getState();
}

describe("6502 assembler", () => {
  it("assembles LDA #$01 / STA $0200 to the right bytes", () => {
    const { bytes, errors } = assemble("LDA #$01\nSTA $0200");
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([0xa9, 0x01, 0x8d, 0x00, 0x02]);
  });

  it("selects zero-page vs absolute by operand value", () => {
    expect(Array.from(assemble("STA $10").bytes)).toEqual([0x85, 0x10]);
    expect(Array.from(assemble("STA $1234").bytes)).toEqual([0x8d, 0x34, 0x12]);
  });

  it("resolves labels and computes relative branch offsets", () => {
    // loop: DEX / BNE loop  -> CA D0 FD
    const { bytes, errors } = assemble("loop:\n DEX\n BNE loop");
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([0xca, 0xd0, 0xfd]);
  });

  it("honours *= origin and define", () => {
    const { bytes, origin, errors } = assemble(
      "define target $0200\n*= $0600\nLDA #1\nSTA target"
    );
    expect(errors).toEqual([]);
    expect(origin).toBe(0x0600);
    expect(Array.from(bytes)).toEqual([0xa9, 0x01, 0x8d, 0x00, 0x02]);
  });

  it("reports branch-out-of-range as an error", () => {
    const lines = ["BEQ far"];
    for (let i = 0; i < 200; i++) lines.push("NOP");
    lines.push("far:");
    const { errors } = assemble(lines.join("\n"));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("6502 CPU semantics", () => {
  it("LDA #$01 / STA $0200 sets A and memory (PRD §10.1)", () => {
    const s = runProgram("LDA #$01\nSTA $0200\nBRK");
    expect(s.registers.A).toBe(0x01);
    expect(s.memory[0x0200]).toBe(0x01);
    expect(s.halted).toBe(true);
  });

  it("counts down with a DEX/BNE loop", () => {
    const s = runProgram("LDX #$05\nloop:\n DEX\n BNE loop\nBRK");
    expect(s.registers.X).toBe(0);
    expect(s.flags.Z).toBe(true);
  });

  it("ADC sets carry and overflow correctly", () => {
    // 0x50 + 0x50 = 0xA0: carry clear, overflow set, negative set.
    const s = runProgram("CLC\nLDA #$50\nADC #$50\nBRK");
    expect(s.registers.A).toBe(0xa0);
    expect(s.flags.C).toBe(false);
    expect(s.flags.V).toBe(true);
    expect(s.flags.N).toBe(true);
  });

  it("fills the first display row via an indexed loop", () => {
    // Write colour 1 to $0200..$021F (32 pixels).
    const s = runProgram(
      [
        "LDX #$00",
        "LDA #$01",
        "loop:",
        " STA $0200,X",
        " INX",
        " CPX #$20",
        " BNE loop",
        "BRK",
      ].join("\n")
    );
    for (let i = 0; i < 32; i++) {
      expect(s.memory[DISPLAY_BASE + i]).toBe(0x01);
    }
  });

  it("JSR/RTS calls a subroutine and returns", () => {
    const s = runProgram(
      [
        "JSR sub",
        "LDA #$ff",
        "BRK",
        "sub:",
        " LDX #$42",
        " RTS",
      ].join("\n")
    );
    expect(s.registers.X).toBe(0x42);
    expect(s.registers.A).toBe(0xff);
  });
});
