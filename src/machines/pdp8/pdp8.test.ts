import { describe, it, expect } from "vitest";
import { createPdp8 } from "./index";

function run(src: string) {
  const m = createPdp8();
  let out = "";
  m.onOutput((t) => (out += t));
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return { state: m.getState(), out };
}

describe("PDP-8 semantics", () => {
  it("TAD adds (5 + 7 = 12)", () => {
    const { state } = run(
      ["*200", "CLA", "TAD A", "TAD B", "HLT", "A, 5", "B, 7"].join("\n")
    );
    expect(state.registers.AC).toBe(12);
    expect(state.halted).toBe(true);
  });

  it("TAD carry complements the Link", () => {
    // 4095 + 1 overflows 12 bits -> AC = 0, Link toggled to 1.
    const { state } = run(
      ["*200", "CLA", "TAD A", "TAD B", "HLT", "A, 4095", "B, 1"].join("\n")
    );
    expect(state.registers.AC).toBe(0);
    expect(state.flags.L).toBe(true);
  });

  it("counts to 5 with an ISZ loop", () => {
    const { state } = run(
      [
        "*200",
        "        CLA CLL",
        "        TAD MFIVE", // AC = -5
        "        DCA CTR",
        "        DCA SUM",
        "LOOP,   ISZ SUM", // SUM++
        "        ISZ CTR", // CTR++, skip when 0
        "        JMP LOOP",
        "        TAD SUM",
        "        HLT",
        "SUM,    0",
        "CTR,    0",
        "MFIVE,  -5",
      ].join("\n")
    );
    expect(state.registers.AC).toBe(5);
  });

  it("multiplies by repeated addition (6 × 4 = 24)", () => {
    const { state } = run(
      [
        "*200",
        "        CLA CLL",
        "        TAD MFOUR", // AC = -4
        "        DCA CTR",
        "        DCA SUM",
        "LOOP,   TAD SUM",
        "        TAD SIX",
        "        DCA SUM", // SUM += 6
        "        ISZ CTR",
        "        JMP LOOP",
        "        TAD SUM",
        "        HLT",
        "SUM,    0",
        "CTR,    0",
        "MFOUR,  -4",
        "SIX,    6",
      ].join("\n")
    );
    expect(state.registers.AC).toBe(24);
  });

  it("prints to the Teletype (HI)", () => {
    const { out } = run(
      [
        "*200",
        "        CLA",
        "        TAD H",
        "        TLS",
        "        CLA",
        "        TAD I2",
        "        TLS",
        "        HLT",
        "H,      72",
        "I2,     73",
      ].join("\n")
    );
    expect(out).toBe("HI");
  });

  it("calls a subroutine with JMS/JMP I to print PDP", () => {
    const { out } = run(
      [
        "*200",
        "START,  CLA",
        "        TAD CP",
        "        JMS PRINT",
        "        CLA",
        "        TAD CD",
        "        JMS PRINT",
        "        CLA",
        "        TAD CP",
        "        JMS PRINT",
        "        HLT",
        "PRINT,  0",
        "        TLS",
        "        JMP I PRINT",
        "CP,     80",
        "CD,     68",
      ].join("\n")
    );
    expect(out).toBe("PDP");
  });
});
