import { describe, it, expect } from "vitest";
import { createLc3 } from "./index";

function run(src: string) {
  const m = createLc3();
  let out = "";
  m.onOutput((t) => (out += t));
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return { state: m.getState(), out };
}

describe("LC-3 semantics", () => {
  it("ADD with registers and immediates (R0 = 5 + 7 = 12)", () => {
    const { state } = run(
      [
        ".ORIG x3000",
        "ADD R1, R1, #5",
        "ADD R2, R2, #7",
        "ADD R0, R1, R2",
        "HALT",
        ".END",
      ].join("\n")
    );
    expect(state.registers.R0).toBe(12);
    expect(state.halted).toBe(true);
  });

  it("loops with BR and condition codes (sum 5..1 = 15)", () => {
    const { state } = run(
      [
        ".ORIG x3000",
        "AND R0, R0, #0",   // sum = 0
        "AND R1, R1, #0",
        "ADD R1, R1, #5",   // counter = 5
        "LOOP ADD R0, R0, R1",
        "ADD R1, R1, #-1",
        "BRp LOOP",
        "HALT",
        ".END",
      ].join("\n")
    );
    expect(state.registers.R0).toBe(15);
  });

  it("loads operands from memory and adds (LD / .FILL -> 30)", () => {
    const { state } = run(
      [
        ".ORIG x3000",
        "LD R0, A",
        "LD R1, B",
        "ADD R0, R0, R1",
        "HALT",
        "A .FILL #10",
        "B .FILL #20",
        ".END",
      ].join("\n")
    );
    expect(state.registers.R0).toBe(30);
  });

  it("prints a string with LEA + PUTS + .STRINGZ", () => {
    const { out } = run(
      [
        ".ORIG x3000",
        "LEA R0, MSG",
        "PUTS",
        "HALT",
        'MSG .STRINGZ "HELLO"',
        ".END",
      ].join("\n")
    );
    expect(out).toBe("HELLO");
  });

  it("sums an array with LDR in a loop (= 45)", () => {
    const { state } = run(
      [
        ".ORIG x3000",
        "AND R0, R0, #0",   // sum
        "LEA R1, ARR",      // pointer
        "AND R2, R2, #0",
        "ADD R2, R2, #5",   // count = 5
        "LOOP LDR R3, R1, #0",
        "ADD R0, R0, R3",
        "ADD R1, R1, #1",
        "ADD R2, R2, #-1",
        "BRp LOOP",
        "HALT",
        "ARR .FILL #10",
        ".FILL #20",
        ".FILL #3",
        ".FILL #7",
        ".FILL #5",
        ".END",
      ].join("\n")
    );
    expect(state.registers.R0).toBe(45);
  });

  it("calls a subroutine with JSR / RET", () => {
    const { state } = run(
      [
        ".ORIG x3000",
        "AND R0, R0, #0",
        "JSR FILL5",
        "HALT",
        "FILL5 ADD R0, R0, #5", // R0 = 5
        "RET",
        ".END",
      ].join("\n")
    );
    expect(state.registers.R0).toBe(5);
  });
});
