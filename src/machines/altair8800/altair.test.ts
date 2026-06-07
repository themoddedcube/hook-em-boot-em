import { describe, it, expect } from "vitest";
import { createAltair8800 } from "./index";

function run(src: string) {
  const m = createAltair8800();
  let out = "";
  m.onOutput((t) => (out += t));
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return { state: m.getState(), out };
}

describe("Intel 8080 semantics", () => {
  it("MVI / MOV / ADD (A = 5 + 7 = 12)", () => {
    const { state } = run(["MVI A, 5", "MVI B, 7", "ADD B", "HLT"].join("\n"));
    expect(state.registers.A).toBe(12);
    expect(state.halted).toBe(true);
  });

  it("loops with DCR + JNZ (sum 5..1 = 15)", () => {
    const { state } = run(
      [
        "MVI A, 0",
        "MVI B, 5",
        "LOOP: ADD B",
        "DCR B",
        "JNZ LOOP",
        "HLT",
      ].join("\n")
    );
    expect(state.registers.A).toBe(15);
  });

  it("stores and loads via HL / M (round-trips 42)", () => {
    const { state } = run(
      [
        "LXI H, 0x0200",
        "MVI M, 42",
        "MVI A, 0",
        "MOV A, M",
        "HLT",
      ].join("\n")
    );
    expect(state.registers.A).toBe(42);
  });

  it("prints with OUT (HI)", () => {
    const { out } = run(
      ["MVI A, 'H'", "OUT 0", "MVI A, 'I'", "OUT 0", "HLT"].join("\n")
    );
    expect(out).toBe("HI");
  });

  it("calls a subroutine with CALL/RET to print ALTAIR", () => {
    const { out } = run(
      [
        "LXI SP, 0x1000",
        "MVI A, 'A'", "CALL PR",
        "MVI A, 'L'", "CALL PR",
        "MVI A, 'T'", "CALL PR",
        "MVI A, 'A'", "CALL PR",
        "MVI A, 'I'", "CALL PR",
        "MVI A, 'R'", "CALL PR",
        "HLT",
        "PR: OUT 0",
        "RET",
      ].join("\n")
    );
    expect(out).toBe("ALTAIR");
  });

  it("CPI sets the zero flag on equality", () => {
    const { state } = run(["MVI A, 7", "CPI 7", "HLT"].join("\n"));
    expect(state.flags.Z).toBe(true);
  });
});
